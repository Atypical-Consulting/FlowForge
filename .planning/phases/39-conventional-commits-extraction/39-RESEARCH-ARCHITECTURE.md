# Phase 39: Conventional Commits Extraction - Architecture Research

**Researched:** 2026-02-10
**Domain:** Extension system, CC form extraction, onWillCommit validation, store splitting, graceful degradation
**Confidence:** HIGH

## Summary

Phase 39 extracts Conventional Commits (CC) functionality from core into a built-in `conventional-commits` extension. This is significantly more complex than Phase 38 (content-viewers) because CC deeply integrates with the commit workflow: it provides a structured form (type/scope/body/breaking), onWillCommit validation, scope autocomplete from Rust backend, type inference, templates, and changelog generation. The core must retain a plain-text commit capability that works when the CC extension is disabled.

The extraction follows the proven Phase 38 pattern: `registerBuiltIn()` in App.tsx, `onActivate(api)` to register blades/commands, `coreOverride` for blade types, and `api.cleanup()` for atomic teardown. However, CC adds new challenges: (1) the sidebar `CommitForm` embeds CC inline via a toggle, requiring the extension to contribute a sidebar panel or widget, (2) onWillCommit validation via GitHookBus, (3) Zustand store that currently uses `createBladeStore` must move to the extension, and (4) the `CommitForm.tsx` must be refactored to conditionally render CC form only when the extension is active.

**Primary recommendation:** Create a single `conventional-commits` built-in extension at `src/extensions/conventional-commits/index.ts` that registers the CC blade (with `coreOverride`), the changelog blade (with `coreOverride`), a sidebar panel contribution for the CC toggle, an onWillCommit validation hook, and toolbar/command contributions for changelog generation. The core `CommitForm` retains the plain textarea and gets a slot-based mechanism for extension-provided form widgets.

---

## 1. Phase 38 Extraction Pattern (Proven Foundation)

### Pattern Summary

```
Phase 38 flow:
  App.tsx
    -> registerBuiltIn({ id: "content-viewers", activate, deactivate })
    -> ExtensionHost creates ExtensionAPI, calls activate(api)
    -> onActivate(api):
         api.registerBlade({ type: "viewer-markdown", coreOverride: true, ... })
         api.registerBlade({ type: "viewer-code",     coreOverride: true, ... })
         api.registerBlade({ type: "viewer-3d",       coreOverride: true, ... })
    -> Deactivation: api.cleanup() removes all registrations
    -> Fallback: RepoBrowserBlade falls back to viewer-plaintext
```

### Key Design Decisions from Phase 38

1. **coreOverride: true** -- Built-in extensions register blades without `ext:{id}:` prefix, preserving existing blade type names so navigation, deep links, and blade stack references continue to work.

2. **Lazy component loading** -- Use `lazy(() => import(...))` inside `onActivate()` so blade components are code-split and only loaded on first render.

3. **Side-effect registration removal** -- The `registration.ts` files in `src/blades/` are deleted for extracted blades; `_discovery.ts` EXPECTED_TYPES list is updated.

4. **BladePropsMap retained** -- Blade type entries stay in `src/stores/bladeTypes.ts` for type safety (they describe the props contract, not who provides the implementation).

5. **Graceful fallback** -- When extension is disabled, blade type becomes unregistered; consumers check `getBladeRegistration()` and fall back to a plain alternative.

---

## 2. CC Component Inventory

### CC-Specific Files (MOVE to extension)

