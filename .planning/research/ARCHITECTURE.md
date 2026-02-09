# Architecture Patterns: Extension System, GitHub Integration, and Toolbar

**Domain:** Desktop Git client -- extension system, GitHub integration, extensible toolbar
**Researched:** 2026-02-09

## Current Architecture (v1.4.0 Baseline)

```
App.tsx
  |
  +--> Header (top bar: repo/branch switcher, process tabs, toolbar buttons)
  |       Static button list, not data-driven
  |
  +--> NavigationProvider (XState actor context)
  |       |
  |       +--> navigationMachine (XState v5 FSM)
  |       |       States: navigating | confirmingDiscard
  |       |       Context: { activeProcess, bladeStack, dirtyBladeIds }
  |       |       ProcessType: "staging" | "topology"
  |       |
  |       +--> BladeContainer
  |               +--> BladeStrip (collapsed previous blades)
  |               +--> BladeRenderer --> bladeRegistry.get(type) --> Component
  |
  +--> RepositoryView
  |       +--> Left sidebar (branches, stash, tags, gitflow, worktrees)
  |       +--> BladeContainer (right, main content)
  |
  +--> CommandPalette (mod+k, searches commandRegistry)
  |
  +--> ToastContainer

Registry systems:
  - bladeRegistry: Map<BladeType, BladeRegistration> -- component resolution
  - commandRegistry: Command[] -- palette + shortcuts
  - storeRegistry: Set<() => void> -- resetAllStores()
  - BladePropsMap interface -- type-safe blade props discriminator
```

### Key Extension Points in Current Code

| System | Extension Mechanism | Current Limitation |
|--------|--------------------|--------------------|
| **bladeRegistry** | `registerBlade({ type, component, ... })` in `registration.ts` | `BladeType` is a union of literal strings in `BladePropsMap`; cannot add types at runtime without expanding the interface |
| **commandRegistry** | `registerCommand({ id, title, action, ... })` | `CommandCategory` is a fixed union type; no `enabled()` beyond boolean, no visibility scoping |
| **storeRegistry** | `registerStoreForReset(store)` on creation | No per-extension store lifecycle or cleanup on extension unload |
| **BladePropsMap** | Static interface in `stores/bladeTypes.ts` | Extension blade props would need `Record<string, unknown>` escape hatch |
| **ProcessType** | `"staging" \| "topology"` | Hard-coded in FSM and `ProcessNavigation` component |
| **Header** | Static JSX with hardcoded buttons | No contribution API; extensions cannot add toolbar actions |
| **_discovery.ts** | `import.meta.glob("./*/registration.{ts,tsx}")` | Compile-time only; runtime extension loading impossible via this path |

---

## Recommended Architecture: Three-Layer Extension System

### High-Level Overview

```
                         Extension Lifecycle
                         ==================

.flowforge/extensions/github-integration/
    manifest.json           <-- declares capabilities
    index.js                <-- bundled extension code (ESM)

        |  discovered by
        v

ExtensionHost (singleton)
    |
    +--> ExtensionManifest[] (parsed manifests)
    +--> loadExtension(id) --> dynamic import() --> activate()
    +--> unloadExtension(id) --> deactivate() --> cleanup registrations
    |
    +--> ExtensionAPI (sandboxed facade)
            |
            +--> blades.register(type, config)      --> bladeRegistry
            +--> commands.register(cmd)              --> commandRegistry
            +--> toolbar.contribute(action)          --> toolbarRegistry (NEW)
            +--> stores.create(name, creator)        --> storeRegistry
            +--> github.getToken()                   --> SecureTokenStore
            +--> events.on("repository-changed", cb) --> event bus
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **ExtensionHost** | Discovers, loads, unloads extensions. Manages lifecycle. Owns ExtensionAPI factory. | File system (manifest discovery), all registries |
| **ExtensionAPI** | Sandboxed facade per-extension. Tracks what each extension registered for cleanup. | bladeRegistry, commandRegistry, toolbarRegistry, storeRegistry |
| **bladeRegistry** (modified) | Unchanged Map-based lookup, but now accepts `ExtensionBladeType` (string) in addition to core `BladeType` | BladeRenderer, ExtensionAPI |
| **commandRegistry** (modified) | Unchanged array-based registry, but `CommandCategory` becomes `string` (extensible) | CommandPalette, ExtensionAPI |
| **toolbarRegistry** (NEW) | Ordered list of toolbar action contributions, with priority, visibility rules, and overflow grouping | Header component, ExtensionAPI |
| **SecureTokenStore** (NEW) | OAuth tokens stored in OS keychain via Rust `keyring` crate, exposed through Tauri commands | GitHub API client, ExtensionAPI |
| **GitHubClient** (NEW) | Authenticated Octokit wrapper in frontend, token from SecureTokenStore | GitHub extension blades, React Query |

---

## Integration Point 1: Extension System

### 1a. Manifest Format

Extensions live in `.flowforge/extensions/{name}/` per-repository (or `~/.flowforge/extensions/` for global). Each extension has a `manifest.json`:

```json
{
  "id": "github-integration",
  "name": "GitHub Integration",
  "version": "1.0.0",
  "engine": "flowforge >=1.5.0",
  "main": "index.js",
  "activationEvents": [
    "onRepository",
    "onCommand:github.authenticate"
  ],
  "contributes": {
    "blades": [
      {
        "type": "github-pr-list",
        "title": "Pull Requests",
        "singleton": true
      },
      {
        "type": "github-pr-detail",
        "title": "PR Detail"
      },
      {
        "type": "github-issues",
        "title": "Issues",
        "singleton": true
      }
    ],
    "commands": [
      {
        "id": "github.authenticate",
        "title": "GitHub: Sign In",
        "category": "GitHub"
      },
      {
        "id": "github.openPR",
        "title": "GitHub: Open Pull Request",
        "category": "GitHub",
        "shortcut": "mod+shift+g"
      }
    ],
    "toolbar": [
      {
        "commandId": "github.openPR",
        "icon": "git-pull-request",
        "group": "github",
        "priority": 100,
        "when": "github.isAuthenticated && repo.hasRemote"
      }
    ]
  }
}
```

### 1b. Extension Loading Architecture

```typescript
// src/extensions/ExtensionHost.ts

