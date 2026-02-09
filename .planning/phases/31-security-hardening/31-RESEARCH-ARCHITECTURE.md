# Phase 31: Security Hardening - Architecture Research

**Researched:** 2026-02-09
**Domain:** Tauri v2 security model -- CSP, capabilities, asset protocol, extension permission architecture
**Confidence:** HIGH

## Summary

FlowForge's current security posture has three significant gaps that Phase 31 must close before any extension code loads:

1. **No Content-Security-Policy at all.** The `tauri.conf.json` sets `"csp": null`, meaning the WebView has no restrictions on script sources, connection targets, or embedded content. This is the single largest security gap -- any XSS vector could load and execute arbitrary remote scripts.

2. **Wildcard asset protocol scope.** The asset protocol is enabled with `"scope": ["**"]`, which grants the WebView access to read **any file on disk** via `asset://localhost`. Even though no frontend code currently uses `convertFileSrc()` or the asset protocol directly (images are loaded as base64 via IPC), the wildcard scope means a compromised frontend could read arbitrary files.

3. **Overly broad capability permissions.** The `default.json` includes `core:default` which bundles 9 permission sets (app, event, image, menu, path, resources, tray, webview, window). FlowForge does not use menus, trays, or webview creation -- these are unnecessary permissions. Additionally, `core:window:default` is listed twice (once via `core:default`, once explicitly), and several `store:default` permissions (clear, reset, delete) grant more access than needed.

The good news: all three gaps are configuration-only fixes. No Rust code changes are required. The changes are in `tauri.conf.json` (CSP + asset scope) and `capabilities/default.json` (permission audit). The research also identifies an architecture pattern for a future `permissionRegistry` that mirrors the existing `bladeRegistry`/`commandRegistry` patterns, designed to support extension permission declarations.

**Primary recommendation:** Set a strict CSP in `tauri.conf.json`, narrow asset scope to `$APPDATA` and `$RESOURCE` directories, and replace `core:default` with explicit per-module permissions for only the capabilities FlowForge actually uses.

## Standard Stack

### Core

No new libraries needed. Security hardening is entirely configuration-driven.

| Component | Current | Purpose | Status |
|-----------|---------|---------|--------|
| `tauri.conf.json` | v2 schema | CSP and asset protocol config | Needs CSP added, scope narrowed |
| `capabilities/default.json` | Tauri v2 ACL | Permission grants for main window | Needs audit and tightening |
| Tauri `protocol-asset` feature | Enabled in Cargo.toml | Serve local files to WebView | Keep enabled, narrow scope |

### Supporting (Future Extension Permissions)

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| `permissionRegistry` (new) | Track extension-declared permissions | When extension system ships (Phase 33+) |
| Tauri capability composition | Multiple `.json` files in `capabilities/` | When extensions declare their own capabilities |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSP via `tauri.conf.json` | HTML `<meta>` tag in index.html | Tauri's compile-time nonce injection only works with config-based CSP. Meta tag would bypass Tauri's automatic protection. **Use tauri.conf.json.** |
| Isolation pattern | Brownfield pattern (current) | Isolation adds a separate iframe security layer. Overkill for v1.5 where extensions run in-process. Consider for v2.0 if extensions become untrusted third-party code. |
| Single `default.json` | Multiple capability files (e.g., `core.json`, `github.json`) | Multiple files are better for extension architecture. **Start with single file in Phase 31, refactor to multi-file when extensions ship.** |

## Architecture Patterns

### Recommended Security Configuration Structure

```
src-tauri/
  tauri.conf.json             # CSP + asset protocol scope
  capabilities/
    default.json              # Core app permissions (Phase 31)
    # Future (Phase 33+):
    github-extension.json     # GitHub extension permissions
    extension-template.json   # Template for extension capabilities
```

### Pattern 1: Strict CSP for Tauri v2

**What:** Content-Security-Policy that locks down the WebView to only allow self-origin scripts, specific external API endpoints, and Tauri's IPC bridge.

**When to use:** Always. Must be set before any extension code loads.

**Configuration (tauri.conf.json):**