| File | Purpose | Lines |
|------|---------|-------|
| `src/stores/conventional.ts` | Zustand store: CC form state, validation, suggestions, templates | 243 |
| `src/hooks/useConventionalCommit.ts` | Hook wrapping CC store: validation, suggestions, canCommit | 183 |
| `src/components/commit/ConventionalCommitForm.tsx` | Sidebar CC form component | 167 |
| `src/components/commit/TypeSelector.tsx` | Type grid selector with suggestion banner | 85 |
| `src/components/commit/ScopeAutocomplete.tsx` | Scope input with dropdown autocomplete | 206 |
| `src/components/commit/BreakingChangeSection.tsx` | Breaking change checkbox + description | 55 |
| `src/components/commit/CharacterProgress.tsx` | Animated character count bar | 53 |
| `src/components/commit/CommitPreview.tsx` | Message preview with syntax highlighting | 198 |
| `src/components/commit/ValidationErrors.tsx` | Validation error/warning/success display | 71 |
| `src/components/commit/CommitActionBar.tsx` | Commit/push/amend action buttons | 109 |
| `src/components/commit/TemplateSelector.tsx` | Quick-start template chips | 88 |
| `src/components/commit/ScopeFrequencyChart.tsx` | Scope usage frequency bar chart | 124 |
| `src/components/commit/index.ts` | Barrel export for commit components | 6 |
| `src/blades/conventional-commit/ConventionalCommitBlade.tsx` | Full-width CC blade with split pane | 363 |
| `src/blades/conventional-commit/registration.ts` | Core blade registration (to be removed) | 17 |
| `src/blades/conventional-commit/index.ts` | Barrel export | 1 |
| `src/blades/conventional-commit/hooks/useBladeFormGuard.ts` | Dirty form guard for navigation FSM | 38 |
| `src/blades/changelog/ChangelogBlade.tsx` | Changelog generation blade | 117 |
| `src/blades/changelog/registration.ts` | Core blade registration (to be removed) | 10 |
| `src/blades/changelog/store.ts` | Zustand store for changelog generation | 82 |
| `src/blades/changelog/components/ChangelogPreview.tsx` | Changelog preview with copy/breakdown | 122 |
| `src/lib/conventional-utils.ts` | Build/parse CC messages (pure functions) | 114 |
| `src/lib/conventional-utils.test.ts` | Tests for conventional-utils | -- |
| `src/lib/commit-type-theme.ts` | CC type icons, colors, badge classes | 155 |
| `src/lib/commit-templates.ts` | Built-in commit templates | 59 |

### Shared/Cross-Cutting Files (STAY in core but may need decoupling)

| File | CC Usage | Core Usage |
|------|----------|------------|
| `src/components/commit/CommitForm.tsx` | Embeds `ConventionalCommitForm`, toggle, CC blade open check | Plain textarea commit (core) |
| `src/hooks/useCommitExecution.ts` | Used by CC blade and CommitForm | Core commit/push mutations |
| `src/hooks/useAmendPrefill.ts` | `prefillConventional()` parses CC | Simple amend mode (core) |
| `src/components/icons/CommitTypeIcon.tsx` | Uses `commit-type-theme` | Used by topology graph, commit details |
| `src/blades/topology-graph/components/CommitBadge.tsx` | Uses `commit-type-theme` for icons | Core topology rendering |
| `src/blades/topology-graph/components/layoutUtils.ts` | `parseConventionalType()` | Core graph layout |
| `src/stores/bladeTypes.ts` | `conventional-commit` and `changelog` entries | Type safety for all blades |
| `src/blades/_discovery.ts` | Lists `conventional-commit` and `changelog` in EXPECTED_TYPES | Core blade discovery |
| `src/commands/repository.ts` | `generate-changelog` command | Core commands |
| `src/commands/toolbar-actions.ts` | `tb:changelog` toolbar action | Core toolbar |

### Rust Backend Commands (CC-specific, called from extension code)

| Command | Called From |
|---------|------------|
| `commands.suggestCommitType()` | `conventional.ts` store |
| `commands.getScopeSuggestions(limit)` | `conventional.ts` store |
| `commands.inferScopeFromStaged()` | `conventional.ts` store |
| `commands.validateConventionalCommit(message)` | `conventional.ts` store |
| `commands.generateChangelogCmd(from, to, version)` | `changelog/store.ts` |
| `commands.getLastCommitMessage()` | `useAmendPrefill.ts` (shared) |

---

## 3. Dependency Graph

### What CC Depends On (from core)