interface ExtensionContext {
  id: string;
  api: ExtensionAPI;
  disposables: Array<() => void>;
}

class ExtensionHost {
  private extensions = new Map<string, ExtensionContext>();
  private manifests = new Map<string, ExtensionManifest>();

  /** Discover extensions from filesystem via Tauri command */
  async discover(repoPath: string): Promise<ExtensionManifest[]> {
    // Rust command reads .flowforge/extensions/*/manifest.json
    const manifests = await commands.discoverExtensions(repoPath);
    for (const m of manifests) {
      this.manifests.set(m.id, m);
    }
    return manifests;
  }

  /** Load and activate an extension */
  async activate(id: string): Promise<void> {
    const manifest = this.manifests.get(id);
    if (!manifest || this.extensions.has(id)) return;

    const api = createExtensionAPI(id);
    const disposables: Array<() => void> = [];

    // Dynamic import from extension directory
    // Rust command returns the file:// URL for the extension's main file
    const mainUrl = await commands.getExtensionMainUrl(id);
    const mod = await import(/* @vite-ignore */ mainUrl);

    if (typeof mod.activate === "function") {
      await mod.activate(api);
    }

    this.extensions.set(id, { id, api, disposables });
  }

  /** Unload extension, cleaning up all registrations */
  async deactivate(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (!ext) return;

    // Call extension's deactivate if it exists
    const mainUrl = await commands.getExtensionMainUrl(id);
    try {
      const mod = await import(/* @vite-ignore */ mainUrl);
      if (typeof mod.deactivate === "function") {
        await mod.deactivate();
      }
    } catch { /* extension may not export deactivate */ }

    // Clean up all registrations made through this extension's API
    ext.api.dispose();
    this.extensions.delete(id);
  }
}
```

### 1c. ExtensionAPI (Sandboxed Facade)

The key insight: each extension gets its own API instance that **tracks registrations** for cleanup on unload.

```typescript
// src/extensions/ExtensionAPI.ts

interface ExtensionAPI {
  blades: {
    register(config: ExtensionBladeRegistration): void;
    openBlade(type: string, props: Record<string, unknown>, title?: string): void;
  };
  commands: {
    register(cmd: ExtensionCommand): void;
    execute(id: string): void;
  };
  toolbar: {
    contribute(action: ToolbarAction): void;
  };
  stores: {
    create<T>(name: string, creator: StateCreator<T>): StoreApi<T>;
  };
  events: {
    on(event: string, handler: (...args: unknown[]) => void): void;
    off(event: string, handler: (...args: unknown[]) => void): void;
  };
  context: {
    /** Read-only access to navigation state */
    getActiveProcess(): ProcessType;
    getBladeStack(): TypedBlade[];
    getRepoStatus(): RepositoryStatus | null;
  };
  dispose(): void;
}

