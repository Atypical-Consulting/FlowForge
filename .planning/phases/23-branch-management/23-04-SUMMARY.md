---
status: complete
---

# Plan 23-04: Branch Scope Selector, Tiered Section Layout, Pin/Badge UI

## What was built
Segmented scope control for switching between Local/Remote/Recent branch views, collapsible sections for pinned (Quick Access) and recently-visited branches, and enhanced branch items with pin toggles and Gitflow type badges. BranchList was refactored from a flat list to a tiered layout powered by the useBranchScopes composition hook.

## Key files
### Created
- `src/components/branches/BranchScopeSelector.tsx` — Accessible radiogroup segmented control with arrow-key navigation for switching branch scopes
- `src/components/branches/BranchTypeBadge.tsx` — Colored badge showing Gitflow branch type (main/develop/feature/release/hotfix), returns null for "other"
- `src/components/branches/CollapsibleSection.tsx` — Animated collapsible section using framer-motion with chevron rotation and height animation

### Modified
- `src/components/branches/BranchList.tsx` — Refactored from flat list (useBranchStore) to tiered layout (useBranchScopes) with scope selector, Quick Access pinned section, Recent section, and per-branch pin toggling
- `src/components/branches/BranchItem.tsx` — Updated from BranchInfo to EnrichedBranch type, added pin toggle button (show on hover, fill when pinned), added BranchTypeBadge, changed group to group/item for nested hover scoping

## Deviations
None

## Self-Check
PASSED — `npx tsc --noEmit` produces no new errors (only pre-existing bindings.ts TS2440)