```
CC Extension
  -> bindings.ts (CommitType, ScopeSuggestion, TypeSuggestion, ValidationResult,
                  ChangelogOutput, CommitGroup, ChangelogCommit, LastCommitMessage)
  -> lib/utils.ts (cn, debounce)
  -> lib/bladeRegistry.ts (registerBlade -- via ExtensionAPI)
  -> lib/gitHookBus.ts (onWillGit -- via ExtensionAPI)
  -> hooks/useCommitExecution.ts (commit, push mutations)
  -> hooks/useAmendPrefill.ts (prefillConventional)
  -> hooks/useBladeNavigation.ts (openBlade, goBack, bladeStack)
  -> machines/navigation/context.ts (useNavigationActorRef for form guard)
  -> components/layout/SplitPaneLayout.tsx
  -> stores/createBladeStore.ts (for CC store creation)
  -> blades/_shared/ (BladeContentLoading, etc. -- not directly used by CC)
  -> framer-motion, lucide-react (UI deps)
```

### What Core Depends On (from CC)

```
Core
  -> commit-type-theme.ts      <-- Used by CommitBadge, CommitTypeIcon, CommitPreview
  -> conventional-utils.ts     <-- Used by CommitPreview (parseConventionalMessage),
                                    CommitTypeIcon (via layoutUtils.parseConventionalType),
                                    useAmendPrefill (parseConventionalMessage)
  -> stores/conventional.ts    <-- CommitType re-export used by TypeSelector
  -> CommitForm.tsx             <-- Embeds ConventionalCommitForm inline
```

### Coupling Points That Need Breaking

1. **CommitForm.tsx embeds ConventionalCommitForm** -- The sidebar's `CommitForm` directly imports and renders the CC form when the toggle is active. This must become a slot/portal where the extension contributes its form.

2. **commit-type-theme.ts used by topology graph** -- `CommitBadge` and `CommitTypeIcon` use `COMMIT_TYPE_THEME` for icon/color display. This is a read-only theme map that provides visual consistency. **Decision: Keep in core as shared theme data.** CC types are a widely-recognized convention; even non-CC users see these in commit history.

3. **conventional-utils.ts used for parsing** -- `parseConventionalMessage()` and `parseConventionalType()` are used by core topology graph and commit detail views to detect CC format. **Decision: Keep in core as shared parsing utilities.** These are pure functions with zero side effects.

4. **useAmendPrefill references CC parsing** -- The `prefillConventional()` method parses commit messages into CC parts. **Decision: Move `prefillConventional` to extension, keep `toggleAmend` in core.**

5. **"generate-changelog" command and toolbar action** -- Currently registered as core commands. **Decision: Move to extension's `onActivate()` using `api.registerCommand()` and `api.contributeToolbar()`.**

---

## 4. ExtensionAPI Surface Requirements

### Existing Methods (sufficient)

| Method | Used For |
|--------|----------|
| `api.registerBlade(config)` | Register `conventional-commit` and `changelog` blade types (with `coreOverride: true`) |
| `api.registerCommand(config)` | Register `generate-changelog` command |
| `api.contributeToolbar(config)` | Register changelog toolbar action |
| `api.onWillGit("commit", handler)` | Register CC validation as onWillCommit middleware |
| `api.onDidGit("commit", handler)` | Post-commit hooks (e.g., reset CC form state) |
| `api.onDispose(disposable)` | Custom cleanup (store subscriptions, event listeners) |

### New Method Needed: `api.contributeCommitForm(config)`

The CC extension needs to contribute a commit form widget to the sidebar's `CommitForm`. This is NOT covered by existing API surface.

**Proposed Design:**

```typescript
interface CommitFormContribution {
  id: string;
  label: string;        // "Conventional Commits" -- shown as toggle label
  priority: number;     // Display order among contributed forms
  component: ComponentType<CommitFormSlotProps>;
  when?: () => boolean; // Visibility predicate
}

interface CommitFormSlotProps {
  onCommit: (message: string) => void;
  disabled: boolean;
  hasStagedFiles: boolean;
}

// ExtensionAPI method:
contributeCommitForm(config: CommitFormContribution): void;
```