```json
{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self' customprotocol: asset:",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline'",
        "img-src": "'self' asset: http://asset.localhost blob: data: https://avatars.githubusercontent.com",
        "font-src": "'self' data:",
        "connect-src": "ipc: http://ipc.localhost https://api.github.com https://api.nuget.org https://azuresearch-usnc.nuget.org",
        "worker-src": "'self' blob:",
        "object-src": "'none'",
        "base-uri": "'self'",
        "form-action": "'self'",
        "frame-ancestors": "'none'"
      }
    }
  }
}
```

**Why each directive matters:**

| Directive | Value | Rationale |
|-----------|-------|-----------|
| `default-src` | `'self' customprotocol: asset:` | Baseline: only load from app bundle + Tauri protocols |
| `script-src` | `'self'` | **Critical.** Only allow scripts from the app bundle. Tauri auto-injects nonces at compile time. No CDN scripts. |
| `style-src` | `'self' 'unsafe-inline'` | App styles + inline styles (needed by Tailwind and framer-motion) |
| `img-src` | `'self' asset: http://asset.localhost blob: data: https://avatars.githubusercontent.com` | Self, asset protocol, data URIs (base64 images), blob (3D), GitHub avatars |
| `font-src` | `'self' data:` | Bundled fonts only. No external font CDNs. |
| `connect-src` | `ipc: http://ipc.localhost https://api.github.com https://api.nuget.org https://azuresearch-usnc.nuget.org` | Tauri IPC + GitHub API (v1.5) + NuGet API (existing feature) |
| `worker-src` | `'self' blob:` | Monaco editor uses web workers via blob URLs |
| `object-src` | `'none'` | No plugins (Flash, Java applets, etc.) |
| `base-uri` | `'self'` | Prevent base URL hijacking |
| `form-action` | `'self'` | Prevent form submission to external URLs |
| `frame-ancestors` | `'none'` | Prevent framing (not relevant for Tauri but defense in depth) |

**Important:** The Monaco editor CDN URL (`https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs`) currently in `monacoTheme.ts` **must be addressed**. Options:
1. **Bundle Monaco** (preferred): Monaco is already in `node_modules`. Configure Vite to serve it from the bundle instead of CDN. This avoids needing to add a CDN to `script-src`.
2. **Add CDN to CSP**: Add `https://cdn.jsdelivr.net` to `script-src`. This is less secure because it allows loading any script from jsdelivr.

