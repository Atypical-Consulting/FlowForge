# Phase 23: Branch Management - Research

**Researched:** 2026-02-08
**Domain:** Branch management UX, state architecture, Tauri/Rust/React/Tailwind implementation
**Confidence:** HIGH
**Research approach:** Three parallel specialized researchers (UX, Architecture, Expert Developer)

## Summary

Phase 23 introduces branch management features on top of a well-structured codebase. The existing patterns are strong: `tauri-plugin-store` for persistence, Zustand stores for state, framer-motion for animations, CVA for component variants. Three researchers independently converged on the same core recommendations:

1. **Tiered branch sections** (Pinned > Recent > All) in the sidebar with a segmented scope selector
2. **Separate metadata store** for user preferences, composed with git data via custom hooks
3. **Unified branch colors** — the two existing divergent color systems must be consolidated
4. **No new dependencies** — everything builds on existing project libraries
5. **Refactoring for extensibility** — scope registry pattern mirrors the blade registry

**Primary recommendation:** Layer user metadata (pins, recents) on top of git branch data using a separate store + composition hook. Unify branch classification into a single source of truth. Use a registry-based scope system for extensible filtering. Build the UI with segmented controls, pin toggles, and bulk delete with Gitflow protection.

## Standard Stack

### Core (All Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5 | Branch + metadata state management | Already used for all stores |
| @tauri-apps/plugin-store | ^2 | Persisting pins/recents/scope prefs | Already used via `getStore()` in navigation.ts |
| git2 (Rust) | 0.20 | Reflog, branch CRUD, merge-base checks | Already in Cargo.toml |
| framer-motion | ^12.31.0 | Animated section transitions, list reordering | Already used in blade navigation |
| class-variance-authority | ^0.7.1 | Badge variant styling for branch types | Already used for button variants |
| lucide-react | ^0.563 | Pin, Clock, Trash2, Shield icons | Already imported across components |
| chrono (Rust) | 0.4 | Timestamp formatting for reflog entries | Already in Cargo.toml |

### No New Dependencies Needed
All Phase 23 features build on existing libraries. No new npm or cargo packages required.

## Architecture Patterns

### Recommended Project Structure
```
src-tauri/src/git/
  branch.rs           # Extended: batch_delete_branches, get_recent_checkouts
  graph.rs            # Modified: unify BranchType coloring

src/
  stores/
    branches.ts       # EXISTING — keep as pure git data store
    branchMetadata.ts  # NEW: pins, recents, scope preferences (persisted via plugin-store)
  hooks/
    useBranches.ts     # NEW: composes git data + metadata into EnrichedBranch[]
    useBranchScopes.ts # NEW: scope registry + filtering logic
    useBulkSelect.ts   # NEW: multi-select with shift-click
  lib/
    branchClassifier.ts  # REFACTORED: single source of truth for ALL branch colors/types
    branchScopes.ts      # NEW: extensible scope registry (local/remote/recent)
    bulkBranchOps.ts     # NEW: batch deletion pipeline with error aggregation
  components/branches/
    BranchList.tsx       # REFACTORED: sections, scope selector, bulk mode
    BranchItem.tsx       # REFACTORED: pin button, type badge, checkbox
    BranchScopeSelector.tsx  # NEW: segmented control (Local | Remote | Recent)
    BranchTypeBadge.tsx      # NEW: color-coded branch type indicator
    BulkDeleteDialog.tsx     # NEW: confirmation with Gitflow protection display
    CollapsibleSection.tsx   # NEW: animated section for Quick Access / Recent
```

### Pattern 1: Layered State Architecture
**What:** Separate git branch data (ephemeral, from Rust) from user metadata (persistent, from Tauri store). Compose in a custom hook.
**When to use:** Always — this is the foundational pattern.
**Why:** Git data and user preferences have different lifecycles, persistence needs, and update frequencies. Mixing them causes coupling where pin toggles trigger git refresh cycles.