**Alternative (simpler): CommitForm slot via SidebarPanelRegistry**

Instead of a new API method, the CC extension could contribute a sidebar panel that replaces/augments the commit section. However, the current `CommitForm` is embedded at the bottom of the left panel, not in a sidebar registry slot. The simplest approach may be:

1. Create a `useCommitFormRegistry` Zustand store (like `useToolbarRegistry`)
2. `CommitForm.tsx` reads from this registry to render contributed forms
3. CC extension calls `api.contributeCommitForm()` during activation
4. When extension is disabled, registry is empty, CommitForm shows only plain textarea

**Recommendation:** Use the CommitFormRegistry approach. It's minimal, follows existing patterns, and cleanly separates core from extension.

### New Method Needed: `api.contributeStatusBar(config)` (already exists)

CC validation status can be shown in the status bar. This is already supported.

---

## 5. onWillCommit Hook Pattern Analysis

### GitHookBus Implementation

```typescript
// src/lib/gitHookBus.ts
class GitHookBus {
  // Pre-operation handlers -- can cancel the operation
  onWill(operation: GitOperation, handler: WillHandler, source: string, priority?: number): () => void

  // Emit pre-operation event -- returns { cancel?: boolean, reason?: string }
  async emitWill(operation: GitOperation, ctx?): Promise<WillHookResult>
}

type WillHandler = (ctx: GitHookContext) => WillHookResult | Promise<WillHookResult | void> | void;

interface WillHookResult {
  cancel?: boolean;
  reason?: string;
}
```

### Key Behaviors

1. **Priority-sorted execution** -- `emitWill()` sorts handlers by priority (descending), executes serially.
2. **Short-circuit on cancel** -- If any handler returns `{ cancel: true }`, the loop stops immediately.
3. **Fail-open** -- Errors in handlers do NOT cancel the operation (logged, not propagated).
4. **`commitMessage` in context** -- `GitHookContext` includes `commitMessage?: string`.

### Current Usage Gap

**IMPORTANT:** `useCommitExecution.ts` does NOT currently call `emitWill("commit")` before committing. It directly calls `commands.createCommit()` and then calls `emitDid("commit")` on success. This means **onWillCommit validation is not yet wired into the commit flow**.

```typescript
// useCommitExecution.ts (current)
const commitMutation = useMutation({
  mutationFn: ({ message, amend }) => commands.createCommit(message, amend),
  onSuccess: (_data, { message }) => {
    gitHookBus.emitDid("commit", { commitMessage: message }); // post-commit only
    // ...
  },
});
```

### Required Fix: Add emitWill to Commit Flow

```typescript
// useCommitExecution.ts (proposed)
const commit = async (message: string, amend = false) => {
  // Pre-commit validation via GitHookBus
  const willResult = await gitHookBus.emitWill("commit", { commitMessage: message });
  if (willResult.cancel) {
    toast.warning(`Commit blocked: ${willResult.reason || "Validation failed"}`);
    return;
  }
  await commitMutation.mutateAsync({ message, amend });
};
```

### CC Extension onWillCommit Handler

```typescript
// In CC extension onActivate:
api.onWillGit("commit", async (ctx) => {
  if (!ctx.commitMessage) return;

  // Only validate if CC mode is active
  const ccStore = useConventionalStore.getState();
  if (ccStore.commitType === "") return; // Not using CC mode

  const result = await commands.validateConventionalCommit(ctx.commitMessage);
  if (!result.isValid && result.errors.length > 0) {
    return {
      cancel: true,
      reason: result.errors.map(e => e.message).join("; "),
    };
  }
});
```

---

## 6. Store Architecture

### Current State

```
src/stores/conventional.ts (createBladeStore)
  - Form state: commitType, scope, description, body, isBreaking, breakingDescription
  - Blade state: isAmend, pushAfterCommit, activeTemplate, scopeFrequencies
  - Suggestions: typeSuggestion, scopeSuggestions, inferredScope
  - Validation: validation, isValidating
  - Actions: setters, fetch*, validateMessage, buildCommitMessage, reset

src/blades/changelog/store.ts (createBladeStore)
  - Options: fromRef, toRef, version
  - Output: changelog, isGenerating, error
  - Actions: setters, generate, reset
```

