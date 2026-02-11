---
phase: quick-46
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/stores/bladeTypes.ts
  - src/core/blades/branch-manager/BranchManagerBlade.tsx
  - src/core/blades/branch-manager/registration.ts
  - src/core/blades/_discovery.ts
  - src/core/commands/navigation.ts
autonomous: true
must_haves:
  truths:
    - "User can open a Branch Manager blade from the command palette"
    - "Branch Manager blade renders the full BranchList with scope selector, pinning, checkout, delete, merge, and bulk operations"
    - "Branch Manager blade is a singleton (only one instance in the blade stack)"
    - "User can create a new branch from the Branch Manager blade header"
  artifacts:
    - path: "src/core/stores/bladeTypes.ts"
      provides: "branch-manager type in BladePropsMap"
      contains: "branch-manager"
    - path: "src/core/blades/branch-manager/BranchManagerBlade.tsx"
      provides: "Branch Manager blade component wrapping BranchList"
      min_lines: 20
    - path: "src/core/blades/branch-manager/registration.ts"
      provides: "Blade registration for branch-manager"
      contains: "registerBlade"
    - path: "src/core/blades/_discovery.ts"
      provides: "branch-manager in EXPECTED_TYPES"
      contains: "branch-manager"
    - path: "src/core/commands/navigation.ts"
      provides: "open-branch-manager command"
      contains: "open-branch-manager"
  key_links:
    - from: "src/core/blades/branch-manager/BranchManagerBlade.tsx"
      to: "src/core/components/branches/BranchList.tsx"
      via: "direct import and render"
      pattern: "import.*BranchList"
    - from: "src/core/blades/branch-manager/registration.ts"
      to: "src/core/lib/bladeRegistry.ts"
      via: "registerBlade call"
      pattern: "registerBlade"
    - from: "src/core/commands/navigation.ts"
      to: "src/core/hooks/useBladeNavigation.ts"
      via: "openBlade dispatches PUSH_BLADE"
      pattern: "openBlade.*branch-manager"
---

<objective>
Wire the existing BranchList component infrastructure into a standalone Branch Manager blade, registered as a core blade type and accessible from the command palette.

Purpose: The branch management UI (scope selector, pinned branches, checkout, merge, delete, bulk ops, create branch dialog) already exists as components. This task wraps them in a proper blade so users can open a dedicated branch management panel in the blade stack, not just in the sidebar dropdown.

Output: A new `branch-manager` core blade accessible via command palette (Mod+Shift+B).
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/core/stores/bladeTypes.ts
@src/core/blades/_discovery.ts
@src/core/blades/settings/registration.ts
@src/core/blades/repo-browser/registration.tsx
@src/core/components/branches/BranchList.tsx
@src/core/commands/navigation.ts
@src/core/hooks/useBladeNavigation.ts
@src/core/lib/bladeRegistry.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Register branch-manager blade type and create blade component</name>
  <files>
    src/core/stores/bladeTypes.ts
    src/core/blades/branch-manager/BranchManagerBlade.tsx
    src/core/blades/branch-manager/registration.ts
    src/core/blades/_discovery.ts
  </files>
  <action>
1. In `src/core/stores/bladeTypes.ts`, add `"branch-manager": Record<string, never>;` to the `BladePropsMap` interface (place it after `"repo-browser"` for alphabetical grouping of management blades).

2. Create `src/core/blades/branch-manager/BranchManagerBlade.tsx`:
   - Import `useState` from react.
   - Import `Plus` from lucide-react.
   - Import `BranchList` from `../../components/branches/BranchList`.
   - The component manages a `showCreateDialog` boolean state (default false).
   - Render a header bar with:
     - A "New Branch" button (Plus icon + text) styled consistently with other blade headers: `flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-ctp-blue text-ctp-base hover:bg-ctp-blue/80 transition-colors`
     - The button sets `showCreateDialog` to true on click.
   - Render `<BranchList showCreateDialog={showCreateDialog} onCloseCreateDialog={() => setShowCreateDialog(false)} />` as the main content.
   - Wrap everything in a `div` with `className="flex flex-col h-full overflow-hidden"`.
   - The header bar should have `className="flex items-center justify-end gap-2 px-3 py-2 border-b border-ctp-surface0 bg-ctp-mantle shrink-0"`.
   - Export as named export `BranchManagerBlade`.