**Source:** [Tauri v2 CSP documentation](https://v2.tauri.app/security/csp/), [Tauri v2 SecurityConfig reference](https://v2.tauri.app/reference/config/)

### Pattern 2: Narrowed Asset Protocol Scope

**What:** Replace `"scope": ["**"]` with specific allowed directories.

**When to use:** Whenever the asset protocol is enabled.

**Current state analysis:**
- Asset protocol is enabled via `protocol-asset` Cargo feature
- `scope: ["**"]` grants access to ALL files on the filesystem
- **No frontend code currently uses `convertFileSrc()` or `asset://` URLs**
- Images are loaded via base64 through Tauri IPC commands (`getFileBase64`, `getCommitFileBase64`)

**Options:**

| Option | Scope | Security | Impact |
|--------|-------|----------|--------|
| **A: Disable entirely** | Remove `protocol-asset` feature, set `enable: false` | Best | Must verify no implicit usage; 3D viewer blob URLs still work |
| **B: Narrow to app dirs** | `["$APPDATA/**", "$RESOURCE/**"]` | Good | Covers app data and bundled resources only |
| **C: Keep wildcard** | `["**"]` | Bad | Full filesystem read access from WebView |

**Recommendation:** Option A (disable entirely) if testing confirms no breakage. Fallback to Option B.

```json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": false,
        "scope": []
      }
    }
  }
}
```

Or if asset protocol is needed:

```json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": ["$RESOURCE/**"]
      }
    }
  }
}
```

**Source:** [Tauri v2 AssetProtocolConfig](https://v2.tauri.app/reference/config/), [Tauri v2 Command Scopes](https://v2.tauri.app/security/scope/)

### Pattern 3: Minimal Capability Permissions

**What:** Replace broad `core:default` with explicit per-module grants.

**Current `default.json`:**

```json
{
  "permissions": [
    "core:default",           // Bundles: app, event, image, menu, path, resources, tray, webview, window
    "opener:default",         // open-url, reveal-item-in-dir, default-urls
    "dialog:default",         // ask, confirm, message, save, open
    "store:default",          // ALL store operations including clear, delete, reset
    "core:window:default",    // DUPLICATE - already included in core:default
    "window-state:default"    // filename, restore-state, save-window-state
  ]
}
```

**Audit findings:**

| Permission | Used? | Verdict |
|------------|-------|---------|
| `core:app:default` | YES (version, name, tauri-version) | KEEP |
| `core:event:default` | YES (emit, listen for IPC events) | KEEP |
| `core:image:default` | NO (images loaded via IPC base64) | REMOVE |
| `core:menu:default` | NO (no native menus used) | REMOVE |
| `core:path:default` | YES (path resolution utilities) | KEEP |
| `core:resources:default` | YES (resource cleanup) | KEEP |
| `core:tray:default` | NO (no system tray) | REMOVE |
| `core:webview:default` | PARTIAL (only internal-toggle-devtools in dev) | NARROW |
| `core:window:default` | YES (window state queries) | KEEP |
| `dialog:default` | YES (open directory dialog for repo) | KEEP |
| `opener:default` | YES (open URLs, reveal in file manager) | KEEP |
| `store:default` | PARTIAL (only need get, set, load, save, has) | NARROW |
| `window-state:default` | YES (save/restore window position) | KEEP |

**Recommended `default.json`:**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Minimum capabilities for FlowForge core features",
  "windows": ["main"],
  "permissions": [
    "core:app:default",
    "core:event:default",
    "core:path:default",
    "core:resources:default",
    "core:window:default",
    "core:webview:allow-internal-toggle-devtools",
    "core:webview:allow-get-all-webviews",
    "core:webview:allow-webview-position",
    "core:webview:allow-webview-size",
    "opener:default",
    "dialog:default",
    "store:allow-load",
    "store:allow-get-store",
    "store:allow-set",
    "store:allow-get",
    "store:allow-has",
    "store:allow-keys",
    "store:allow-values",
    "store:allow-entries",
    "store:allow-length",
    "store:allow-save",
    "window-state:default"
  ]
}
```

**What was removed:** `core:image:default`, `core:menu:default`, `core:tray:default`, duplicate `core:window:default`, broad `store:default` (replaced with specific operations). `store:allow-clear`, `store:allow-delete`, `store:allow-reset`, `store:allow-reload` removed as they are destructive and not needed.

**Source:** [Tauri v2 Core Permissions](https://v2.tauri.app/reference/acl/core-permissions/), [Tauri v2 Capabilities](https://v2.tauri.app/security/capabilities/)

### Pattern 4: Extension Permission Registry (Future-Proofing)

**What:** A `permissionRegistry` pattern that mirrors `bladeRegistry` and `commandRegistry`, designed so extensions can declare required permissions in their manifest and the extension host validates them.

**When to use:** Phase 33+ (Extension System Core). Documented here for architecture alignment.

**How it connects to existing patterns:**

```
bladeRegistry:    register(BladeRegistration)   -> Map<BladeType, BladeRegistration>
commandRegistry:  register(Command)             -> Command[]
permissionRegistry: register(PermissionGrant)   -> Map<ExtensionId, PermissionGrant[]>
```

**Architecture:**

```typescript
// src/lib/permissionRegistry.ts

/** Permission categories that extensions can request */
type PermissionCategory =
  | "network"        // connect-src additions (e.g., GitHub API)
  | "blade"          // register blades
  | "command"        // register commands
  | "toolbar"        // register toolbar items
  | "settings"       // read/write extension settings
  | "repo-context"   // access repo path, remotes, current branch
  | "ipc-command";   // invoke specific Tauri commands

interface PermissionGrant {
  id: string;                    // e.g., "network:api.github.com"
  category: PermissionCategory;
  scope?: string;               // category-specific scope (URL pattern, command name)
  description: string;          // Human-readable explanation
}

interface ExtensionPermissions {
  extensionId: string;
  declared: PermissionGrant[];   // From manifest
  granted: PermissionGrant[];    // Approved by user/policy
  denied: PermissionGrant[];     // Rejected
}

const registry = new Map<string, ExtensionPermissions>();

export function declarePermissions(
  extensionId: string,
  permissions: PermissionGrant[]
): void {
  registry.set(extensionId, {
    extensionId,
    declared: permissions,
    granted: [],
    denied: [],
  });
}

export function grantPermission(extensionId: string, permissionId: string): boolean { ... }
export function checkPermission(extensionId: string, permissionId: string): boolean { ... }
export function getExtensionPermissions(extensionId: string): ExtensionPermissions | undefined { ... }
export function clearPermissions(extensionId: string): void { ... }
```

**How extension manifests declare permissions:**

```json
{
  "name": "github-integration",
  "permissions": [
    {
      "id": "network:api.github.com",
      "category": "network",
      "scope": "https://api.github.com/*",
      "description": "Access GitHub API to fetch PRs and issues"
    },
    {
      "id": "blade:github-prs",
      "category": "blade",
      "description": "Register Pull Requests blade"
    },
    {
      "id": "command:github.viewPRs",
      "category": "command",
      "description": "Register GitHub command palette entries"
    },
    {
      "id": "repo-context:remotes",
      "category": "repo-context",
      "description": "Read repository remote URLs to detect GitHub repos"
    }
  ]
}
```

**How the extension host validates permissions:**

```typescript
function createExtensionAPI(extensionId: string): ExtensionAPI {
  return {
    registerBlade: (config) => {
      if (!checkPermission(extensionId, `blade:${config.type}`)) {
        throw new Error(`Extension ${extensionId} lacks blade permission for ${config.type}`);
      }
      const prefixedConfig = { ...config, type: `ext:${extensionId}:${config.type}` };
      return registerBlade(prefixedConfig);
    },
    // ... similar guards for commands, toolbar items
  };
}
```

**How security policies compose (core + extension):**

```
Core CSP (tauri.conf.json):
  connect-src: ipc: http://ipc.localhost

Extension "github-integration" manifest requests:
  network scope: https://api.github.com/*

Extension host validates:
  1. Is "network:api.github.com" in the extension's granted permissions? YES
  2. Add to runtime connect-src whitelist

Result: Extension API calls to api.github.com are allowed.
Non-whitelisted domains are blocked by CSP.
```

**Important architectural note:** Tauri's CSP is set at compile time and cannot be dynamically modified. The extension permission system works at the **application layer** -- it controls what the ExtensionAPI allows, not what the browser CSP allows. For v1.5, all known API domains (GitHub, NuGet) are pre-configured in the CSP. For a future dynamic extension ecosystem, the CSP would need to include all domains that any installed extension might need, or use a proxy pattern where extensions make API calls through a Rust-side proxy command.

### Pattern 5: Capability File Per Extension (Future)

**What:** Each extension gets its own capability JSON file, allowing Tauri's ACL system to enforce extension-specific permissions.

**When to use:** When extensions need to invoke Tauri commands (Phase 35+).

```json
// src-tauri/capabilities/github-extension.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "github-extension",
  "description": "Capabilities for GitHub integration extension",
  "windows": ["main"],
  "permissions": [
    "opener:allow-open-url",
    {
      "identifier": "opener:allow-default-urls",
      "allow": [
        { "url": "https://github.com/*" }
      ]
    }
  ]
}
```

**How new capability scopes can be added without modifying core config:**
- Each extension ships its own capability file
- Tauri merges all capability files in `src-tauri/capabilities/` at build time
- Core `default.json` is never modified -- new permissions are additive in separate files
- The `tauri.conf.json` `security.capabilities` array can selectively include/exclude capability files

### Anti-Patterns to Avoid

- **Anti-Pattern: CSP via HTML meta tag.** Tauri's automatic nonce/hash injection at compile time only works with config-based CSP. Using `<meta http-equiv="Content-Security-Policy">` in `index.html` would bypass Tauri's protection layer entirely.

- **Anti-Pattern: Using `dangerousDisableAssetCspModification`.** This flag exists to disable Tauri's automatic CSP nonce/hash injection. Disabling it removes a critical security layer. Only use if you fully understand CSP nonce mechanics and have a custom solution.

- **Anti-Pattern: Wildcard capability permissions.** Using `"permissions": ["*"]` or giving extensions `core:default` access. Extensions should declare minimum permissions in their manifest, and the host should grant only what's declared.

- **Anti-Pattern: Dynamic CSP modification at runtime.** Tauri CSP is compile-time. Attempting to modify it at runtime via JavaScript won't work and gives false security. Use application-layer permission checks instead.

- **Anti-Pattern: Asset protocol for file content display.** The codebase correctly uses IPC commands to load file content as base64. Using `convertFileSrc()` with the asset protocol would require broad scope and bypass IPC-level validation. Continue using the IPC pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSP enforcement | Custom middleware/interceptors | Tauri's built-in CSP config | Tauri auto-injects nonces/hashes at compile time |
| Permission validation | Runtime CSP modification | Tauri capabilities + app-layer permission checks | CSP is compile-time; Tauri ACL handles Rust-side |
| Script integrity | Custom hash verification | Tauri's automatic nonce injection | Compile-time injection covers all bundled scripts |
| Scope enforcement | Custom path validation | Tauri's scope system (allow/deny patterns) | Built-in glob matching, path variable resolution |

**Key insight:** Tauri v2's security model has three layers (CSP, capabilities, scopes) that work together at compile time. The only custom code needed is the application-layer `permissionRegistry` for extension permissions, which operates above Tauri's security layer.

## Common Pitfalls

### Pitfall 1: Monaco Editor CDN Breaks CSP

**What goes wrong:** Setting strict `script-src: 'self'` blocks Monaco editor if it loads from jsdelivr CDN.
**Why it happens:** `src/lib/monacoTheme.ts` configures Monaco loader to use `https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs`.
**How to avoid:** Bundle Monaco from `node_modules` instead of CDN. The `@monaco-editor/react` package supports this via loader configuration pointing to local assets. Alternatively, Vite can be configured to serve Monaco from the build output.
**Warning signs:** Blank diff viewer, console errors about CSP violations for `script-src`.

### Pitfall 2: NuGet API Fetch Blocked by CSP

**What goes wrong:** NuGet package viewer stops loading package metadata after CSP is set.
**Why it happens:** `NugetPackageViewer.tsx` uses `fetch()` to call `https://azuresearch-usnc.nuget.org` and `https://api.nuget.org`. These must be in `connect-src`.
**How to avoid:** Include both NuGet API domains in the CSP `connect-src` directive.
**Warning signs:** NuGet package viewer shows "Failed to load" errors.

