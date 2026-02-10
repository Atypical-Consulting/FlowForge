## Plan 40-01 Summary: Gitflow Extension Entry Point & Core Cleanup

**Status:** Complete
**Commit:** 16bb93c

### What was built
Created the gitflow built-in extension entry point (`src/extensions/gitflow/index.ts`) that takes ownership of all four Gitflow-specific registrations, registered it in App.tsx, and removed all corresponding core registrations.

### Key changes
1. **Extension entry point** — `src/extensions/gitflow/index.ts` with 4 registrations:
   - Blade: `gitflow-cheatsheet` (React.lazy, coreOverride, singleton)
   - Sidebar panel: `gitflow-panel` (priority 65, defaultOpen false, via SidebarPanelRegistry)
   - Toolbar action: `gitflow-guide` (group "views", priority 50)
   - Command: `open-gitflow-cheatsheet` (category "Navigation", 6 keywords)
2. **App.tsx** — Added `registerBuiltIn` for gitflow (4th extension, between CC and GitHub)
3. **RepositoryView.tsx** — Removed hardcoded `<GitflowPanel />` section; DynamicSidebarPanels renders extension-contributed panel
4. **Core cleanup** — Removed gitflow from `toolbar-actions.ts`, `navigation.ts`, `_discovery.ts`
5. **Deleted** — `src/blades/gitflow-cheatsheet/registration.ts` and empty barrel `index.ts`

### Key files
- **Created:** `src/extensions/gitflow/index.ts`
- **Modified:** `src/App.tsx`, `src/components/RepositoryView.tsx`, `src/commands/toolbar-actions.ts`, `src/commands/navigation.ts`, `src/blades/_discovery.ts`
- **Deleted:** `src/blades/gitflow-cheatsheet/registration.ts`, `src/blades/gitflow-cheatsheet/index.ts`

### Verification
- TypeScript compiles cleanly
- All 198 tests pass (3 pre-existing Monaco suite failures unrelated)
- 4 registerBuiltIn calls in App.tsx
- No Gitflow-specific code remains in core registration files
- DynamicSidebarPanels still present in RepositoryView for extension panel rendering

### Deviations
None — followed plan exactly.

### Self-Check: PASSED