function createExtensionAPI(extensionId: string): ExtensionAPI {
  const registeredBlades: string[] = [];
  const registeredCommands: string[] = [];
  const registeredToolbarActions: string[] = [];
  const registeredStores: StoreApi<unknown>[] = [];
  const eventHandlers: Array<{ event: string; handler: Function }> = [];

  return {
    blades: {
      register(config) {
        const type = `ext:${extensionId}:${config.type}` as BladeType;
        registerBlade({ ...config, type });
        registeredBlades.push(type);
      },
      openBlade(type, props, title) {
        const qualifiedType = `ext:${extensionId}:${type}`;
        openBlade(qualifiedType as BladeType, props, title);
      },
    },
    commands: {
      register(cmd) {
        const qualifiedId = `ext:${extensionId}:${cmd.id}`;
        registerCommand({ ...cmd, id: qualifiedId });
        registeredCommands.push(qualifiedId);
      },
      execute(id) {
        executeCommand(`ext:${extensionId}:${id}`);
      },
    },
    toolbar: {
      contribute(action) {
        const qualifiedId = `ext:${extensionId}:${action.commandId}`;
        toolbarRegistry.add({ ...action, commandId: qualifiedId, extensionId });
        registeredToolbarActions.push(qualifiedId);
      },
    },
    stores: {
      create(name, creator) {
        const store = createBladeStore(`ext:${extensionId}:${name}`, creator);
        registeredStores.push(store);
        return store;
      },
    },
    events: {
      on(event, handler) {
        // Subscribe to Tauri events or internal event bus
        eventHandlers.push({ event, handler });
      },
      off(event, handler) {
        // Unsubscribe
      },
    },
    context: {
      getActiveProcess: () => getNavigationActor().getSnapshot().context.activeProcess,
      getBladeStack: () => getNavigationActor().getSnapshot().context.bladeStack,
      getRepoStatus: () => useRepositoryStore.getState().repoStatus,
    },
    dispose() {
      // Remove all registrations
      for (const type of registeredBlades) unregisterBlade(type);
      for (const id of registeredCommands) unregisterCommand(id);
      for (const id of registeredToolbarActions) toolbarRegistry.remove(id);
      // Stores: reset and unregister
      for (const store of registeredStores) {
        store.setState(store.getInitialState(), true);
      }
    },
  };
}
```

### 1d. Type System Changes

The `BladeType` union and `BladePropsMap` must accommodate extension blade types without breaking type safety for core blades.

```typescript
// src/stores/bladeTypes.ts (modified)

/** Core blade types -- type-safe props */
export interface CoreBladePropsMap {
  "staging-changes": Record<string, never>;
  "topology-graph": Record<string, never>;
  "commit-details": { oid: string };
  "diff": { source: DiffSource };
  // ... all existing types
}

/** Extension blade types use generic props */
export type ExtensionBladeType = `ext:${string}:${string}`;

/** Union of core + extension blade types */
export type BladeType = keyof CoreBladePropsMap | ExtensionBladeType;

/** Props map: core types are type-safe, extension types are Record<string, unknown> */
export type BladePropsMap = CoreBladePropsMap & {
  [K in ExtensionBladeType]: Record<string, unknown>;
};

/** Discriminated blade union supports both core and extension */
export type TypedBlade = {
  [K in keyof CoreBladePropsMap]: {
    id: string;
    type: K;
    title: string;
    props: CoreBladePropsMap[K];
  };
}[keyof CoreBladePropsMap] | {
  id: string;
  type: ExtensionBladeType;
  title: string;
  props: Record<string, unknown>;
};
```

### 1e. Navigation FSM Changes

The XState machine needs minimal changes because extension blades flow through the same PUSH_BLADE/POP_BLADE events. The singleton guard must check the manifest.

```typescript
// navigationMachine.ts changes

/** Singleton check now consults both hardcoded list AND extension manifests */
const CORE_SINGLETONS = new Set([
  "settings", "changelog", "gitflow-cheatsheet",
  "conventional-commit", "repo-browser",
]);

guards: {
  isNotSingleton: ({ context, event }) => {
    if (event.type !== "PUSH_BLADE") return true;
    const type = event.bladeType;

    // Core singletons
    if (CORE_SINGLETONS.has(type)) {
      return !context.bladeStack.some(b => b.type === type);
    }

    // Extension singletons: check manifest
    if (type.startsWith("ext:")) {
      const isSingleton = extensionHost.isBladeTypeSingleton(type);
      if (isSingleton) {
        return !context.bladeStack.some(b => b.type === type);
      }
    }

    return true;
  },
}
```

### 1f. Sandboxing Approach

**No iframe/WebWorker sandboxing for v1.** Rationale:

- Extensions are per-repository files loaded from `.flowforge/extensions/`
- Users explicitly install them (no marketplace yet)
- Full isolation adds significant complexity (message passing, serialization of React components)
- VS Code itself ran unsandboxed extensions for years before partial sandboxing

**Security mitigations without full sandboxing:**
1. Extension code runs through `import()` -- no `eval()` or `Function()` constructor
2. Namespace-qualified IDs (`ext:github-integration:pr-list`) prevent collisions
3. ExtensionAPI facade limits what extensions can access (no raw store access, no direct IPC)
4. Manifest declares capabilities; undeclared access is denied
5. Extension directory is under user control (`.flowforge/extensions/` in repo)

**Future:** If a marketplace is added, consider running extension code in a Web Worker with a proxy-based API bridge (similar to VS Code's Extension Host process). This is a Phase 2+ concern.

---

## Integration Point 2: GitHub Integration (First Extension)

### 2a. OAuth Device Flow

The Device Flow is the correct choice for FlowForge because:
- No localhost server needed (unlike Authorization Code flow)
- No client secret needed in the distributed binary
- User opens browser, enters code -- natural for desktop apps
- `@octokit/auth-oauth-device` handles the polling loop

```
User clicks "GitHub: Sign In"
    |
    v