### Pitfall 3: Tauri IPC Broken by CSP

**What goes wrong:** All Tauri commands fail after CSP is set.
**Why it happens:** Missing `ipc: http://ipc.localhost` in `connect-src`.
**How to avoid:** Always include `ipc: http://ipc.localhost` in `connect-src`. This is required for the Tauri IPC bridge.
**Warning signs:** All backend operations fail, console shows CSP violations for IPC calls.

### Pitfall 4: Inline Styles Blocked

**What goes wrong:** Tailwind CSS utility classes and framer-motion animations break.
**Why it happens:** Missing `'unsafe-inline'` in `style-src`. Tailwind and framer-motion inject inline styles.
**How to avoid:** Include `'unsafe-inline'` in `style-src`. This is a known tradeoff -- Tauri's nonce injection covers scripts but not styles.
**Warning signs:** UI renders unstyled or with broken layouts.

### Pitfall 5: Removing Capabilities Breaks Existing Features

**What goes wrong:** Removing `core:menu:default` or other permissions breaks features you didn't know used them.
**Why it happens:** Some Tauri features use permissions implicitly (e.g., context menus, drag-and-drop).
**How to avoid:** Test each removal individually. Check console for permission denied errors. Keep a known-working configuration to roll back to.
**Warning signs:** Right-click context menus stop working, window state doesn't save, dialogs fail to open.

