# Phase 13: Navigation - Research

**Researched:** 2026-02-06
**Domain:** Top-bar navigation UI (repository and branch switchers)
**Confidence:** HIGH

## Summary

Phase 13 adds repository and branch switching to the existing header bar. The codebase already has most of the building blocks: a `Header.tsx` component, Zustand stores for repository/branch state, a `useRecentRepos` hook with Tauri Store persistence, framer-motion for animations, and a toast notification system. The primary work is building two slide-down dropdown panels (repo switcher and branch switcher), adding persistence for pinned repos and recently-checked-out branches, and extending the Rust backend to support listing remote branches and checking out remote branches as local tracking branches.

The codebase follows a consistent pattern: Zustand stores for state, Tauri commands for git operations, framer-motion for animations, lucide-react for icons, and Tailwind CSS with Catppuccin tokens for styling. This phase should follow those same patterns exactly.

**Primary recommendation:** Build two new components (`RepoSwitcher` and `BranchSwitcher`) as pill-shaped buttons in the header, each with a slide-down panel powered by framer-motion's `AnimatePresence`. Add a new `useNavigationStore` Zustand store for pinned repos and recent branch history. Extend the Rust backend with `list_all_branches(include_remote: bool)` and `checkout_remote_branch(name)` commands.

## Standard Stack

The established libraries/tools for this domain:

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.4 | UI framework | Already in use |
| zustand | ^5 | State management | All stores use this pattern |
| framer-motion | ^12.31.0 | Animations (slide-down panels) | Already used for toasts, sidebar, animations |
| lucide-react | ^0.563 | Icons (GitBranch, ChevronDown, Pin, Search, etc.) | Already used everywhere |
| @tauri-apps/plugin-store | ^2 | Persistent settings (pinned repos, recent branches) | Already used via `src/lib/store.ts` |
| class-variance-authority | ^0.7.1 | Variant-based component styling | Used in Button, Input, Dialog |
| tailwind-merge + clsx | ^3.4.0 / ^2.1.1 | Class merging via `cn()` utility | Used in every component |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcuts for dropdown toggle | Already used in `useKeyboardShortcuts.ts` |

### No New Dependencies
No new npm packages are needed. Everything required is already in the dependency tree.

## Architecture Patterns

### Recommended New File Structure
```
src/
├── components/
│   ├── navigation/
│   │   ├── RepoSwitcher.tsx          # Repo pill button + slide-down panel
│   │   ├── RepoSwitcherItem.tsx      # Individual repo entry in dropdown
│   │   ├── BranchSwitcher.tsx        # Branch pill button + slide-down panel
│   │   ├── BranchSwitcherItem.tsx    # Individual branch entry in dropdown
│   │   └── SwitcherSearch.tsx        # Reusable search field for dropdowns
│   └── Header.tsx                     # Modified to integrate switchers
├── stores/
│   └── navigation.ts                  # Pinned repos + recent branches + panel state
└── hooks/
    └── useClickOutside.ts             # Reusable hook (extracted pattern)
```

### Pattern 1: Slide-Down Panel with AnimatePresence
**What:** Dropdown panels that slide down from the header, anchored to their trigger pill.
**When to use:** Both repo and branch switcher dropdowns.
**Example:**
```typescript
// Source: Existing codebase pattern (CollapsibleSidebar.tsx, Toast.tsx)
import { motion, AnimatePresence } from "framer-motion";

const slideDown = {
  hidden: { opacity: 0, height: 0, overflow: "hidden" },
  show: {
    opacity: 1,
    height: "auto",
    overflow: "hidden",
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    height: 0,
    overflow: "hidden",
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

function DropdownPanel({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          variants={slideDown}
          initial="hidden"
          animate="show"
          exit="exit"
          className="absolute top-full left-0 right-0 z-40 bg-ctp-mantle border border-ctp-surface0 rounded-b-lg shadow-lg"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Pattern 2: Pill/Block Trigger Button (GitHub Desktop Style)
**What:** Subtle label-like buttons that reveal a chevron on hover.
**When to use:** Repo and branch triggers in the header.
**Example:**
```typescript
// Follows existing Button component pattern with ghost variant
function SwitcherPill({ icon: Icon, label, sublabel, isOpen, onClick }: SwitcherPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors",
        "hover:bg-ctp-surface0",
        isOpen && "bg-ctp-surface0"
      )}
    >
      <Icon className="w-4 h-4 text-ctp-subtext0" />
      <div className="text-left">
        <span className="text-sm font-medium text-ctp-text">{label}</span>
        {sublabel && <span className="text-xs text-ctp-overlay0 ml-1">{sublabel}</span>}
      </div>
      <ChevronDown className={cn(
        "w-3 h-3 text-ctp-overlay0 opacity-0 group-hover:opacity-100 transition-opacity",
        isOpen && "opacity-100 rotate-180"
      )} />
    </button>
  );
}
```

### Pattern 3: Zustand Store for Navigation State
**What:** Central store for pinned repos, recent branches per repo, and panel open/close state.
**When to use:** Persistent navigation preferences.
**Example:**
```typescript
// Follows existing store pattern (repository.ts, settings.ts)
import { create } from "zustand";
import { getStore } from "../lib/store";