Frontend: createOAuthDeviceAuth({ clientId, onVerification })
    |
    +--> GitHub POST /login/device/code
    |       Returns: { device_code, user_code, verification_uri }
    |
    +--> UI shows: "Open github.com/login/device and enter ABCD-1234"
    |       User opens browser (via Tauri shell.open)
    |
    +--> Background polling: POST /login/oauth/access_token
    |       (octokit handles this automatically)
    |
    +--> On success: { access_token, token_type, scope }
    |
    v
Store token in OS keychain via Tauri command
    |
    v
GitHub extension activates authenticated features
```

### 2b. Token Storage Architecture

**Use OS keychain via Rust `keyring` crate**, not `tauri-plugin-store` (which stores unencrypted JSON on disk) and not `tauri-plugin-stronghold` (deprecated, will be removed in Tauri v3).

```rust
// src-tauri/src/credentials.rs

use keyring::Entry;

const SERVICE_NAME: &str = "com.flowforge.github";

#[tauri::command]
#[specta::specta]
pub fn store_github_token(token: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, "oauth-token")
        .map_err(|e| format!("Keyring error: {}", e))?;
    entry.set_password(&token)
        .map_err(|e| format!("Failed to store token: {}", e))?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_github_token() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, "oauth-token")
        .map_err(|e| format!("Keyring error: {}", e))?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to get token: {}", e)),
    }
}

#[tauri::command]
#[specta::specta]
pub fn delete_github_token() -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, "oauth-token")
        .map_err(|e| format!("Keyring error: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
        Err(e) => Err(format!("Failed to delete token: {}", e)),
    }
}
```

Cargo.toml addition:
```toml
keyring = { version = "3", features = ["apple-native", "windows-native", "sync-secret-service"] }
```

### 2c. GitHub API Client Architecture

**Frontend Octokit client with token from keychain**, not Rust-side HTTP. Rationale: GitHub API data is consumed directly by React components; routing all 50+ GitHub REST endpoints through Rust Tauri commands would be unnecessarily heavy. The `reqwest` pattern works for simple APIs (gitignore templates) but GitHub's API surface is large and Octokit handles pagination, rate limiting, and types.

```typescript
// src/extensions/github-integration/lib/github-client.ts

import { Octokit } from "@octokit/rest";
import { commands } from "../../../bindings";

let octokitInstance: Octokit | null = null;

export async function getGitHubClient(): Promise<Octokit | null> {
  if (octokitInstance) return octokitInstance;

  const token = await commands.getGithubToken();
  if (!token) return null;

  octokitInstance = new Octokit({
    auth: token,
    userAgent: "FlowForge/1.5.0",
  });

  return octokitInstance;
}

export function clearGitHubClient(): void {
  octokitInstance = null;
}
```

### 2d. PR/Issue Data Flow to UI

```
GitHub Extension activate()
    |
    +--> Register blades: github-pr-list, github-pr-detail, github-issues
    +--> Register commands: github.authenticate, github.openPR, github.viewIssues
    +--> Contribute toolbar: PR count badge, issues button
    |
    v

User opens "Pull Requests" blade (via toolbar or command palette)
    |
    v
GitHubPRListBlade (React component)
    |
    +--> useGitHubPRs() hook
    |       |
    |       +--> React Query: queryKey ["github", "prs", owner, repo]
    |       |       queryFn: getGitHubClient() -> octokit.pulls.list()
    |       |       staleTime: 30_000 (30s -- PRs change frequently)
    |       |       refetchOnWindowFocus: true
    |       |
    |       +--> Returns: { data: PullRequest[], isLoading, error }
    |
    +--> Renders PR list with status indicators
    |
    +--> Click PR -> openBlade("github-pr-detail", { number: 42 })
            |
            v
        GitHubPRDetailBlade
            +--> useGitHubPR(number) -> octokit.pulls.get()
            +--> useGitHubPRComments(number) -> octokit.issues.listComments()
            +--> useGitHubPRChecks(number) -> octokit.checks.listForRef()