```typescript
// Composition hook — single consumption point
function useBranches() {
  const { allBranches } = useBranchStore();        // Git data
  const metadata = useBranchMetadataStore();         // User prefs

  return useMemo(() => allBranches.map(b => ({
    ...b,
    branchType: classifyBranch(b.name),
    isPinned: metadata.isPinned(repoPath, b.name),
    lastVisited: metadata.getLastVisited(repoPath, b.name),
  })), [allBranches, metadata, repoPath]);
}
```

### Pattern 2: Scope Registry (Extensibility)
**What:** Registry-based filtering system inspired by the blade registry. Adding a new scope = one function call.
**When to use:** Branch filtering (Local/Remote/Recent), extensible for future scopes (Stale, Unmerged).

```typescript
registerScope({
  id: "local",
  label: "Local",
  filter: (b) => !b.isRemote,
  sort: (a, b) => a.name.localeCompare(b.name),
});
```

### Pattern 3: Unified Branch Color System
**What:** Single source of truth for ALL branch type colors across sidebar AND topology.
**When to use:** Everywhere branches are visually distinguished.

**Current problem — three separate color systems:**
1. `branchClassifier.ts`: feature = `ctp-green` (WRONG per BRANCH-05)
2. `layoutUtils.ts`: feature = `ctp-mauve` (CORRECT)
3. `TopologyPanel.tsx` lines 17-27: duplicate `classifyBranch` function

**Unified mapping (adopt topology colors as canonical):**
| Branch Type | Catppuccin Color | Hex (Mocha) | Tailwind Class |
|-------------|-----------------|-------------|----------------|
| main | red | #f38ba8 | ctp-red |
| develop | blue | #89b4fa | ctp-blue |
| feature | mauve (purple) | #cba6f7 | ctp-mauve |
| release | peach | #fab387 | ctp-peach |
| hotfix | maroon | #eba0ac | ctp-maroon |
| other | overlay1 | #6c7086 | ctp-overlay1 |

### Anti-Patterns to Avoid
- **Mixing git state and user preferences in one store** — causes coupling
- **Storing computed/enriched state in stores** — compute in hooks via `useMemo`
- **Duplicating branch classification logic** — three copies exist today; NO fourth
- **Using Zustand persist with Tauri** — use `getStore()` directly (established pattern)
- **Stopping bulk operations on first failure** — continue, report all results
- **Color-only branch type distinction** — always pair color with text label (WCAG 1.4.1)
- **Flat unsectioned branch list** — always section by purpose

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recent branch tracking | Custom timestamp storage | Git reflog parsing (Rust) | Captures ALL checkouts (CLI, GUI, other tools) |
| Persistent preferences | Custom JSON file I/O | `tauri-plugin-store` via `getStore()` | Already integrated, handles atomicity |
| Segmented control | Raw div with click handlers | WAI-ARIA `role="radiogroup"` component | Accessibility requires correct ARIA roles |
| Multi-select | Manual event tracking | Checkbox-based selection with explicit mode | More accessible, no modifier key discovery needed |
| Branch classification | Per-component color maps | Unified `branchClassifier.ts` | Three copies exist — consolidate, don't add a fourth |
| Animated collapse | Manual height animation | framer-motion `AnimatePresence` | Already used throughout the app |
| State composition | Combined mega-store | Custom hook with `useMemo` | Zustand best practice for derived state |

## Common Pitfalls

### Pitfall 1: Color Token Inconsistency
**What goes wrong:** Feature branches show green in sidebar, purple in topology
**Why:** `branchClassifier.ts` (feature=green) vs `layoutUtils.ts` (feature=mauve)
**Fix:** Single source of truth — unify to mauve/purple per BRANCH-05 requirement

### Pitfall 2: Stale Recent Branches
**What goes wrong:** Recent branch list shows deleted branches
**Fix:** Filter recent names against current `allBranches` before rendering (existing BranchSwitcher already does this)

### Pitfall 3: Pin/Scope Desynchronization
**What goes wrong:** Pinned branches disappear when switching scopes
**Fix:** Pinned section is scope-independent — always visible regardless of active scope filter

### Pitfall 4: Bulk Delete Race Conditions
**What goes wrong:** N deletions trigger N branch list refreshes
**Fix:** Add `deleteBranchBatch` that skips per-item refresh. Single refresh after all operations.