### Pitfall 6: `dev_csp` vs Production CSP Divergence

**What goes wrong:** App works in development but security errors appear in production builds (or vice versa).
**Why it happens:** Tauri uses `csp` for production and `dev_csp` for development. If only `csp` is set, it applies to both. If `dev_csp` is set separately, the two configurations can drift.
**How to avoid:** Use only `csp` (not `dev_csp`) for Phase 31. This ensures identical security policy in dev and production. If dev-specific relaxation is needed later, set `dev_csp` explicitly and document the differences.
**Warning signs:** Features work in dev but fail in production builds.

## Code Examples

### Example 1: Complete Hardened `tauri.conf.json` Security Section

```json
{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self' customprotocol: asset:",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline'",
        "img-src": "'self' asset: http://asset.localhost blob: data: https://avatars.githubusercontent.com",
        "font-src": "'self' data:",
        "connect-src": "ipc: http://ipc.localhost https://api.github.com https://api.nuget.org https://azuresearch-usnc.nuget.org",
        "worker-src": "'self' blob:",
        "object-src": "'none'",
        "base-uri": "'self'",
        "form-action": "'self'",
        "frame-ancestors": "'none'"
      },
      "assetProtocol": {
        "enable": false,
        "scope": []
      },
      "freezePrototype": true
    }
  }
}
```