### Store Splitting Strategy

**What moves to extension:**
- `useConventionalStore` (entire store) -- ALL CC form state, suggestions, validation
- `useChangelogStore` (entire store) -- Changelog generation state
- `COMMIT_TYPES` array, `COMMIT_TYPE_LABELS` map -- CC type definitions

**What stays in core:**
- `commit-type-theme.ts` (`COMMIT_TYPE_THEME`) -- Visual theme data used by topology graph
- `conventional-utils.ts` (`buildCommitMessage`, `parseConventionalMessage`) -- Pure parsing utilities
- `useCommitExecution.ts` -- Core commit/push mutations
- `useAmendPrefill.ts` (refactored) -- Core amend toggle; `prefillConventional()` moves to extension
- `CommitForm.tsx` (refactored) -- Core plain textarea commit; CC form contributed via registry

### Extension Store Location

```
src/extensions/conventional-commits/
  stores/
    conventionalStore.ts     <-- CC form state (moved from stores/conventional.ts)
    changelogStore.ts        <-- Changelog state (moved from blades/changelog/store.ts)
  components/
    ConventionalCommitForm.tsx
    TypeSelector.tsx
    ScopeAutocomplete.tsx
    BreakingChangeSection.tsx
    CharacterProgress.tsx
    CommitPreview.tsx
    ValidationErrors.tsx
    CommitActionBar.tsx
    TemplateSelector.tsx
    ScopeFrequencyChart.tsx
  blades/
    ConventionalCommitBlade.tsx
    ChangelogBlade.tsx
    ChangelogPreview.tsx
  hooks/
    useConventionalCommit.ts
    useBladeFormGuard.ts     <-- Can stay as generic hook in core if generalized
  data/
    commit-templates.ts
  index.ts                   <-- onActivate / onDeactivate
```

### Store Creation Approach