### Pitfall 5: Sidebar Section Overflow
**What goes wrong:** Multiple expanded sections make sidebar extremely tall
**Fix:** `max-h-[300px] overflow-y-auto` on each section content. Sticky section headers.

### Pitfall 6: Gitflow Protection
**What goes wrong:** Users delete main/develop in bulk operations
**Fix:** Read actual Gitflow config from `useGitflowStore` for protected branch names. Don't hardcode.

### Pitfall 7: Selection Mode vs Checkout Conflict
**What goes wrong:** Click-to-select conflicts with click-to-checkout
**Fix:** Explicit selection mode toggle. Normal mode = checkout, selection mode = checkboxes.

### Pitfall 8: Reflog Message Format
**What goes wrong:** Reflog messages like "checkout: moving from X to Y" are convention, not spec
**Fix:** Validate extracted branch names against existing branches. Handle detached HEAD entries.

## Code Examples

### Rust: Recent Checkouts via Reflog
```rust
#[tauri::command]
#[specta::specta]
pub fn get_recent_checkouts(state: tauri::State<'_, AppState>, limit: usize) -> Result<Vec<RecentCheckout>> {
    let repo = state.repo()?;
    let reflog = repo.reflog("HEAD")?;
    let mut seen = HashSet::new();
    let mut results = Vec::new();

    for entry in reflog.iter() {
        let msg = entry.message().unwrap_or("");
        if let Some(branch) = msg.strip_prefix("checkout: moving from ").and_then(|s| s.split(" to ").nth(1)) {
            if seen.insert(branch.to_string()) {
                let ts = entry.committer().when().seconds();
                results.push(RecentCheckout { name: branch.into(), timestamp: ts });
                if results.len() >= limit { break; }
            }
        }
    }
    Ok(results)
}
```

### Rust: Batch Delete with Error Aggregation
```rust
#[tauri::command]
#[specta::specta]
pub fn batch_delete_branches(state: tauri::State<'_, AppState>, names: Vec<String>, force: bool) -> Result<BatchDeleteResult> {
    let repo = state.repo()?;
    let mut successes = Vec::new();
    let mut failures = Vec::new();

    for name in &names {
        match repo.find_branch(name, BranchType::Local) {
            Ok(mut branch) => match branch.delete() {
                Ok(()) => successes.push(name.clone()),
                Err(e) => failures.push(DeleteFailure { name: name.clone(), reason: e.message().into() }),
            },
            Err(e) => failures.push(DeleteFailure { name: name.clone(), reason: e.message().into() }),
        }
    }
    Ok(BatchDeleteResult { successes, failures })
}
```

### React: Segmented Scope Selector
```tsx
function BranchScopeSelector({ value, onChange }: { value: BranchScope; onChange: (s: BranchScope) => void }) {
  const scopes = [
    { value: "local", label: "Local" },
    { value: "remote", label: "Remote" },
    { value: "recent", label: "Recent" },
  ];
  return (
    <div className="flex bg-ctp-surface0 rounded-md p-0.5 mx-2 mb-2" role="radiogroup" aria-label="Branch scope">
      {scopes.map((s) => (
        <button key={s.value} role="radio" aria-checked={value === s.value}
          className={cn("flex-1 px-2.5 py-1 text-xs font-medium rounded-sm transition-all",
            value === s.value ? "bg-ctp-surface1 text-ctp-text shadow-sm" : "text-ctp-overlay1 hover:text-ctp-subtext0"
          )} onClick={() => onChange(s.value as BranchScope)}>
          {s.label}
        </button>
      ))}
    </div>
  );
}
```