Note: `freezePrototype: true` is an additional defense -- it freezes `Object.prototype` when using custom protocol, preventing prototype pollution attacks.

### Example 2: Hardened `default.json` Capabilities

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Minimum capabilities for FlowForge core features",
  "windows": ["main"],
  "permissions": [
    "core:app:default",
    "core:event:default",
    "core:path:default",
    "core:resources:default",
    "core:window:default",
    "core:webview:allow-internal-toggle-devtools",
    "core:webview:allow-get-all-webviews",
    "core:webview:allow-webview-position",
    "core:webview:allow-webview-size",
    "opener:default",
    "dialog:default",
    "store:allow-load",
    "store:allow-get-store",
    "store:allow-set",
    "store:allow-get",
    "store:allow-has",
    "store:allow-keys",
    "store:allow-values",
    "store:allow-entries",
    "store:allow-length",
    "store:allow-save",
    "window-state:default"
  ]
}
```

### Example 3: Monaco Editor Local Bundle Configuration

```typescript
// src/lib/monacoTheme.ts -- BEFORE (CDN, blocked by CSP)
loader.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs",
  },
});

// src/lib/monacoTheme.ts -- AFTER (local bundle, CSP-safe)
import * as monaco from "monaco-editor";
loader.config({ monaco });
// OR
loader.config({
  paths: {
    vs: "/node_modules/monaco-editor/min/vs",
  },
});
```

### Example 4: Permission Registry Skeleton (for Extension System)

```typescript
// src/lib/permissionRegistry.ts

type PermissionCategory = "network" | "blade" | "command" | "toolbar" | "settings" | "repo-context";

interface PermissionGrant {
  id: string;
  category: PermissionCategory;
  scope?: string;
  description: string;
}

interface ExtensionPermissions {
  extensionId: string;
  declared: PermissionGrant[];
  granted: PermissionGrant[];
}

const registry = new Map<string, ExtensionPermissions>();

export function declarePermissions(extensionId: string, permissions: PermissionGrant[]): void {
  registry.set(extensionId, { extensionId, declared: permissions, granted: [] });
}

export function grantAll(extensionId: string): void {
  const ext = registry.get(extensionId);
  if (ext) ext.granted = [...ext.declared];
}

export function checkPermission(extensionId: string, permissionId: string): boolean {
  const ext = registry.get(extensionId);
  return ext?.granted.some((p) => p.id === permissionId) ?? false;
}

export function clearPermissions(extensionId: string): void {
  registry.delete(extensionId);
}
```

## State of the Art

| Old Approach (Tauri v1) | Current Approach (Tauri v2) | When Changed | Impact |
|--------------------------|----------------------------|--------------|--------|
| Allowlist in `tauri.conf.json` | Capability + Permission ACL system | Tauri v2 (2024) | Fine-grained per-window, per-command access control |
| Global API access for all windows | Window-specific capabilities | Tauri v2 (2024) | Each window/webview can have different permissions |
| No scope system | Allow/Deny scope patterns | Tauri v2 (2024) | Path and URL filtering for commands |
| CSP as single string | CSP as directive map (object format) | Tauri v2 (2024) | Easier to compose and modify individual directives |

**Deprecated/outdated:**
- `tauri.allowlist` (Tauri v1): Replaced by capability files in `src-tauri/capabilities/`
- `dangerousRemoteUrlIpcAccess` (deprecated): Use `remote` in capability files instead

## Open Questions

1. **Can `protocol-asset` Cargo feature be removed entirely?**
   - What we know: No frontend code uses `convertFileSrc()` or `asset://` URLs. Images use base64 via IPC. 3D viewer uses blob URLs.
   - What's unclear: Whether any Tauri internal functionality depends on the asset protocol being enabled (e.g., loading bundled icons).
   - Recommendation: Test with `enable: false` in tauri.conf.json first (keeps the Cargo feature but disables runtime use). If that works, also remove from Cargo.toml features in a follow-up.

