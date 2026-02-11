# Phase 44: Worktree Extraction - Synthesized Research

**Researched:** 2026-02-11
**Sources:** 3 parallel researchers (UX, Architecture, Expert Developer)
**Confidence:** HIGH (all three converge on same patterns)

---

## Executive Summary

Phase 44 extracts Worktree management from hardcoded JSX in RepositoryView.tsx into a toggleable built-in extension. This is structurally identical to Phase 40 (Gitflow extraction) with **fewer moving parts**: no blades, no toolbar actions, no existing command palette entries to migrate. The extraction is purely: remove hardcoded sidebar section + dialogs from RepositoryView, create extension entry point with `contributeSidebarPanel()` and `registerCommand()`, move 4 component files.

**All three researchers agree on:**
- Use `contributeSidebarPanel()` API (proven in Phase 40/Gitflow)
- Follow GitflowPanel pattern for self-contained dialog state management
- Keep `worktrees.slice.ts` in core GitOpsStore (cross-slice dependency)
- Use DOM CustomEvent pattern for renderAction-to-dialog communication
- Zero Rust/Tauri changes, zero styling changes needed
- Register via `registerBuiltIn()` in App.tsx

---

## 1. Current Worktree Implementation Map

### Components (553 LOC total)

| File | Lines | Purpose |
|------|-------|---------|
| `src/components/worktree/WorktreePanel.tsx` | 69 | Sidebar panel listing worktrees with status |
| `src/components/worktree/WorktreeItem.tsx` | 139 | Single worktree row with actions |
| `src/components/worktree/CreateWorktreeDialog.tsx` | 193 | Modal for creating worktrees |
| `src/components/worktree/DeleteWorktreeDialog.tsx` | 152 | Confirmation dialog with force/branch options |
| `src/components/worktree/index.ts` | 5 | Barrel export |

### Hardcoded in RepositoryView.tsx

- **Lines 188-210:** `<details>` worktree sidebar section with `FolderGit2` icon, "+" button, `WorktreePanel`
- **Lines 232-239:** `CreateWorktreeDialog` and `DeleteWorktreeDialog` renders
- **Lines 98-99:** `showWorktreeDialog` and `worktreeToDelete` state variables
- **Imports:** `FolderGit2`, worktree component imports

### Data Layer

- **Store slice:** `src/stores/domain/git-ops/worktrees.slice.ts` (83 lines)
- **Cross-slice call:** `switchToWorktree()` calls `get().openRepository(path)` from RepositorySlice
- **Consumers:** Only worktree components consume worktree state (no core consumers)

### Rust Backend (Zero changes needed)

- `src-tauri/src/git/worktree.rs`: 3 commands (list, create, delete)
- Auto-generated bindings in `src/bindings.ts`
- Data flow: Component -> Zustand -> Tauri invoke -> Rust

### Current Registration State

- Command palette: "Worktrees" category exists but **zero commands registered**
- Toolbar: **zero worktree actions**
- Blades: **zero worktree blade types**
- This means **no core registrations to remove** -- simplest extraction yet

---

## 2. Reference Pattern: Gitflow Extension (Phase 40)

All researchers converge on Gitflow as the closest analog:

```
src/extensions/gitflow/
  index.ts                    -- onActivate/onDeactivate
  components/
    GitflowPanel.tsx          -- Self-contained panel with dialog state
    InitGitflowDialog.tsx     -- Dialog rendered inside panel
    StartFlowDialog.tsx       -- Dialog rendered inside panel
    FinishFlowDialog.tsx      -- Dialog rendered inside panel
```

Key patterns to replicate:
1. `api.contributeSidebarPanel()` replaces hardcoded `<details>` block
2. Panel component manages its own dialog state via `useState`
3. Dialogs render inside the panel component (not in RepositoryView)
4. `registerBuiltIn()` in App.tsx for immediate activation
5. No custom `onDeactivate()` needed -- `api.cleanup()` handles everything

---

## 3. Architectural Decisions

### ADR-1: Keep WorktreeSlice in GitOpsStore
**Decision:** Keep `worktrees.slice.ts` in core GitOpsStore
**Rationale:** `switchToWorktree()` calls `get().openRepository(path)` (cross-slice). Extracting would require event bus/bridge. Matches Phase 40 precedent (gitflow slice stayed).

### ADR-2: Move Components to Extension Directory
**Decision:** Move components to `src/extensions/worktrees/components/`
**Rationale:** Components are small (4 files, ~553 LOC), exclusively used by worktree feature, and moving establishes stronger extensibility boundaries. Follows GitHub extension pattern.

### ADR-3: DOM CustomEvent for Dialog Communication
**Decision:** Use `document.dispatchEvent(new CustomEvent("worktree:open-create-dialog"))` for renderAction-to-panel communication
**Rationale:** Proven pattern in codebase (`"create-branch-dialog"` exists). Simpler than Zustand atom. Matches how command palette triggers dialogs.

### ADR-4: Sidebar Priority
**Discussion:** UX recommends 69 (max, core-adjacent), Architecture recommends 55, Implementation recommends 60
**Decision:** Use priority 69. Worktrees are a fundamental Git feature that users expect near Branches/Stash/Tags. Priority 69 (max for extensions) ensures worktrees appear first among extension-contributed panels, maintaining adjacency to core panels.