interface NavigationState {
  // Panel state (not persisted)
  repoDropdownOpen: boolean;
  branchDropdownOpen: boolean;

  // Persisted state
  pinnedRepoPaths: string[];
  recentBranchesPerRepo: Record<string, string[]>; // repoPath -> branch names

  // Actions
  openRepoDropdown: () => void;
  closePanels: () => void;
  toggleRepoDropdown: () => void;
  toggleBranchDropdown: () => void;
  pinRepo: (path: string) => Promise<void>;
  unpinRepo: (path: string) => Promise<void>;
  addRecentBranch: (repoPath: string, branchName: string) => Promise<void>;
  getRecentBranches: (repoPath: string) => string[];
  lastActiveBranchPerRepo: Record<string, string>; // repoPath -> branchName
  setLastActiveBranch: (repoPath: string, branchName: string) => Promise<void>;
  initNavigation: () => Promise<void>;
}
```

### Pattern 4: Stash-and-Switch Flow
**What:** When switching branch/repo with dirty working tree, show a confirmation dialog before stashing.
**When to use:** Branch checkout and repo switching when `status.isDirty` is true.
**Example:**
```typescript
// Orchestrated in the component, using existing stores
const handleBranchSwitch = async (branchName: string) => {
  if (status?.isDirty) {
    // Show stash confirmation dialog
    setStashConfirmation({ targetBranch: branchName });
    return;
  }
  await performSwitch(branchName);
};