```

### 2e. Remote Detection

The extension needs to know the GitHub owner/repo from the current repository's remote URL.

```typescript
// Parse remote URL to extract owner/repo
function parseGitHubRemote(remoteUrl: string): { owner: string; repo: string } | null {
  // Handle HTTPS: https://github.com/owner/repo.git
  // Handle SSH: git@github.com:owner/repo.git
  const httpsMatch = remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  const sshMatch = remoteUrl.match(/github\.com:([^/]+)\/([^/.]+)/);
  const match = httpsMatch || sshMatch;
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}
```

The existing `get_remotes` Rust command returns remote URLs; the extension uses this to detect GitHub connectivity.

---

## Integration Point 3: Extensible Toolbar

### 3a. Current Header Problem

The `Header.tsx` is a 415-line component with **16 hardcoded buttons**. Buttons are conditionally shown based on `status` (repo open), `undoInfo`, etc. There is no data-driven rendering or contribution mechanism.

### 3b. Toolbar Registry Architecture

```typescript
// src/lib/toolbarRegistry.ts

export interface ToolbarAction {
  id: string;
  commandId: string;          // Must match a registered command
  icon: string;               // Lucide icon name
  label?: string;             // Optional text label
  group: string;              // Grouping for overflow: "repo", "sync", "github", ...
  priority: number;           // Lower = more left. Core actions: 0-99, extensions: 100+
  when?: string;              // Condition expression: "repo.isOpen", "github.isAuthenticated"
  badge?: () => string | null; // Dynamic badge (e.g., PR count)
  extensionId?: string;       // Set by ExtensionAPI, undefined for core actions
}

interface ToolbarGroup {
  id: string;
  label: string;
  priority: number;           // Group ordering
}

class ToolbarRegistry {
  private actions = new Map<string, ToolbarAction>();
  private groups = new Map<string, ToolbarGroup>();
  private listeners = new Set<() => void>();

  registerGroup(group: ToolbarGroup): void {
    this.groups.set(group.id, group);
    this.notify();
  }

  add(action: ToolbarAction): void {
    this.actions.set(action.id, action);
    this.notify();
  }

  remove(id: string): void {
    this.actions.delete(id);
    this.notify();
  }

  /** Get visible actions, sorted by priority, grouped */
  getVisibleActions(context: ToolbarContext): ToolbarAction[] {
    return Array.from(this.actions.values())
      .filter(a => evaluateWhen(a.when, context))
      .sort((a, b) => a.priority - b.priority);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }
}

export const toolbarRegistry = new ToolbarRegistry();
```

### 3c. Condition Expression Evaluator

The `when` field uses simple dot-notation conditions, similar to VS Code's `when` clause.

```typescript
// src/lib/toolbarConditions.ts

interface ToolbarContext {
  repo: {
    isOpen: boolean;
    isDirty: boolean;
    hasRemote: boolean;
  };
  github: {
    isAuthenticated: boolean;
    prCount: number;
  };
}

function evaluateWhen(expr: string | undefined, ctx: ToolbarContext): boolean {
  if (!expr) return true;

  // Split on " && "
  const conditions = expr.split("&&").map(c => c.trim());

  return conditions.every(cond => {
    // Handle negation: "!repo.isOpen"
    const negated = cond.startsWith("!");
    const path = negated ? cond.slice(1) : cond;

    const value = getNestedValue(ctx, path);
    const result = Boolean(value);
    return negated ? !result : result;
  });
}
```

### 3d. Header Refactoring

The Header transforms from a static button list to a data-driven toolbar renderer.

```typescript
// src/components/Header.tsx (conceptual refactoring)

function Header() {
  const visibleActions = useToolbarActions(); // hook subscribing to toolbarRegistry
  const [overflowOpen, setOverflowOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Split into visible and overflow based on available width
  const { visible, overflow } = useToolbarOverflow(visibleActions, containerRef);

  return (
    <header className="...">
      {/* Left: branding, repo/branch switcher, process tabs */}
      <div className="flex items-center gap-2">
        <h1>FlowForge</h1>
        {status && <RepoSwitcher ... />}
        {status && <BranchSwitcher ... />}
        {status && <ProcessNavigation />}
      </div>

      {/* Right: data-driven toolbar actions */}
      <div className="flex items-center gap-2" ref={containerRef}>
        {visible.map(action => (
          <ToolbarButton key={action.id} action={action} />
        ))}
        {overflow.length > 0 && (
          <OverflowMenu actions={overflow} />
        )}
      </div>
    </header>
  );
}
```

### 3e. Overflow Menu Architecture

When the toolbar has more actions than horizontal space, lower-priority items collapse into an overflow "..." menu, grouped by their `group` field.

```typescript
// src/hooks/useToolbarOverflow.ts

function useToolbarOverflow(
  actions: ToolbarAction[],
  containerRef: RefObject<HTMLDivElement>,
) {
  const [visibleCount, setVisibleCount] = useState(actions.length);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      const availableWidth = entry.contentRect.width;
      const BUTTON_WIDTH = 36; // approximate per-button width
      const OVERFLOW_WIDTH = 36;
      const maxButtons = Math.floor((availableWidth - OVERFLOW_WIDTH) / BUTTON_WIDTH);
      setVisibleCount(Math.max(1, maxButtons));
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef]);

  return {
    visible: actions.slice(0, visibleCount),
    overflow: actions.slice(visibleCount),
  };
}
```

### 3f. Core Toolbar Migration

Existing hardcoded Header buttons become `toolbarRegistry.add()` calls at app startup, keeping the same behavior but enabling extension contributions.

```typescript
// src/toolbar/core-actions.ts (NEW -- migrated from Header.tsx)