2. **Does Monaco editor work when loaded from bundle instead of CDN?**
   - What we know: `@monaco-editor/react` supports local Monaco via `loader.config({ monaco })` pattern. The package is in `node_modules`.
   - What's unclear: Whether Vite's build correctly bundles all Monaco workers and language support files.
   - Recommendation: Test bundled Monaco before enforcing strict `script-src`. This is a potential blocker that should be resolved early in Phase 31.

3. **Will `store:allow-reload` be needed?**
   - What we know: Removed it as potentially unnecessary. The current codebase uses `load`, `get`, `set`, `save`.
   - What's unclear: Whether `tauri-plugin-store` uses `reload` internally for file watching or hot reload.
   - Recommendation: Test without `reload`. Add back only if store functionality breaks.

4. **Extension CSP composition at scale**
   - What we know: Tauri CSP is compile-time, so it cannot be dynamically extended at runtime when extensions install.
   - What's unclear: How to handle a future extension ecosystem where extensions need to connect to arbitrary API servers.
   - Recommendation: For v1.5 (first-party extensions only), hardcode all API domains in CSP. For v2.0+, consider a Rust-side HTTP proxy command that extensions call instead of direct `fetch()`, allowing the proxy to enforce URL allowlisting at the application layer.

## Sources

### Primary (HIGH confidence)
- [Tauri v2 CSP Documentation](https://v2.tauri.app/security/csp/) -- CSP directives, auto-nonce injection, configuration format
- [Tauri v2 SecurityConfig Reference](https://v2.tauri.app/reference/config/) -- Full config schema for security section
- [Tauri v2 Capabilities](https://v2.tauri.app/security/capabilities/) -- Capability file structure, window binding, composition
- [Tauri v2 Permissions](https://v2.tauri.app/security/permissions/) -- Permission identifier format, scope rules
- [Tauri v2 Core Permissions Reference](https://v2.tauri.app/reference/acl/core-permissions/) -- Complete list of core:default sub-permissions
- [Tauri v2 Command Scopes](https://v2.tauri.app/security/scope/) -- Allow/deny rules, glob patterns, scope composition
- [Tauri v2 Writing Plugin Permissions](https://v2.tauri.app/learn/security/writing-plugin-permissions/) -- Auto-generated permissions, permission sets
- [Tauri v2 Security Overview](https://v2.tauri.app/security/) -- Trust boundary model, threat vectors

### Codebase Analysis (HIGH confidence)
- `/Users/phmatray/Repositories/github-phm/FlowForge/src-tauri/tauri.conf.json` -- Current CSP: null, asset scope: ["**"]
- `/Users/phmatray/Repositories/github-phm/FlowForge/src-tauri/capabilities/default.json` -- Current permissions with duplicates and broad grants
- `/Users/phmatray/Repositories/github-phm/FlowForge/src-tauri/gen/schemas/acl-manifests.json` -- Full plugin permission manifests
- `/Users/phmatray/Repositories/github-phm/FlowForge/src-tauri/Cargo.toml` -- protocol-asset feature enabled
- `/Users/phmatray/Repositories/github-phm/FlowForge/src/lib/monacoTheme.ts` -- Monaco CDN URL that conflicts with strict CSP
- `/Users/phmatray/Repositories/github-phm/FlowForge/src/components/viewers/NugetPackageViewer.tsx` -- NuGet API domains for connect-src
- `/Users/phmatray/Repositories/github-phm/FlowForge/src/lib/bladeRegistry.ts` -- Registry pattern for extension architecture reference
- `/Users/phmatray/Repositories/github-phm/FlowForge/src/lib/commandRegistry.ts` -- Registry pattern for extension architecture reference
- `/Users/phmatray/Repositories/github-phm/FlowForge/.planning/research/v1.5.0-ARCHITECTURE.md` -- Extension system architecture context

## Metadata

**Confidence breakdown:**
- CSP configuration: HIGH -- Verified against Tauri v2 official docs and codebase analysis
- Asset protocol scope: HIGH -- Confirmed via codebase grep that asset protocol is unused in frontend
- Capability audit: HIGH -- Cross-referenced ACL manifests with codebase feature usage
- Extension permission architecture: MEDIUM -- Pattern follows existing registries but untested; aligns with v1.5 architecture research
- Monaco CDN migration: MEDIUM -- Known pattern from @monaco-editor/react docs, but Vite bundling specifics need testing

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (stable Tauri v2 config, unlikely to change)
