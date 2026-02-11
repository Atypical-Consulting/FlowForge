---
phase: quick-45
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/extensions/welcome-screen/index.ts
  - src/extensions/welcome-screen/manifest.json
  - src/extensions/welcome-screen/README.md
  - src/extensions/welcome-screen/blades/WelcomeBlade.tsx
  - src/extensions/welcome-screen/components/WelcomeContent.tsx
  - src/extensions/welcome-screen/components/AnimatedGradientBg.tsx
  - src/extensions/welcome-screen/components/GitInitBanner.tsx
  - src/extensions/welcome-screen/components/GitInitFallbackBanner.tsx
  - src/extensions/welcome-screen/components/RecentRepos.tsx
  - src/extensions/welcome-screen/components/index.ts
  - src/App.tsx
  - src/core/stores/bladeTypes.ts
  - src/extensions/extensionCategories.ts
autonomous: true
must_haves:
  truths:
    - "When no repository is open, the user sees the Welcome screen with Open/Clone buttons, recent repos, and animated background"
    - "The welcome screen is delivered as a built-in extension registered through the extension host"
    - "Blades pushed via command palette (Settings, Extension Manager) still render correctly on the welcome screen"
    - "Git init banner and fallback banner still work when user opens a non-git folder"
    - "Disabling the welcome-screen extension does not crash the app (graceful fallback)"
  artifacts:
    - path: "src/extensions/welcome-screen/index.ts"
      provides: "Extension entry point with onActivate/onDeactivate"
      exports: ["onActivate", "onDeactivate"]
    - path: "src/extensions/welcome-screen/manifest.json"
      provides: "Extension metadata"
      contains: "welcome-screen"
    - path: "src/extensions/welcome-screen/blades/WelcomeBlade.tsx"
      provides: "Blade component wrapping welcome content"
    - path: "src/App.tsx"
      provides: "Updated app shell rendering welcome blade via extension system"
  key_links:
    - from: "src/extensions/welcome-screen/index.ts"
      to: "src/core/lib/bladeRegistry.ts"
      via: "api.registerBlade()"
      pattern: "api\\.registerBlade"
    - from: "src/App.tsx"
      to: "src/extensions/welcome-screen"
      via: "registerBuiltIn + useBladeRegistry"
      pattern: "registerBuiltIn.*welcome-screen"
---

<objective>
Migrate the Welcome Screen from a hardcoded core component into a built-in extension, following the standard extension architecture pattern. The welcome screen becomes the first blade the user sees when no repository is open, enforcing the xstate navigation architecture for all views.

Purpose: Enforce architecture consistency -- every view should be an extension-contributed blade managed by the navigation machine, including the initial welcome screen. This eliminates the special-case conditional rendering in App.tsx.

Output: A `welcome-screen` extension under `src/extensions/welcome-screen/` with blade registration, and an updated `App.tsx` that uses the blade registry to render the welcome view.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/App.tsx
@src/core/components/WelcomeView.tsx
@src/core/components/welcome/AnimatedGradientBg.tsx
@src/core/components/welcome/GitInitBanner.tsx
@src/core/components/welcome/GitInitFallbackBanner.tsx
@src/core/components/RecentRepos.tsx
@src/core/components/clone/CloneForm.tsx
@src/extensions/init-repo/index.ts
@src/extensions/init-repo/manifest.json
@src/extensions/ExtensionAPI.ts
@src/extensions/extensionCategories.ts
@src/core/lib/bladeRegistry.ts
@src/core/stores/bladeTypes.ts
@src/core/machines/navigation/navigationMachine.ts
@src/core/machines/navigation/types.ts
@src/core/machines/navigation/actions.ts
@src/core/machines/navigation/context.tsx
@src/core/lib/bladeOpener.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create welcome-screen extension with blade and migrated components</name>
  <files>
    src/extensions/welcome-screen/index.ts
    src/extensions/welcome-screen/manifest.json
    src/extensions/welcome-screen/README.md
    src/extensions/welcome-screen/blades/WelcomeBlade.tsx
    src/extensions/welcome-screen/components/WelcomeContent.tsx
    src/extensions/welcome-screen/components/AnimatedGradientBg.tsx
    src/extensions/welcome-screen/components/GitInitBanner.tsx
    src/extensions/welcome-screen/components/GitInitFallbackBanner.tsx
    src/extensions/welcome-screen/components/RecentRepos.tsx
    src/extensions/welcome-screen/components/index.ts
    src/extensions/extensionCategories.ts
    src/core/stores/bladeTypes.ts
  </files>
  <action>