const handleStashAndSwitch = async () => {
  await stashStore.saveStash("Auto-stash before switching to " + targetBranch, true);
  await performSwitch(targetBranch);
};
```

### Pattern 5: Click-Outside Dismissal
**What:** Close dropdown panels when clicking outside.
**When to use:** Both switcher panels.
**Example:**
```typescript
// Pattern already used in ScopeAutocomplete.tsx
useEffect(() => {
  if (!isOpen) return;
  const handleClickOutside = (e: MouseEvent) => {
    if (!containerRef.current?.contains(e.target as Node)) {
      closePanels();
    }
  };
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, [isOpen, closePanels]);
```

### Anti-Patterns to Avoid
- **Floating popovers:** Decision says slide-down panels (like GitHub Desktop), NOT floating dropdowns. The panel should be anchored to the full width of the pill, sliding down from it.
- **Creating new repo opening flow in the switcher:** Decision says no "Open repository..." action in the dropdown. Switcher only works with known repos.
- **Separate header bar:** Decision says integrate into existing header, not add a second bar.
- **Custom scroll implementation:** Use native overflow-y-auto with max-height, not virtual scrolling (branch lists are small enough).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistent state | Custom file read/write | `@tauri-apps/plugin-store` via `getStore()` | Already established pattern in `useRecentRepos.ts` and `settings.ts` |
| Toast notifications | Custom notification system | `toast.success()` from `stores/toast.ts` | Already built in Phase 11, tested and consistent |
| Animation variants | CSS keyframes or custom animation code | framer-motion `AnimatePresence` + `motion.div` | Already used throughout codebase (CollapsibleSidebar, Toast, FadeIn) |
| Click-outside detection | Custom event system | `useEffect` + `document.addEventListener("mousedown", ...)` | Pattern already established in ScopeAutocomplete.tsx |
| Search/filter input | Custom search component | Adapt `FileTreeSearch.tsx` pattern (Search icon + X clear button + input) | Already built, consistent UI |
| Icon library | Custom SVGs | lucide-react (GitBranch, Pin, ChevronDown, Search, FolderGit, etc.) | Already used everywhere |
| Button variants | Custom button styles | `Button` component from `ui/button.tsx` with `ghost` variant | Already built with cva |
| Class merging | Manual string concatenation | `cn()` from `lib/utils.ts` | Used in every component |
| Keyboard shortcuts | Custom key event handling | `react-hotkeys-hook` via `useHotkeys` | Already used in `useKeyboardShortcuts.ts` |

**Key insight:** This phase is primarily UI composition work. All the primitives already exist in the codebase. The new code is wiring them together into two new dropdown components.

## Common Pitfalls

### Pitfall 1: Panel Z-Index Conflicts
**What goes wrong:** Dropdown panels render behind other content (diff viewer, Monaco editor, sidebar).
**Why it happens:** The header is `z-50` but panels need to layer properly.
**How to avoid:** Dropdown panels should be `z-40` and render inside the header's DOM tree (below the header bar, above main content). The header itself is `sticky top-0 z-50`.
**Warning signs:** Panel appears but is clipped or behind other elements.

### Pitfall 2: Stale Branch List After Switch
**What goes wrong:** After switching branches, the branch dropdown still shows old isHead state.
**Why it happens:** `loadBranches()` in the branch store is not called after checkout.
**How to avoid:** The existing `checkoutBranch` in `useBranchStore` already calls `loadBranches()` after checkout. Also call `refreshStatus()` from `useRepositoryStore` to update the header's branch name display. The existing file watcher event (`repository-changed`) also triggers query invalidation.
**Warning signs:** Branch badge shows old name, dropdown shows wrong head indicator.

### Pitfall 3: Race Condition on Repo Switch
**What goes wrong:** Switching repos triggers `closeRepository()` + `openRepository()`, and intermediate state causes component errors.
**Why it happens:** `status` goes to `null` between close and open, causing re-render to WelcomeView.
**How to avoid:** Perform repo switch as a single atomic action: do NOT close first, then open. Instead, call `openRepository(newPath)` directly (it will internally replace the repo state). The existing `openRepository` sets `status` in one `set()` call.
**Warning signs:** Flash of WelcomeView when switching repos.

### Pitfall 4: Search Input Focus Stealing
**What goes wrong:** Opening a dropdown with a search field steals focus from an ongoing commit message or diff selection.
**Why it happens:** Auto-focusing the search input on panel open.
**How to avoid:** Auto-focus the search input ONLY when the panel opens, and restore focus to the previous element when it closes. Use `useRef` to track the previously focused element.
**Warning signs:** User loses cursor position in commit form when accidentally hovering over header.

### Pitfall 5: Pinned Repos Persistence Sync
**What goes wrong:** Pinned repos don't persist across app restarts, or get out of sync.
**Why it happens:** Forgetting to call `store.save()` after `store.set()`.
**How to avoid:** The Tauri Store plugin supports `autoSave: true` (100ms debounce). Alternatively, call `store.save()` explicitly after each write, like the settings store does.
**Warning signs:** Pinned repos disappear after app restart.

### Pitfall 6: Remote Branch Checkout Creates Duplicate Local Branches
**What goes wrong:** Checking out `origin/feature/x` creates `feature/x` but a local `feature/x` already exists.
**Why it happens:** Not checking if a local branch with the same name exists before creating a tracking branch.
**How to avoid:** In the Rust backend's `checkout_remote_branch` command, first check for existing local branch. If it exists, just check it out. If not, create new tracking branch.
**Warning signs:** Error about branch already existing when user clicks a remote branch.

### Pitfall 7: Panel Doesn't Close on Route/Action
**What goes wrong:** After switching repo or branch, the dropdown stays open.
**Why it happens:** Forgetting to call `closePanels()` after a successful switch action.
**How to avoid:** Every switch action should close the panel as part of its success flow.
**Warning signs:** User has to manually close the panel after every switch.

## Code Examples

Verified patterns from the existing codebase:

### Opening a Repository (from RecentRepos.tsx)
```typescript
// Source: src/components/RecentRepos.tsx
const handleOpen = async (repo: RecentRepo) => {
  try {
    await openRepository(repo.path);
    await addRecentRepo(repo.path, repo.name);
    onRepoOpened?.();
  } catch (e) {
    console.error("Failed to open recent repo:", e);
  }
};
```

### Checking Out a Branch (from BranchList.tsx)
```typescript
// Source: src/stores/branches.ts
checkoutBranch: async (name) => {
  set({ isLoading: true, error: null });
  const result = await commands.checkoutBranch(name);
  if (result.status === "ok") {
    await get().loadBranches(); // Refreshes branch list after checkout
    return true;
  }
  set({ error: getErrorMessage(result.error), isLoading: false });
  return false;
},
```

### Stashing Changes (from stash store)
```typescript
// Source: src/stores/stash.ts
saveStash: async (message, includeUntracked) => {
  set({ isLoading: true, error: null });
  const result = await commands.stashSave(message, includeUntracked);
  if (result.status === "ok") {
    await get().loadStashes();
    return true;
  }
  set({ error: getErrorMessage(result.error), isLoading: false });
  return false;
},
```

### Persisting Data with Tauri Store
```typescript
// Source: src/hooks/useRecentRepos.ts + src/stores/settings.ts
import { getStore } from "../lib/store";

// Read
const store = await getStore();
const data = await store.get<PinnedRepos>("pinned-repos");

// Write
await store.set("pinned-repos", updated);
await store.save(); // Explicit save for reliability
```

### Toast Notification
```typescript
// Source: src/stores/toast.ts
import { toast } from "../stores/toast";

toast.success("Switched to RepoName");
toast.info("Switched to branch feature/login");
```

### Search/Filter Pattern (from FileTreeSearch.tsx)
```typescript
// Source: src/components/staging/FileTreeSearch.tsx
<div className="relative">
  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ctp-overlay0" />
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="Filter branches..."
    className={cn(
      "w-full pl-8 pr-8 py-1.5 text-sm bg-ctp-surface0 border border-ctp-surface1 rounded",
      "text-ctp-text placeholder:text-ctp-overlay0",
      "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue"
    )}
  />
  {value && (
    <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2">
      <X className="w-4 h-4" />
    </button>
  )}
</div>
```

### Keyboard Navigation in Dropdown (from ScopeAutocomplete.tsx)
```typescript
// Source: src/components/commit/ScopeAutocomplete.tsx
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (!isOpen) {
    if (e.key === "ArrowDown") {
      setIsOpen(true);
      setHighlightedIndex(0);
    }
    return;
  }
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, items.length - 1));
      break;
    case "ArrowUp":
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
      break;
    case "Enter":
      e.preventDefault();
      if (highlightedIndex >= 0) selectItem(highlightedIndex);
      break;
    case "Escape":
      setIsOpen(false);
      break;
  }
}, [isOpen, items, highlightedIndex]);
```

## Backend Gaps Requiring New Rust Commands

### Gap 1: No Remote Branch Listing
**Current state:** `list_branches()` in `src-tauri/src/git/branch.rs` only iterates `git2::BranchType::Local`.
**What's needed:** A new command `list_all_branches(include_remote: bool)` that can optionally include `git2::BranchType::Remote` branches. Remote branches should be returned with a distinguishing flag (e.g., `isRemote: bool` on `BranchInfo`).
**Implementation approach:**
```rust
// Add to BranchInfo struct:
pub is_remote: bool,