import { toolbarRegistry } from "../lib/toolbarRegistry";

// Group registrations
toolbarRegistry.registerGroup({ id: "settings", label: "Settings", priority: 10 });
toolbarRegistry.registerGroup({ id: "repo", label: "Repository", priority: 20 });
toolbarRegistry.registerGroup({ id: "sync", label: "Sync", priority: 30 });
toolbarRegistry.registerGroup({ id: "tools", label: "Tools", priority: 40 });

// Core actions (priority 0-99)
toolbarRegistry.add({
  id: "core:settings",
  commandId: "open-settings",
  icon: "settings",
  group: "settings",
  priority: 10,
  when: undefined, // Always visible
});

toolbarRegistry.add({
  id: "core:refresh",
  commandId: "refresh-all",
  icon: "refresh-cw",
  group: "repo",
  priority: 20,
  when: "repo.isOpen",
});

toolbarRegistry.add({
  id: "core:sync-push",
  commandId: "git-push",
  icon: "arrow-up",
  group: "sync",
  priority: 30,
  when: "repo.isOpen",
});

// ... etc for all current Header buttons
```

---

## Data Flow: Complete Extension Lifecycle

### Extension Discovery and Loading

```
App starts / Repository opens
    |
    v
App.tsx useEffect: extensionHost.discover(repoPath)
    |
    +--> Rust command: read_extension_manifests(repoPath)
    |       Reads .flowforge/extensions/*/manifest.json
    |       Validates manifest schema
    |       Returns ExtensionManifest[]
    |
    v
For each manifest with activationEvent matching current state:
    |
    +--> extensionHost.activate(id)
    |       1. Create ExtensionAPI facade
    |       2. Dynamic import(mainUrl) --> mod.activate(api)
    |       3. Extension calls api.blades.register(), api.commands.register(), etc.
    |
    v
Registries updated --> UI re-renders with new blades/commands/toolbar actions
```

### Extension Unloading (Repository Close)

```
User closes repository
    |
    v
App.tsx: extensionHost.deactivateAll()
    |
    +--> For each active extension:
    |       1. Call mod.deactivate() if exported
    |       2. ExtensionAPI.dispose()
    |           - Unregister all blades
    |           - Unregister all commands
    |           - Remove all toolbar actions
    |           - Reset and unregister all stores
    |           - Remove all event listeners
    |
    v
Registries cleaned --> UI reflects removal
```

### GitHub Extension: Authentication Flow

```
User triggers "GitHub: Sign In" (command palette or toolbar)
    |
    v
GitHubAuthCommand action():
    |
    +--> createOAuthDeviceAuth({
    |       clientId: FLOWFORGE_GITHUB_CLIENT_ID,
    |       clientType: "oauth-app",
    |       scopes: ["repo", "read:org"],
    |       onVerification(verification) {
    |           // Show modal with code and URL
    |           showDeviceFlowDialog(verification);
    |           // Open browser
    |           shell.open(verification.verification_uri);
    |       }
    |    })
    |
    +--> auth({ type: "oauth" }) -- polls GitHub in background
    |
    v
On success: { token }
    |
    +--> commands.storeGithubToken(token)  -- Rust -> OS keychain
    +--> clearGitHubClient()               -- reset cached Octokit
    +--> toolbarContext.github.isAuthenticated = true
    +--> Toolbar re-renders: GitHub actions become visible
    |
    v
Extension auto-fetches PR count for badge
```

---

## New Components vs Modified Components

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ExtensionHost` | `src/extensions/ExtensionHost.ts` | Singleton lifecycle manager for all extensions |
| `ExtensionAPI` | `src/extensions/ExtensionAPI.ts` | Per-extension sandboxed facade |
| `ExtensionManifest` types | `src/extensions/types.ts` | Manifest schema types |
| `toolbarRegistry` | `src/lib/toolbarRegistry.ts` | Data-driven toolbar action registry |
| `toolbarConditions` | `src/lib/toolbarConditions.ts` | `when` clause evaluator |
| `useToolbarActions` | `src/hooks/useToolbarActions.ts` | React hook subscribing to toolbar registry |
| `useToolbarOverflow` | `src/hooks/useToolbarOverflow.ts` | Responsive overflow logic |
| `ToolbarButton` | `src/components/toolbar/ToolbarButton.tsx` | Generic toolbar button from registry data |
| `OverflowMenu` | `src/components/toolbar/OverflowMenu.tsx` | Grouped overflow dropdown |
| `DeviceFlowDialog` | `src/components/auth/DeviceFlowDialog.tsx` | OAuth device flow UI (code + polling state) |
| `core-actions.ts` | `src/toolbar/core-actions.ts` | Core toolbar actions migrated from Header |
| `credentials.rs` | `src-tauri/src/credentials.rs` | Rust keychain commands |
| `extensions.rs` | `src-tauri/src/extensions.rs` | Rust manifest reader + validator |
| GitHub extension | `src/extensions/github-integration/` | PR list blade, PR detail blade, issues blade, auth |

### Modified Components

| Component | Modification | Reason |
|-----------|-------------|--------|
| `src/stores/bladeTypes.ts` | Add `ExtensionBladeType`, widen `BladeType` union | Extension blades need runtime-registered types |
| `src/lib/bladeRegistry.ts` | Add `unregisterBlade()`, accept string types | Extension cleanup on unload |
| `src/lib/commandRegistry.ts` | Add `unregisterCommand()`, make `CommandCategory` a `string` | Extension cleanup, extensible categories |
| `src/blades/_shared/BladeRenderer.tsx` | Handle extension blade types gracefully | Extension blades may render before/after load |
| `src/machines/navigation/navigationMachine.ts` | Singleton guard checks extension manifests | Extension blades marked singleton in manifest |
| `src/components/Header.tsx` | Refactor right side to data-driven toolbar | Core + extension actions rendered uniformly |
| `src/blades/_discovery.ts` | Remove hardcoded `EXPECTED_TYPES` or scope to core only | Extension types should not trigger dev warnings |
| `src-tauri/Cargo.toml` | Add `keyring` crate | OS keychain access for token storage |
| `src-tauri/src/lib.rs` | Register credential + extension discovery commands | New IPC endpoints |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Extension Code in Rust

**What:** Implementing extension logic (GitHub API calls, UI rendering) in Rust with IPC for every action.

**Why bad:** GitHub's API surface is huge (PRs, issues, checks, reviews, comments, reactions). Creating a Tauri command for each would be 50+ new Rust functions. Octokit already handles pagination, rate limiting, error handling, and has TypeScript types.

**Instead:** Token storage and extension discovery in Rust (security-sensitive, filesystem access). API calls and UI rendering in JavaScript (where Octokit and React live).

### Anti-Pattern 2: Global Event Bus Without Scoping

**What:** A single `EventEmitter` that extensions and core both publish/subscribe to freely.

**Why bad:** Name collisions, impossible to track which extension subscribed to what, no cleanup on unload.

**Instead:** ExtensionAPI.events provides scoped access. Internal event subscriptions tracked per-extension for guaranteed cleanup.

### Anti-Pattern 3: Extension Code Bundled with Core

**What:** Shipping the GitHub extension as part of the main FlowForge bundle (in `src/blades/github-*`).

**Why bad:** Violates the extension architecture. Cannot be disabled, updated independently, or serve as a template for third-party extensions.

**Instead:** GitHub extension lives in `src/extensions/github-integration/` with its own manifest. Built separately (even if distributed in the same repo during development). This dogfoods the extension API.

### Anti-Pattern 4: Direct Store Mutation from Extensions

**What:** Extensions importing and calling `useRepositoryStore.setState()` directly.

**Why bad:** No cleanup tracking, no access control, extensions can corrupt core state.

**Instead:** ExtensionAPI.stores.create() returns new isolated stores. ExtensionAPI.context provides read-only access to core state.

### Anti-Pattern 5: Toolbar Actions Without Priority/Groups

**What:** Extensions add toolbar buttons that appear in arbitrary positions.

**Why bad:** UX chaos. 10 extensions = 30 random buttons. No overflow handling. Core actions pushed off-screen.

**Instead:** Priority-based ordering (core 0-99, extensions 100+), group-based overflow menu, `when` conditions for contextual visibility.

### Anti-Pattern 6: Storing OAuth Tokens in tauri-plugin-store

**What:** Using the existing `flowforge-settings.json` store for GitHub access tokens.

**Why bad:** `tauri-plugin-store` writes unencrypted JSON to the app data directory. Anyone browsing `~/.config` or `AppData` can read the token. This is a credential leak.

**Instead:** Use the OS keychain (`keyring` crate in Rust) which integrates with macOS Keychain, Windows Credential Manager, and Linux Secret Service.

---

## Scalability Considerations

| Concern | 1-2 Extensions | 10 Extensions | 50+ Extensions |
|---------|---------------|---------------|----------------|
| **Blade registry** | Map lookup O(1), negligible | Same | Same -- Map scales |
| **Toolbar overflow** | All visible | Overflow menu active, grouped | Need collapsible groups or extension toolbar panels |
| **Startup time** | Eager load both | Lazy activation by event | Must implement lazy activation; eager load kills startup |
| **Memory** | Negligible | ~5-10 stores, manageable | Need extension memory budgets or Web Worker isolation |
| **Command palette** | 10-15 extra commands | 50+ commands, need better search | Category filtering becomes essential |
| **Namespace collisions** | `ext:` prefix sufficient | Same | Consider extension manifest validation for unique IDs |

---

## Build Order (Dependency Graph)

```
Phase 1: Extension Infrastructure
    +--> toolbarRegistry (no deps)
    +--> bladeRegistry modifications (unregister, string types)
    +--> commandRegistry modifications (unregister, string categories)
    +--> ExtensionManifest types
    +--> Rust: extensions.rs (read manifests from disk)
    |
    v
Phase 2: Toolbar Refactoring
    +--> Header refactoring (data-driven from toolbarRegistry)
    +--> Core toolbar actions migrated to registry
    +--> ToolbarButton + OverflowMenu components
    +--> useToolbarActions + useToolbarOverflow hooks
    |
    v
Phase 3: Extension Host + API
    +--> ExtensionHost (discover, activate, deactivate)
    +--> ExtensionAPI facade (blades, commands, toolbar, stores, events)
    +--> App.tsx integration (discover on repo open, cleanup on close)
    +--> Navigation FSM singleton guard update
    |
    v
Phase 4: Credential Infrastructure
    +--> Rust: credentials.rs (keyring crate)
    +--> Tauri commands: store/get/delete token
    +--> DeviceFlowDialog component
    |
    v
Phase 5: GitHub Extension
    +--> manifest.json
    +--> OAuth device flow (activate -> onVerification UI)
    +--> GitHub client (Octokit + token from keychain)
    +--> PR list blade + PR detail blade
    +--> Issues blade
    +--> Toolbar contributions (PR badge, etc.)
    |
    v
Phase 6: Polish
    +--> Extension error boundaries
    +--> Extension settings UI (enable/disable)
    +--> GitHub extension: reviews, checks, reactions
```

**Build order rationale:**
1. Registry modifications first -- they are the foundation everything plugs into
2. Toolbar before extension host -- core actions should be data-driven before extensions contribute
3. Extension host before GitHub -- the host must exist before the first extension can load
4. Credentials before GitHub -- the extension needs token storage to authenticate
5. GitHub extension last -- it consumes all prior infrastructure as first real consumer

---

## Sources

### Official Documentation (HIGH confidence)
- [GitHub OAuth Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) -- device flow specification
- [Tauri Plugin Store](https://v2.tauri.app/plugin/store/) -- unencrypted key-value storage (not for tokens)
- [Tauri Stronghold](https://v2.tauri.app/plugin/stronghold/) -- encrypted storage (deprecated for v3)
- [@octokit/auth-oauth-device](https://github.com/octokit/auth-oauth-device.js) -- device flow implementation
- [@octokit/rest](https://github.com/octokit/rest.js) -- GitHub REST API client
- [keyring-rs](https://github.com/open-source-cooperative/keyring-rs) -- cross-platform OS keychain access

### Community and Patterns (MEDIUM confidence)
- [tauri-plugin-keyring](https://github.com/HuakunShen/tauri-plugin-keyring) -- Tauri wrapper for keyring crate
- [GitHub Device Flow example](https://gist.github.com/HuakunShen/ad1884ca725def49d5c17b08a519af8b) -- implementation reference
- [Implementing OAuth in Tauri](https://medium.com/@Joshua_50036/implementing-oauth-in-tauri-3c12c3375e04) -- patterns for desktop OAuth
- [VS Code Extension Architecture](https://dev.to/karrade7/vs-code-extensions-basic-concepts-architecture-b17) -- extension host pattern reference
- [GitHub auth for Tauri apps](https://codereader.dev/blog/github-auth-for-tauri-apps) -- practical Tauri+GitHub OAuth guide

### Codebase Analysis (HIGH confidence)
- `src/lib/bladeRegistry.ts` -- current blade registration API (Map<BladeType, BladeRegistration>)
- `src/lib/commandRegistry.ts` -- current command registration API (Command[], registerCommand/getCommands)
- `src/stores/registry.ts` -- current store reset registry (Set<() => void>)
- `src/stores/bladeTypes.ts` -- BladePropsMap interface, BladeType union, TypedBlade discriminator
- `src/machines/navigation/navigationMachine.ts` -- XState v5 FSM with SINGLETON_TYPES guard
- `src/components/Header.tsx` -- 415-line static toolbar with 16 hardcoded buttons
- `src/blades/_discovery.ts` -- compile-time blade auto-discovery via import.meta.glob
- `src/blades/_shared/BladeRenderer.tsx` -- resolves BladeType to component via registry
- `src-tauri/Cargo.toml` -- reqwest already present, keyring to be added
- `src/lib/store.ts` -- tauri-plugin-store wrapper for settings (unencrypted)