### ADR-5: Extension ID
**Decision:** Use "worktrees" (plural) for consistency with the feature name and store slice

### ADR-6: Badge Support
**Decision:** Add `badge` to `ExtensionSidebarPanelConfig` if not already exposed (one-line addition). Show worktree count when >1.

---

## 4. File Change Plan

### CREATE (7 files)

| File | Purpose |
|------|---------|
| `src/extensions/worktrees/index.ts` | Extension entry point (~60 lines) |
| `src/extensions/worktrees/components/WorktreeSidebarPanel.tsx` | Wrapper: panel + dialog state (~35 lines) |
| `src/extensions/worktrees/components/WorktreePanel.tsx` | Moved from components/worktree/ |
| `src/extensions/worktrees/components/WorktreeItem.tsx` | Moved from components/worktree/ |
| `src/extensions/worktrees/components/CreateWorktreeDialog.tsx` | Moved from components/worktree/ |
| `src/extensions/worktrees/components/DeleteWorktreeDialog.tsx` | Moved from components/worktree/ |
| `src/extensions/worktrees/components/index.ts` | Barrel export |

### MODIFY (2 files)

| File | Change |
|------|--------|
| `src/components/RepositoryView.tsx` | Remove ALL worktree: imports, state, JSX, dialogs (~50 lines removed) |
| `src/App.tsx` | Add `registerBuiltIn` for worktrees extension (~10 lines added) |

### DELETE (5 files)

Entire `src/components/worktree/` directory (components moved to extension)

### UNCHANGED

- `src/stores/domain/git-ops/worktrees.slice.ts` (data stays in core)
- `src-tauri/src/git/worktree.rs` (Rust backend unchanged)
- `src/bindings.ts` (auto-generated)
- `src/lib/commandRegistry.ts` ("Worktrees" category already exists)

---

## 5. Graceful Degradation

| State | Sidebar Panel | Commands | Data | Core Features |
|-------|--------------|----------|------|---------------|
| Enabled | Visible with [+] button | Create/Refresh in palette | Active in GitOpsStore | Unaffected |
| Disabled | Gone | Hidden | Persists (inert) | Unaffected |
| Re-enabled | Reappears instantly | Reappears | Refreshes on mount | Unaffected |

Mid-session disable is clean: `api.cleanup()` atomically removes all registrations, React unmounts components, no orphaned state.

---

## 6. Risk Matrix

| Risk | Severity | Mitigation | Confidence |
|------|----------|------------|------------|
| Duplicate panel (hardcoded not removed) | HIGH | Verify zero worktree refs in RepositoryView | HIGH |
| Dialog state orphaned in RepositoryView | HIGH | Move ALL state to WorktreeSidebarPanel | HIGH |
| renderAction button doesn't reach dialog | MEDIUM | DOM CustomEvent (proven pattern) | HIGH |
| Import paths break after component move | MEDIUM | TypeScript compiler catches all | HIGH |
| Sidebar position change (fixed -> dynamic) | LOW | Priority 69 maintains adjacency | HIGH |
| Stale data on re-enable | LOW | useEffect refresh on mount | HIGH |
| Dialog portal rendering | LOW | Radix portals to body (proven by Gitflow) | HIGH |

---

## 7. Key Implementation Notes

### WorktreeSidebarPanel Pattern
```tsx
function WorktreeSidebarPanel() {
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setShowCreate(true);
    document.addEventListener("worktree:open-create-dialog", handler);
    return () => document.removeEventListener("worktree:open-create-dialog", handler);
  }, []);

  return (
    <>
      <WorktreePanel onOpenDeleteDialog={setDeleteTarget} />
      <CreateWorktreeDialog open={showCreate} onOpenChange={setShowCreate} />
      <DeleteWorktreeDialog worktreeName={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)} />
    </>
  );
}
```

### Extension Entry Point Pattern
```typescript
export async function onActivate(api: ExtensionAPI): Promise<void> {
  api.contributeSidebarPanel({
    id: "worktree-panel",
    title: "Worktrees",
    icon: FolderGit2,
    component: WorktreeSidebarPanel,
    priority: 69,
    defaultOpen: false,
    renderAction: () => /* "+" button dispatching CustomEvent */,
    badge: () => {
      const count = useGitOpsStore.getState().worktreeList.length;
      return count > 1 ? count : null;
    },
  });

  api.registerCommand({ id: "create-worktree", ... });
  api.registerCommand({ id: "refresh-worktrees", ... });
}
```

---

## Detailed Research Files

- `44-RESEARCH-UX.md` -- UX flows, degradation, accessibility, Extension Manager integration
- `44-RESEARCH-ARCHITECTURE.md` -- Extension system deep-dive, lifecycle, extensibility enforcement
- `44-RESEARCH-IMPLEMENTATION.md` -- File-by-file changes, Rust layer, Tailwind/Catppuccin styling

---

*Synthesized: 2026-02-11*
*Valid until: 2026-03-13*