// New command or modify existing:
pub async fn list_all_branches(
    include_remote: bool,
    state: State<'_, RepositoryState>
) -> Result<Vec<BranchInfo>, GitError> {
    // ... iterate BranchType::Local always
    // If include_remote, also iterate BranchType::Remote
    // For remote branches, strip the "origin/" prefix for display
    // but keep it for checkout operations
}
```
**Confidence:** HIGH -- this is straightforward git2 API usage, `repo.branches(Some(git2::BranchType::Remote))` works the same way.

### Gap 2: No Remote Branch Checkout
**Current state:** `checkout_branch()` only looks for local branches via `find_branch(name, BranchType::Local)`.
**What's needed:** A command to check out a remote branch by creating a local tracking branch. When user clicks `origin/feature/x`, it should create local `feature/x` tracking `origin/feature/x`, then check it out.
**Implementation approach:**
```rust
pub async fn checkout_remote_branch(
    remote_branch: String,  // e.g., "origin/feature/x"
    state: State<'_, RepositoryState>
) -> Result<(), GitError> {
    // 1. Parse remote name and branch name from "origin/feature/x"
    // 2. Find the remote reference
    // 3. Check if local branch already exists -- if so, just checkout
    // 4. Create local branch from remote ref with upstream set
    // 5. Checkout the new local branch
}
```
**Confidence:** HIGH -- standard git2 pattern, similar to what gitflow commands already do.

### Gap 3: Consider Extending BranchInfo Type
**Current BranchInfo type:** `{ name, isHead, lastCommitOid, lastCommitMessage, isMerged }`
**What to add:**
- `isRemote: bool` -- to distinguish local vs remote in the UI
- `remoteName: string | null` -- e.g., "origin" for remote branches
**Confidence:** HIGH -- additive change, won't break existing consumers.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom radix/headless dropdown | framer-motion AnimatePresence + custom panel | Already in codebase | Lighter weight, no new dependency |
| localStorage for persistence | Tauri plugin-store (flowforge-settings.json) | Already in codebase | Cross-platform persistent storage |
| Zustand v4 persist middleware | Direct Tauri Store API calls in actions | Current pattern | Simpler, no middleware layer |

**Important note on persistence pattern:** The codebase does NOT use Zustand's `persist` middleware. Instead, it calls the Tauri Store API directly in store actions (see `settings.ts`, `useRecentRepos.ts`). This phase should follow the same pattern -- load from Tauri Store on init, write to Tauri Store in actions. Do NOT introduce `zustand/middleware/persist`.

## Open Questions

1. **Panel positioning relative to header**
   - What we know: Panels slide down from the header, similar to GitHub Desktop.
   - What's unclear: Should the panel span the full width of the app window (like GitHub Desktop's branch switcher), or just the width of the pill trigger?
   - Recommendation: Match the width of the pill trigger button with a min-width of ~300px for usability. The panel should be absolutely positioned below the pill.

2. **Repo switch atomicity**
   - What we know: `openRepository()` sets status in one action, but loads branches/stashes separately.
   - What's unclear: Whether calling `openRepository(newPath)` while a repo is already open gracefully replaces it.
   - Recommendation: Test this during implementation. The Rust backend's `open_repository` stores the new path, and the file watcher is replaced. This should work but verify.

3. **Recently-checked-out branches tracking**
   - What we know: Decision says "3 most recently checked-out branches" at the top.
   - What's unclear: How to track checkout history (git reflog vs app-level tracking).
   - Recommendation: Track at the app level in the navigation store. Every time `checkoutBranch` succeeds, push the branch name to a per-repo recent list. This is simpler than parsing reflog and gives us control over the data.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/components/Header.tsx`, `src/stores/repository.ts`, `src/stores/branches.ts`, `src/stores/stash.ts`, `src/stores/toast.ts`, `src/stores/settings.ts`
