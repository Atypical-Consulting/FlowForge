# Phase 37: Extension Platform Foundation -- Research Synthesis

**Researched:** 2026-02-10
**Method:** 3-agent parallel research (UX, Architecture, Implementation)
**Confidence:** HIGH
**Focus:** Refactoring to enforce extensibility

---

## Summary

Phase 37 introduces four new registries (ContextMenu, SidebarPanel, StatusBar, GitHookBus), three new UI components, and expands ExtensionAPI with 6 new methods plus the `onDispose()` lifecycle pattern. The implementation follows proven patterns already in the codebase (`toolbarRegistry.ts` template) and requires 6 new files, 7 modified files, ~540 new lines, and ~39 new tests. Zero breaking changes.

## Detailed Research Documents

Three specialized research documents were produced in parallel:

1. **UX Research** (`37-UX-RESEARCH.md`, 786 lines)
   - Context menu grouped-with-separators model, 6 locations, keyboard accessibility, ARIA roles
   - Sidebar panels: identical to core sections, priority-based ordering (core 70-100, ext 1-69)
   - Status bar: `h-7 bg-ctp-mantle`, left/right zones, priority-based truncation
   - Extension UI cohesion: Catppuccin tokens, Lucide icons only, spacing constraints
   - Scalability safeguards: auto-submenu at >5 items, default collapsed panels, overflow truncation

2. **Architecture Research** (`37-ARCHITECTURE-RESEARCH.md`, 1043 lines)
   - Registry pattern: Zustand stores (Option B) over module-level Maps or class-based
   - GitHookBus: onWill* (sequential, can cancel) + onDid* (parallel, fire-and-forget), re-entrancy guard
   - ExtensionAPI: flat methods (contributeX/registerX/onDidX), not namespaced objects
   - Dispose pattern: reverse-order execution, error isolation, automatic tracking
   - Extensibility enforcement: dependency inversion, core UI reads registries, no direct extension imports
   - Forward compatibility: what to build generic now vs defer (fileDispatch overlay, trust flags)

3. **Implementation Research** (`37-IMPLEMENTATION-RESEARCH.md`, 1677 lines)
   - Existing extension system analysis (ExtensionHost, ExtensionAPI, GitHub reference)
   - Complete code examples for all registries, UI components, and API expansion
   - File change map: 6 new files, 7 modified files, 0 deleted
   - GitHookBus emission points identified across 5 files
   - Testing strategy with concrete test patterns following existing conventions
   - Risk matrix with mitigations

## Key Consensus Points (All 3 Researchers Agree)

1. **Zustand stores for all new registries** -- proven by toolbarRegistry.ts template
2. **GitHookBus as singleton class, not Zustand** -- event bus is pub/sub, not reactive state
3. **Flat API methods** -- consistent with existing registerBlade/registerCommand/contributeToolbar
4. **Portal-based context menu** -- clean slate (zero onContextMenu handlers exist)
5. **Additive sidebar changes** -- keep core sections hardcoded, add DynamicSidebarPanels zone
6. **StatusBar returns null when empty** -- no layout impact until extensions contribute items
7. **Error boundaries on extension panels** -- prevent extension crashes from breaking sidebar
8. **Source-based cleanup on all registries** -- atomic deactivation via unregisterBySource()

## Implementation Order

```
Plan 37-01 (Wave 1): Registries
  → contextMenuRegistry.ts, sidebarPanelRegistry.ts, statusBarRegistry.ts, gitHookBus.ts
  → Tests for all four

Plan 37-02 (Wave 1): UI Surfaces
  → ContextMenu.tsx + ContextMenuPortal, StatusBar.tsx, DynamicSidebarPanels
  → Wire onContextMenu to BranchItem.tsx
  → Wire gitHookBus.emit() into branches.slice, useCommitExecution, toolbar-actions
  → Integration in App.tsx and RepositoryView.tsx

Plan 37-03 (Wave 2, depends on 37-01): ExtensionAPI Expansion
  → 6 new methods + onDispose() + updated cleanup()
  → Config type interfaces
  → Tests for new methods and lifecycle
  → Verify GitHub extension unchanged

Wave 1: 37-01 + 37-02 (parallel -- registries and UI are independent initially)
Wave 2: 37-03 (depends on registries from 37-01)
```

## New Dependency

| Package | Version | Purpose |
|---------|---------|---------|
| `@radix-ui/react-context-menu` | ^2.2.x | Accessible context menu primitives (~32KB) |

---
*Synthesis completed: 2026-02-10*
*Ready for planning*