Create the `welcome-screen` extension following the established extension directory convention.

**manifest.json:** Standard manifest with id "welcome-screen", name "Welcome Screen", version "1.0.0", blade contribution for type "welcome-screen" (singleton: true), no commands or toolbar contributions.

**index.ts:** Export `onActivate(api: ExtensionAPI)` and `onDeactivate()`. In onActivate:
- Lazy-import WelcomeBlade
- `api.registerBlade({ type: "welcome-screen", title: "Welcome", component: WelcomeBlade, singleton: true, lazy: true, coreOverride: true })` -- use `coreOverride: true` so the blade type is "welcome-screen" (not "ext:welcome-screen:welcome-screen")

**blades/WelcomeBlade.tsx:** A thin blade wrapper component. It renders WelcomeContent. It also handles the "pushed blade" overlay logic that currently lives in WelcomeView (watching bladeStack for Settings/Extension Manager pushed via command palette). Use `useNavigationActorRef` and `useSelector` with `selectBladeStack` exactly as in current WelcomeView. When a blade is pushed on top, render `<BladeRenderer>` for that blade. Otherwise render `<WelcomeContent />`.

**components/WelcomeContent.tsx:** Move ALL the welcome screen UI logic from the current `WelcomeView.tsx`:
- App icon, title "Welcome to FlowForge", subtitle
- Open Repository button (opens native dialog, checks if git repo, opens or triggers init flow)
- Clone Repository button (shows CloneForm inline)
- Keyboard shortcut listener for `open-repository-dialog` and `clone-repository-dialog` events
- Drag-and-drop support for folder opening
- Error display for failed repo opens
- Git init banner integration (checks init-repo blade registration, shows GitInitBanner or GitInitFallbackBanner)
- RecentRepos list
- AnimatedGradientBg
- All the state: isDragOver, showCloneForm, pendingInitPath, showInitRepo
- The init-repo blade rendering when showInitRepo is true (loads InitComponent from blade registry)

Import paths must be adjusted since we are now inside `src/extensions/welcome-screen/`:
- `../../core/components/clone/CloneForm` for CloneForm
- `../../core/hooks/useRecentRepos` for useRecentRepos
- `../../core/lib/animations` for fadeInUp, staggerContainer, staggerItem
- `../../core/lib/bladeRegistry` for useBladeRegistry
- `../../core/lib/platform` for modKeyLabel
- `../../core/machines/navigation/context` for useNavigationActorRef
- `../../core/stores/domain/git-ops` for useGitOpsStore
- `../../bindings` for commands
- `../../../src-tauri/icons/icon.png` for appIcon (adjust relative path: from extensions/welcome-screen/components/ it becomes `../../../../src-tauri/icons/icon.png`)