### React: Branch Type Badge (WCAG Compliant)
```tsx
const BADGE_STYLES: Record<GitflowBranchType, string> = {
  main: "text-ctp-red bg-ctp-red/10 border-ctp-red/30",
  develop: "text-ctp-blue bg-ctp-blue/10 border-ctp-blue/30",
  feature: "text-ctp-mauve bg-ctp-mauve/10 border-ctp-mauve/30",
  release: "text-ctp-peach bg-ctp-peach/10 border-ctp-peach/30",
  hotfix: "text-ctp-maroon bg-ctp-maroon/10 border-ctp-maroon/30",
  other: "",
};

function BranchTypeBadge({ branchName }: { branchName: string }) {
  const type = classifyBranch(branchName);
  if (type === "other") return null;
  return (
    <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium shrink-0", BADGE_STYLES[type])}
      aria-label={`${type} branch`}>
      {type}
    </span>
  );
}
```

## Refactoring Strategy (Extensibility Focus)

### Wave 1: Foundation (non-breaking)
1. Unify `branchClassifier.ts` as single color source of truth
2. Create `branchMetadata.ts` store with Tauri persistence
3. Create `branchScopes.ts` registry
4. Create `useBranches.ts` and `useBranchScopes.ts` composition hooks
5. Add Rust commands: `get_recent_checkouts`, `batch_delete_branches`

### Wave 2: Color Consolidation (safe refactors)
6. Remove duplicate `classifyBranch` from `TopologyPanel.tsx`
7. Update `layoutUtils.ts` to import from unified classifier
8. Feature branches = `ctp-mauve` everywhere

### Wave 3: Branch UI Components
9. Build `BranchScopeSelector`, `BranchTypeBadge`, `CollapsibleSection`
10. Refactor `BranchList.tsx` for tiered sections + scope filtering
11. Refactor `BranchItem.tsx` for pin toggle + type badge

### Wave 4: Bulk Operations + Integration
12. Build `BulkDeleteDialog.tsx` with Gitflow protection
13. Add bulk select mode to branch list
14. Wire contextual clone/reveal button in Header

## Open Questions

1. **Hotfix vs Main color distinction:** Both mapped to red in some systems. Recommendation: hotfix = `ctp-maroon`, main = `ctp-red`.
2. **BRANCH-06 clone button scope:** Requirement says "contextually appropriate action." Recommendation: "Reveal in Finder" (macOS) / "Open in Explorer" (Windows) using `@tauri-apps/plugin-shell`.
3. **Max pinned branches:** Recommendation: Cap at 5 to keep Quick Access compact.
4. **Pins per-repo or global:** Recommendation: Per-repo (different repos have different important branches).
5. **Recent branch count in sidebar:** Recommendation: Show last 5, matching existing BranchSwitcher pattern.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/stores/branches.ts`, `navigation.ts`, `blades.ts`, `bladeTypes.ts`
- Codebase analysis: `src/lib/branchClassifier.ts`, `src/components/topology/layoutUtils.ts` (color divergence confirmed)
- Codebase analysis: `src-tauri/src/git/branch.rs`, `graph.rs`, `undo.rs`
- Context7: `/websites/docs_rs-git2` — Reflog, ReflogEntry, Branch APIs
- Context7: `/tauri-apps/plugins-workspace` — tauri-plugin-store APIs
- Context7: `/websites/motion_dev` — AnimatePresence, layout animations

### Secondary (MEDIUM confidence)
- Tower 15 for Mac — Pinned Branches, Fully Merged badges, auto-archive
- Fork — Pin branches, chronological sort, quick filter
- GitHub Desktop — Recent branches, pin requests
- GitKraken/GitLens — Sidebar section organization
- WCAG 2.1 SC 1.4.1 — Color-only distinction prohibition

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing
- Architecture: HIGH — patterns from existing codebase (navigation store, blade registry)
- UX patterns: HIGH — consensus across professional Git GUIs
- Pitfalls: HIGH — identified from actual code inspection (3 duplicate classifiers)
- Rust/git2: HIGH — APIs verified via Context7
- Implementation: HIGH — code examples verified against existing patterns

**Research date:** 2026-02-08
**Valid until:** 2026-03-10 (30 days — stable patterns)

**Detailed research available in:**
- `ux-research.md` — Full UX analysis (601 lines)
- `arch-research.md` — Architecture deep-dive (774 lines)
- `dev-research.md` — Implementation specifics (841 lines)