3. Create `src/core/blades/branch-manager/registration.ts`:
   - Follow the exact pattern of `src/core/blades/settings/registration.ts`.
   - Lazy import `BranchManagerBlade` from `./BranchManagerBlade`.
   - Register with: `type: "branch-manager"`, `defaultTitle: "Branch Manager"`, `lazy: true`, `singleton: true`.
   - Do NOT use renderTitleContent or renderTrailing (the blade handles its own toolbar).

4. In `src/core/blades/_discovery.ts`, add `"branch-manager"` to the `EXPECTED_TYPES` array.
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | grep -v "bindings.ts(1493"` — should produce no new TypeScript errors. Confirm all four files exist and have correct content.
  </verify>
  <done>
`branch-manager` is a registered core blade type. The blade component wraps BranchList with a "New Branch" header action. Registration is lazy-loaded and singleton. Discovery check includes it.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add command palette entry and keyboard shortcut to open Branch Manager blade</name>
  <files>
    src/core/commands/navigation.ts
  </files>
  <action>
1. In `src/core/commands/navigation.ts`:
   - The existing "show-branches" command (Mod+B) toggles the sidebar dropdown. Keep it as-is.
   - Add a NEW command AFTER the existing "show-branches" command:
     ```
     registerCommand({
       id: "open-branch-manager",
       title: "Open Branch Manager",
       description: "Open the branch management blade",
       category: "Navigation",
       shortcut: "mod+shift+b",
       icon: GitBranch,
       action: () => {
         const { getNavigationActor } = require("../machines/navigation/context");
         getNavigationActor().send({
           type: "PUSH_BLADE",
           bladeType: "branch-manager",
           title: "Branch Manager",
           props: {},
         });
       },
       enabled: () => !!useRepositoryStore.getState().repoStatus,
     });
     ```
   - IMPORTANT: Do NOT use `require()`. Instead, use the already-imported `getNavigationActor` at the top of the file. The import already exists: `import { getNavigationActor } from "../machines/navigation/context";`.
   - The action sends a `PUSH_BLADE` event directly to the navigation actor (same pattern as "show-changes" and "show-history" but pushing a blade instead of switching process).
   - Use `"branch-manager" as const` for the bladeType to ensure type safety, since the navigation event type uses the general `BladeType` union.
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | grep -v "bindings.ts(1493"` — no new TypeScript errors. Grep for "open-branch-manager" in the commands file to confirm registration.
  </verify>
  <done>
"Open Branch Manager" appears in the command palette under Navigation category. Mod+Shift+B opens it. Command is only enabled when a repo is open.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes (ignoring pre-existing bindings.ts error)
2. `grep -r "branch-manager" src/core/` shows entries in bladeTypes.ts, registration.ts, _discovery.ts, and navigation.ts
3. The blade component imports and renders BranchList with proper props
4. The command palette registration uses the correct shortcut and blade type
</verification>

<success_criteria>
- "branch-manager" exists as a core blade type in BladePropsMap
- BranchManagerBlade wraps existing BranchList with a "New Branch" header action
- Blade is registered as lazy + singleton
- Command palette has "Open Branch Manager" entry with Mod+Shift+B shortcut
- All existing branch management features (scope selector, pinning, checkout, merge, delete, bulk ops, create dialog) work through the blade since BranchList is reused as-is
- TypeScript compiles without new errors
</success_criteria>

<output>
After completion, create `.planning/quick/46-implement-the-show-branches-blade-with-m/46-SUMMARY.md`
</output>