**Move component files from core to extension:**
- Copy `src/core/components/welcome/AnimatedGradientBg.tsx` to `src/extensions/welcome-screen/components/AnimatedGradientBg.tsx` -- update import for animations from `../../core/lib/animations` (no change needed since AnimatedGradientBg doesn't import from animations)
- Copy `src/core/components/welcome/GitInitBanner.tsx` to `src/extensions/welcome-screen/components/GitInitBanner.tsx` -- update import: `../../lib/animations` becomes `../../../core/lib/animations`, `../ui/button` becomes `../../../core/components/ui/button`
- Copy `src/core/components/welcome/GitInitFallbackBanner.tsx` to `src/extensions/welcome-screen/components/GitInitFallbackBanner.tsx` -- update imports: `../../../bindings` becomes `../../../bindings`, `../../lib/animations` becomes `../../../core/lib/animations`, `../ui/button` becomes `../../../core/components/ui/button`
- Copy `src/core/components/RecentRepos.tsx` to `src/extensions/welcome-screen/components/RecentRepos.tsx` -- update imports: `../hooks/useRecentRepos` becomes `../../../core/hooks/useRecentRepos`, `../stores/domain/git-ops` becomes `../../../core/stores/domain/git-ops`, `./ui/button` becomes `../../../core/components/ui/button`

**components/index.ts:** Barrel export for AnimatedGradientBg, GitInitBanner, GitInitFallbackBanner, RecentRepos.

**bladeTypes.ts:** Add `"welcome-screen": Record<string, never>` to the BladePropsMap interface.

**extensionCategories.ts:** Add `"welcome-screen": "setup"` to the EXTENSION_CATEGORIES map.

IMPORTANT: Do NOT remove the original `src/core/components/WelcomeView.tsx` or `src/core/components/welcome/` yet -- that happens in Task 2 when we update App.tsx. Keep originals until the new extension is wired in.
  </action>
  <verify>
    Run `npx tsc --noEmit 2>&1 | grep -v "bindings.ts"` -- no new type errors in the welcome-screen extension files.
    Verify files exist: `ls src/extensions/welcome-screen/index.ts src/extensions/welcome-screen/manifest.json src/extensions/welcome-screen/blades/WelcomeBlade.tsx src/extensions/welcome-screen/components/WelcomeContent.tsx`
  </verify>
  <done>
    The welcome-screen extension directory exists with all files following the standard extension convention. manifest.json declares the blade. index.ts registers it via ExtensionAPI. The blade and components contain all migrated welcome screen logic. BladePropsMap includes "welcome-screen". extensionCategories includes "welcome-screen".
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire extension into App.tsx and remove old WelcomeView</name>
  <files>
    src/App.tsx
    src/core/components/WelcomeView.tsx
    src/core/components/welcome/AnimatedGradientBg.tsx
    src/core/components/welcome/GitInitBanner.tsx
    src/core/components/welcome/GitInitFallbackBanner.tsx
    src/core/components/welcome/index.ts
    src/core/components/RecentRepos.tsx
  </files>
  <action>
**Update App.tsx:**

1. Add import for the new welcome-screen extension:
   ```
   import { onActivate as welcomeActivate, onDeactivate as welcomeDeactivate } from "./extensions/welcome-screen";
   ```

2. Register the welcome-screen built-in extension in the useEffect alongside the other registerBuiltIn calls:
   ```
   registerBuiltIn({
     id: "welcome-screen",
     name: "Welcome Screen",
     version: "1.0.0",
     activate: welcomeActivate,
     deactivate: welcomeDeactivate,
   });
   ```

3. Replace the direct WelcomeView rendering. The current logic is:
   ```
   {status ? <RepositoryView /> : <WelcomeView />}
   ```

   Change to render the welcome blade from the blade registry when no repo is open. Use `useBladeRegistry` to look up the `"welcome-screen"` blade registration, then render its component. If the extension is disabled/not registered, show a minimal fallback:
   ```tsx
   {status ? (
     <RepositoryView />
   ) : (
     <WelcomeScreen />
   )}
   ```

   Create a small `WelcomeScreen` component (inline in App.tsx or extracted) that:
   - Gets the welcome-screen blade registration from `useBladeRegistry(s => s.blades.get("welcome-screen"))`
   - If registered: renders `<Suspense fallback={<LoadingFallback />}><WelcomeComponent /></Suspense>` where WelcomeComponent is the registered component
   - If NOT registered (extension disabled): renders a minimal fallback with just an "Open Repository" button and the keyboard shortcut hint -- this ensures the app never gets stuck

4. Remove the `import { WelcomeView } from "./core/components/WelcomeView"` line.

5. Add import for `Suspense` from React if not already imported.

**Delete old files:**
- Delete `src/core/components/WelcomeView.tsx` (fully replaced by extension)
- Delete `src/core/components/welcome/AnimatedGradientBg.tsx` (moved to extension)
- Delete `src/core/components/welcome/GitInitBanner.tsx` (moved to extension)
- Delete `src/core/components/welcome/GitInitFallbackBanner.tsx` (moved to extension)
- Delete `src/core/components/welcome/index.ts` (barrel no longer needed)
- Delete `src/core/components/RecentRepos.tsx` (moved to extension)

**Verify no other files import from the deleted paths.** Check for any imports of:
- `../components/WelcomeView` or `./core/components/WelcomeView`
- `../components/welcome` or `./welcome`
- `../components/RecentRepos` or `./RecentRepos`

The only consumer of RecentRepos was WelcomeView. The only consumer of the welcome/ barrel was WelcomeView. If the GitHub auth blade references "welcome" in a comment, that's fine -- just ensure no actual imports break.
  </action>
  <verify>
    Run `npx tsc --noEmit 2>&1 | grep -v "bindings.ts"` -- no type errors.
    Run `grep -r "WelcomeView\|components/welcome\|components/RecentRepos" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"` -- should return nothing (all references removed).
    Run `npm run dev` and verify the app starts without errors in the terminal.
  </verify>
  <done>
    App.tsx registers the welcome-screen extension and renders its blade when no repo is open. Old WelcomeView and welcome/ directory are deleted. No broken imports remain. The welcome screen appears identically to before but is now delivered through the extension architecture. A minimal fallback exists if the extension is disabled.
  </done>
</task>

<task type="auto">
  <name>Task 3: Clean up and verify full integration</name>
  <files>
    src/extensions/welcome-screen/blades/WelcomeBlade.tsx
  </files>
  <action>
Final verification and cleanup pass:

1. **Verify the blade navigation integration works correctly.** The WelcomeBlade needs to handle the case where blades are pushed onto the navigation stack while on the welcome screen (e.g., user opens Settings or Extension Manager via command palette when no repo is open). Currently WelcomeView reads the bladeStack from the navigation machine and renders a BladeRenderer for the pushed blade. Since the WelcomeBlade IS now a blade in the system, this pushed-blade overlay approach needs to be reconsidered.

   In the current architecture, when no repo is open, the navigation machine is not used for the welcome screen -- it is rendered directly in App.tsx. With the migration, the welcome screen is still rendered directly (from blade registry) NOT via the navigation machine stack. So the pushed-blade overlay pattern should remain: WelcomeBlade still watches the navigation machine's bladeStack and renders any pushed blades on top.

   Make sure WelcomeBlade imports and uses:
   - `useNavigationActorRef` from `../../../core/machines/navigation/context`
   - `useSelector` from `@xstate/react`
   - `selectBladeStack` from `../../../core/machines/navigation/selectors`
   - `BladeRenderer` from `../../../core/blades/_shared/BladeRenderer`

2. **Verify the RecentRepos component path adjustments are correct.** The RecentRepos component in the extension now needs to import from deeper relative paths. Double-check that `useRecentRepos`, `useGitOpsStore`, and `Button` imports resolve correctly.

3. **Check that CloneForm import path from WelcomeContent.tsx is correct:** Should be `../../../core/components/clone/CloneForm`.

4. **Run the test suite** to ensure nothing is broken: `npx vitest run --reporter=verbose 2>&1 | tail -40`.

5. **Verify the extension shows up in Extension Manager** by checking that the manifest.json is properly structured and the extensionCategories map includes it.
  </action>
  <verify>
    Run `npx vitest run 2>&1 | tail -20` -- all existing tests pass.
    Run `npx tsc --noEmit 2>&1 | grep -v "bindings.ts"` -- clean type check.
  </verify>
  <done>
    The welcome-screen extension is fully integrated. Navigation overlays work (Settings/Extension Manager from command palette). All existing tests pass. The welcome screen renders identically to before but through the extension architecture, enforcing consistent blade-based navigation via xstate.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit 2>&1 | grep -v "bindings.ts"` -- no new type errors
2. `npx vitest run` -- all existing tests pass
3. `ls src/extensions/welcome-screen/` -- extension directory exists with standard structure
4. `ls src/core/components/WelcomeView.tsx 2>&1` -- file should NOT exist (deleted)
5. `ls src/core/components/welcome/ 2>&1` -- directory should NOT exist (deleted)
6. `grep -r "registerBuiltIn.*welcome" src/App.tsx` -- extension is registered
7. The app opens to the welcome screen when no repo is loaded
8. Opening a repo transitions to RepositoryView
9. Command palette actions (Settings, Extension Manager) work from the welcome screen
</verification>

<success_criteria>
- Welcome screen is delivered as `src/extensions/welcome-screen/` following standard extension convention
- App.tsx no longer imports WelcomeView directly; uses blade registry to render welcome blade
- Old `src/core/components/WelcomeView.tsx` and `src/core/components/welcome/` are deleted
- Old `src/core/components/RecentRepos.tsx` is deleted (moved to extension)
- BladePropsMap includes "welcome-screen" type
- extensionCategories maps "welcome-screen" to "setup"
- Graceful fallback exists in App.tsx if welcome-screen extension is disabled
- All existing tests pass, no new type errors
- Functionally identical user experience to before the migration
</success_criteria>

<output>
After completion, create `.planning/quick/45-migrate-welcome-screen-to-an-extension-w/45-SUMMARY.md`
</output>