The extension store can use `createBladeStore` from core (it's a generic utility), or use `create()`/`devtools()` directly. Since the store will be scoped to the extension module, using `create()` directly is cleaner:

```typescript
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export const useConventionalStore = create<ConventionalState>()(
  devtools((set, get) => ({ ... }), { name: "ext:conventional-commits", enabled: import.meta.env.DEV })
);
```

The store is module-scoped -- created when the extension module is imported, accessible while the extension is active. When the extension is deactivated, the store still exists in memory but is not referenced by any rendered components.

---

## 7. Graceful Degradation Design

### When CC Extension is Disabled

| Feature | Behavior |
|---------|----------|
| CommitForm sidebar | Shows plain textarea only; no "Conventional Commits" toggle |
| "conventional-commit" blade type | Unregistered; opening it shows fallback or does nothing |
| "changelog" blade type | Unregistered; toolbar/command removed |
| Commit validation | No onWillCommit handlers; commits go through unchecked |
| Topology graph CommitBadge | Still shows CC-type icons (uses core `commit-type-theme.ts`) |
| CommitTypeIcon | Still works (uses core `commit-type-theme.ts`) |
| Amend pre-fill | Simple mode works; CC parsing still works (core `conventional-utils.ts`) |

### CommitForm Refactoring

Current `CommitForm.tsx` has a hard dependency on `ConventionalCommitForm`:
```tsx
import { ConventionalCommitForm } from "./ConventionalCommitForm";
// ... renders <ConventionalCommitForm> when useConventional is true
```

**After extraction:**
```tsx
// CommitForm.tsx reads from CommitFormRegistry
const contributedForms = useCommitFormRegistry((s) => s.contributions);

// If CC extension is active, contributedForms has an entry
// If disabled, contributedForms is empty, only plain textarea shown
```

### Blade Fallback

When "conventional-commit" blade is opened but extension is disabled:
- `getBladeRegistration("conventional-commit")` returns `undefined`
- BladeRenderer shows a fallback message: "This feature requires the Conventional Commits extension"
- Alternatively, redirect to the plain commit form in the sidebar

---

## 8. Extraction Sequence (Recommended Order)

### Step 1: Infrastructure (no user-visible changes)

1. Create `useCommitFormRegistry` Zustand store (like `useToolbarRegistry`)
2. Add `contributeCommitForm()` to `ExtensionAPI`
3. Wire `emitWill("commit")` into `useCommitExecution.ts` (enables future validation)
4. Refactor `CommitForm.tsx` to read from commit form registry (renders contributed forms or plain textarea)
5. Refactor `useAmendPrefill.ts` -- extract `prefillConventional()` into a separate function that can be called from extension code

### Step 2: Create Extension Structure

1. Create `src/extensions/conventional-commits/index.ts` with `onActivate`/`onDeactivate`
2. Move CC components from `src/components/commit/` to `src/extensions/conventional-commits/components/`
3. Move CC stores from `src/stores/conventional.ts` and `src/blades/changelog/store.ts`
4. Move CC blades from `src/blades/conventional-commit/` and `src/blades/changelog/`
5. Move `src/lib/commit-templates.ts` to extension
6. Move `src/hooks/useConventionalCommit.ts` to extension
7. Update all internal imports within moved files

### Step 3: Extension Registration

1. In `onActivate(api)`:
   - `api.registerBlade({ type: "conventional-commit", coreOverride: true, ... })`
   - `api.registerBlade({ type: "changelog", coreOverride: true, ... })`
   - `api.contributeCommitForm({ id: "cc-form", label: "Conventional Commits", component: ... })`
   - `api.registerCommand({ id: "generate-changelog", ... })`
   - `api.contributeToolbar({ id: "changelog", ... })`
   - `api.onWillGit("commit", ccValidationHandler)`
2. Register in `App.tsx` alongside content-viewers and github:
   ```tsx
   registerBuiltIn({
     id: "conventional-commits",
     name: "Conventional Commits",
     version: "1.0.0",
     activate: ccActivate,
     deactivate: ccDeactivate,
   });
   ```

### Step 4: Cleanup Core

1. Remove `src/blades/conventional-commit/registration.ts`
2. Remove `src/blades/changelog/registration.ts`
3. Update `_discovery.ts` EXPECTED_TYPES -- remove `conventional-commit` and `changelog`
4. Remove CC-specific imports from `src/components/commit/CommitForm.tsx`
5. Remove `generate-changelog` command from `src/commands/repository.ts`
6. Remove `tb:changelog` action from `src/commands/toolbar-actions.ts`
7. Clean up unused barrel exports in `src/components/commit/index.ts`

### Step 5: Testing and Verification

1. Extension active: All CC features work (form, validation, templates, changelog)
2. Extension disabled: Plain textarea commit works, no CC UI visible
3. Extension re-enabled: CC features return without page reload
4. HMR: Development hot-reload works correctly
5. Blade navigation: Opening CC blade when disabled shows fallback

---

## 9. Extensibility Patterns for Phase 40 (Gitflow)

### Generalizable Patterns from This Extraction

1. **CommitFormRegistry** -- The slot mechanism for contributed commit forms can be reused by Gitflow to contribute branch-aware commit forms or commit message templates.

2. **contributeToolbar/contributeCommand** -- Gitflow will need toolbar actions (start feature, finish feature, start release, etc.) and commands.

3. **onWillGit hooks** -- Gitflow may need onWillCheckout, onWillMerge, onWillPush to enforce branch policies.

4. **coreOverride blade pattern** -- Gitflow may override the branch creation/management blades.

5. **SidebarPanelRegistry** -- Gitflow panel is already in core (`GitflowPanel`); it should move to `api.contributeSidebarPanel()`.

### Pre-extraction Opportunities

During Phase 39, consider these preparations for Phase 40:

- **Ensure `CommitFormRegistry` is generic enough** for Gitflow to contribute merge commit forms
- **Verify `onWillGit` covers all Gitflow operations** -- branch-create, branch-delete, merge, checkout
- **Design a `contributeBranchPolicy` API** (or defer to Phase 40 planning)
- **Keep the `GitflowPanel` sidebar contribution pattern in mind** when designing CommitFormRegistry

---

## 10. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| CommitForm refactoring breaks sidebar commit flow | HIGH | Write unit tests for CommitForm before refactoring; test both plain and CC modes |
| onWillCommit wiring changes commit behavior | MEDIUM | Fail-open design (errors don't block); add flag to bypass validation |
| Store migration loses state during HMR | LOW | Extension stores are module-scoped; HMR reloads the module |
| Topology graph breaks without theme data | LOW | Keep `commit-type-theme.ts` in core; no dependency on CC extension |
| Circular imports between extension and core | MEDIUM | Extension imports from core are one-way; core must NOT import from extension |
| CC blade opened while extension disabled | LOW | BladeRenderer already handles missing registrations with fallback |

---

## 11. Files That Stay in Core (Shared Utilities)

These files contain CC-aware functionality but are used by core features (topology graph, commit details) and should remain in `src/lib/`:

1. **`src/lib/commit-type-theme.ts`** -- Icon/color theme map. Used by `CommitBadge`, `CommitTypeIcon`. Pure data, no CC store dependency.

2. **`src/lib/conventional-utils.ts`** -- `buildCommitMessage()` and `parseConventionalMessage()`. Pure functions. Used by `CommitPreview`, `useAmendPrefill`, `layoutUtils.ts`.

3. **`src/components/icons/CommitTypeIcon.tsx`** -- Generic icon component. Uses theme map. Used by topology graph, changelog preview.

These create a **read-only CC protocol layer** in core -- the ability to recognize and display CC format. The extension provides the **write side** -- the form, validation, and structured commit creation.

---

## 12. Dependency Diagram

```
                           CORE
  +---------------------------------------------------------+
  |                                                         |
  |  lib/                    hooks/                         |
  |    commit-type-theme.ts    useCommitExecution.ts        |
  |    conventional-utils.ts   useAmendPrefill.ts (trimmed) |
  |    bladeRegistry.ts        useBladeNavigation.ts        |
  |    gitHookBus.ts                                        |
  |    commitFormRegistry.ts (NEW)                          |
  |                                                         |
  |  components/                                            |
  |    commit/CommitForm.tsx (reads from registry)          |
  |    icons/CommitTypeIcon.tsx                              |
  |                                                         |
  |  blades/                                                |
  |    topology-graph/ (uses commit-type-theme)             |
  |                                                         |
  |  stores/bladeTypes.ts (type entries remain)             |
  +---------------------------------------------------------+
          |                         ^
          | ExtensionAPI            | imports (one-way)
          v                         |
  +---------------------------------------------------------+
  |              EXTENSION: conventional-commits             |
  |                                                         |
  |  index.ts (onActivate/onDeactivate)                     |
  |                                                         |
  |  stores/                                                |
  |    conventionalStore.ts                                 |
  |    changelogStore.ts                                    |
  |                                                         |
  |  components/                                            |
  |    ConventionalCommitForm.tsx                            |
  |    TypeSelector.tsx, ScopeAutocomplete.tsx               |
  |    BreakingChangeSection.tsx, CharacterProgress.tsx      |
  |    CommitPreview.tsx, ValidationErrors.tsx               |
  |    CommitActionBar.tsx, TemplateSelector.tsx             |
  |    ScopeFrequencyChart.tsx                               |
  |                                                         |
  |  blades/                                                |
  |    ConventionalCommitBlade.tsx                           |
  |    ChangelogBlade.tsx, ChangelogPreview.tsx              |
  |                                                         |
  |  hooks/                                                 |
  |    useConventionalCommit.ts                             |
  |    useBladeFormGuard.ts                                 |
  |                                                         |
  |  data/                                                  |
  |    commit-templates.ts                                  |
  +---------------------------------------------------------+
```

**Arrow directions are critical:** Extension imports from core (bindings, utils, hooks). Core NEVER imports from extension. The `CommitFormRegistry` is the bridge -- extension writes to it during activation, core reads from it during rendering.