- Codebase analysis: `src/hooks/useRecentRepos.ts`, `src/lib/store.ts`, `src/lib/animations.ts`
- Codebase analysis: `src/components/ui/Toast.tsx`, `src/components/commit/ScopeAutocomplete.tsx`, `src/components/staging/FileTreeSearch.tsx`
- Codebase analysis: `src/components/animations/FadeIn.tsx`, `src/components/layout/CollapsibleSidebar.tsx`
- Codebase analysis: `src-tauri/src/git/branch.rs`, `src-tauri/src/git/stash.rs`
- Codebase analysis: `src/bindings.ts` (all types and commands)
- Context7: `/grx7/framer-motion` -- AnimatePresence, exit animations, motion.div patterns
- Context7: `/websites/zustand_pmnd_rs` -- persist middleware with custom async storage (StateStorage interface)
- Context7: `/tauri-apps/plugins-workspace` -- plugin-store JavaScript API (Store.load, get, set, save)

### Secondary (MEDIUM confidence)
- Zustand v5 docs: Custom storage with async backends works via `StateStorage` interface, but the codebase prefers direct Tauri Store calls instead of middleware

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and Context7

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use, no new dependencies
- Architecture: HIGH -- patterns directly copied from existing codebase components
- Pitfalls: HIGH -- identified from actual codebase behavior (z-index, state flow, persistence patterns)
- Backend gaps: HIGH -- confirmed by reading `branch.rs` source code, `BranchType::Local` only
- Code examples: HIGH -- all examples taken directly from codebase source files

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable -- no dependency updates expected)
