# Phase 39: Conventional Commits Extension Extraction -- Implementation Research

## 1. Rust-Side Analysis

### 1.1 CC-Related Rust Modules

| File | Lines | Purpose | IPC Commands | Stays Backend? |
|------|-------|---------|-------------|----------------|
| `src-tauri/src/git/conventional.rs` | 913 | CC parsing, validation, type inference, scope extraction | `validate_conventional_commit`, `suggest_commit_type`, `get_scope_suggestions`, `infer_scope_from_staged` | YES |
| `src-tauri/src/git/changelog.rs` | 607 | Changelog generation from CC history | `generate_changelog_cmd` | YES |
| `src-tauri/src/git/commit.rs` | 214 | Generic commit creation (not CC-specific) | `create_commit`, `get_last_commit_message` | YES (core) |

### 1.2 Rust Dependencies

```
conventional.rs -> git::history::CommitSummary
conventional.rs -> git::staging::FileChange
conventional.rs -> git::error::GitError
conventional.rs -> git::repository::RepositoryState
conventional.rs -> git_conventional (crate)

changelog.rs -> chrono, git2, tera, serde, specta
changelog.rs -> git::error::GitError
changelog.rs -> git::repository::RepositoryState
```

### 1.3 IPC Command Registration (lib.rs)

Lines 20-23 of `src-tauri/src/lib.rs`:
```rust
conventional::{
    get_scope_suggestions, infer_scope_from_staged, suggest_commit_type,
    validate_conventional_commit,
},
```

Line 15: `changelog::generate_changelog_cmd`

These are registered in the `collect_commands!` macro at lines 130-133.

### 1.4 Recommendation: Rust Code Stays in Backend

All Rust code stays in the backend. The IPC commands are called by the frontend via `commands.*` bindings. The extension extraction is purely a frontend concern -- the backend provides CC parsing/validation as a service regardless of whether an extension is active or not.

Key insight: The Rust `conventional.rs` and `changelog.rs` modules are **service providers**, not presentation logic. They remain available even when the CC extension is disabled. The frontend extension simply stops using them.

---

## 2. React Component Extraction Map

### 2.1 Components to Move INTO Extension

These components are CC-specific and should be owned by the extension:

| Component | Current Path | Props Interface | Dependencies |
|-----------|-------------|-----------------|--------------|
| `ConventionalCommitBlade` | `src/blades/conventional-commit/ConventionalCommitBlade.tsx` | `{ amend?: boolean }` | useConventionalCommit, useCommitExecution, useAmendPrefill, useBladeFormGuard, useConventionalStore, SplitPaneLayout, all commit/* components |
| `ConventionalCommitForm` | `src/components/commit/ConventionalCommitForm.tsx` | `{ onCommit, onCancel?, disabled? }` | useConventionalCommit, TypeSelector, ScopeAutocomplete, BreakingChangeSection, CharacterProgress, CommitActionBar, CommitPreview, ValidationErrors |
| `TypeSelector` | `src/components/commit/TypeSelector.tsx` | `{ value, onChange, suggestion, onApplySuggestion, columns? }` | framer-motion, COMMIT_TYPE_THEME, COMMIT_TYPES |
| `ScopeAutocomplete` | `src/components/commit/ScopeAutocomplete.tsx` | `{ value, onChange, suggestions, inferredScope, onApplySuggestion }` | basic React |
| `BreakingChangeSection` | `src/components/commit/BreakingChangeSection.tsx` | `{ isBreaking, onBreakingChange, description, onDescriptionChange }` | Lucide icons, cn |
| `CharacterProgress` | `src/components/commit/CharacterProgress.tsx` | `{ current, max, warningThreshold }` | cn |
| `ValidationErrors` | `src/components/commit/ValidationErrors.tsx` | `{ validation, isValidating }` | bindings types |
| `CommitPreview` | `src/components/commit/CommitPreview.tsx` | `{ message, variant }` | parseConventionalMessage |
| `CommitActionBar` | `src/components/commit/CommitActionBar.tsx` | `{ canCommit, isCommitting?, isPushing?, amend?, showPush?, onCommit, onCommitAndPush?, onCancel?, disabled? }` | Lucide icons, Button |
| `TemplateSelector` | `src/components/commit/TemplateSelector.tsx` | `{ onApply, isFormEmpty, activeTemplateId? }` | BUILTIN_TEMPLATES, useConventionalStore |
| `ScopeFrequencyChart` | `src/components/commit/ScopeFrequencyChart.tsx` | `{ frequencies, onScopeClick }` | basic React |
| `ChangelogBlade` | `src/blades/changelog/ChangelogBlade.tsx` | `{}` | useChangelogStore, Button, ChangelogPreview |
| `ChangelogPreview` | `src/blades/changelog/components/ChangelogPreview.tsx` | `{ changelog }` | bindings types |

### 2.2 Hooks to Move INTO Extension

| Hook | Current Path | Dependencies |
|------|-------------|--------------|
| `useConventionalCommit` | `src/hooks/useConventionalCommit.ts` | useConventionalStore, debounce |
| `useBladeFormGuard` | `src/blades/conventional-commit/hooks/useBladeFormGuard.ts` | xstate, navigationMachine |

### 2.3 Stores to Move INTO Extension

| Store | Current Path | Dependencies |
|-------|-------------|--------------|
| `useConventionalStore` | `src/stores/conventional.ts` | bindings (commands.*), conventional-utils, createBladeStore |
| `useChangelogStore` | `src/blades/changelog/store.ts` | bindings (commands.*), createBladeStore |

### 2.4 Lib Files to Move INTO Extension

| File | Current Path | Used By |
|------|-------------|---------|
| `commit-templates.ts` | `src/lib/commit-templates.ts` | TemplateSelector |

### 2.5 Components That STAY in Core (Shared/Used Outside CC)

| Component/Module | Path | Why Stay |
|-----------------|------|----------|
| `commit-type-theme.ts` | `src/lib/commit-type-theme.ts` | Used by TopologyGraph (CommitBadge), CommitTypeIcon -- pure display utility |
| `conventional-utils.ts` | `src/lib/conventional-utils.ts` | Used by TopologyGraph (layoutUtils.parseConventionalType), CommitTypeIcon -- pure parsing utility |
| `CommitTypeIcon` | `src/components/icons/CommitTypeIcon.tsx` | Used by TopologyGraph and commit history views |
| `CommitForm` | `src/components/commit/CommitForm.tsx` | **This is the integration point** -- needs conditional rendering |
| `CommitSearch` | `src/components/commit/CommitSearch.tsx` | Not CC-specific |
| `CommitDetails` | `src/components/commit/CommitDetails.tsx` | Not CC-specific |
| `CommitHistory` | `src/components/commit/CommitHistory.tsx` | Not CC-specific |
| `useCommitExecution` | `src/hooks/useCommitExecution.ts` | Generic commit/push hook, not CC-specific |
| `useAmendPrefill` | `src/hooks/useAmendPrefill.ts` | Has both simple and conventional modes; the CC-specific `prefillConventional` method could stay or be extracted |

### 2.6 Critical Integration Point: CommitForm.tsx

`src/components/commit/CommitForm.tsx` is the **primary integration point** where CC meets core. Currently it:
1. Has a "Conventional Commits" checkbox toggle (line 84)
2. Renders `ConventionalCommitForm` inline when checked (line 111)
3. Opens the `conventional-commit` blade type (line 93)
4. Has `isCCBladeOpen` check (line 17-19)

**Degradation strategy:** When CC extension is disabled:
- The "Conventional Commits" checkbox should be hidden or show "Extension required"
- The "Open in blade" button should be hidden
- Only the simple commit form remains

---

## 3. Zustand Store Splitting

### 3.1 Current Store Architecture

**`useConventionalStore`** (`src/stores/conventional.ts`):
- Created via `createBladeStore("conventional-commit", ...)` which wraps `create()` with `devtools()` middleware
- Registered in store reset registry via `registerStoreForReset()`
- ~240 lines, 28 state fields + actions
- Calls 4 IPC commands: `suggestCommitType`, `getScopeSuggestions`, `inferScopeFromStaged`, `validateConventionalCommit`

**`useChangelogStore`** (`src/blades/changelog/store.ts`):
- Created via `createBladeStore("changelog", ...)`
- ~82 lines, 10 state fields + actions
- Calls 1 IPC command: `generateChangelogCmd`

### 3.2 Store Lifecycle Management

Stores are currently module-level singletons created at import time. When extracted to an extension:

**Option A: Extension creates stores at activation**
```typescript
// In extension's onActivate:
const conventionalStore = createBladeStore<ConventionalState>("conventional-commit", ...);
const changelogStore = createBladeStore<ChangelogState>("changelog", ...);
```

Problem: Module-level stores are imported directly by components. Moving to activation-time creation means components need a different way to access them (React context, extension-provided hook).

**Option B: Keep stores as module-level singletons inside extension directory**
```typescript
// src/extensions/conventional-commits/stores/conventional.ts
export const useConventionalStore = createBladeStore<ConventionalState>(...);
```

Components within the extension import normally. The store exists as soon as the extension module is loaded. `createBladeStore` already handles `registerStoreForReset()`.

**Recommendation: Option B** -- it matches the current pattern with minimal refactoring. The store lives in the extension directory but uses the same `createBladeStore` factory. When the extension is deactivated, its blade types are unregistered, so no new instances of the blade can be created. Existing blade instances (if any) would unmount. The store state becomes stale but harmless -- it will be garbage collected when no component references it.

### 3.3 Store Reset on Deactivation

The `onDeactivate` handler should:
1. Call the store's `reset()` action to clear form state
2. Let `api.cleanup()` handle blade/command unregistration
3. The store reset registry (`registerStoreForReset`) handles repo-switch cleanup automatically

---

## 4. Tailwind v4 / CSS Analysis

### 4.1 CC-Specific CSS

**No CC-specific CSS classes exist in stylesheets.** All styling uses Tailwind utility classes inline:
- `--ctp-*` color tokens (Catppuccin theme)
- Standard Tailwind classes: `grid-cols-4`, `grid-cols-6`, `rounded-lg`, `border`, etc.
- `cn()` utility for conditional classes (from `src/lib/utils.ts`)

### 4.2 CC-Related Theme Tokens

The `COMMIT_TYPE_THEME` in `src/lib/commit-type-theme.ts` maps each CC type to:
- `color`: e.g., `text-ctp-green` (Tailwind utility using Catppuccin token)
- `badgeClasses`: e.g., `text-ctp-green bg-ctp-green/10 border-ctp-green/30`
- `icon`: Lucide icon component
- `emoji`: Unicode emoji

**These are NOT in the `@theme {}` block** -- they're runtime constants consumed via `className` props.

### 4.3 Animations

CC components use:
- `framer-motion` animations: `motion.button`, `motion.div` with `whileHover`, `whileTap`, `initial/animate` props
- No custom `@keyframes` or `--animate-*` entries in `@theme {}`
- Standard Tailwind `animate-spin` for loading states

### 4.4 Style Dependency Risk: None

Extracting CC components will NOT break any CSS dependencies because:
1. All styles are inline Tailwind utilities
2. No CC-specific `@theme {}` entries exist
3. The `commit-type-theme.ts` stays in core (used by topology graph)
4. Catppuccin tokens (`--ctp-*`) are global and available to all extensions

---

## 5. Test Migration

### 5.1 Existing CC-Related Tests

| Test File | Lines | What It Tests | Move to Extension? |
|-----------|-------|---------------|-------------------|
| `src/lib/conventional-utils.test.ts` | 270 | `buildCommitMessage`, `parseConventionalMessage` round-trips | **NO** -- stays in core (utility used by topology graph) |
| `src/blades/changelog/ChangelogBlade.test.tsx` | 22 | ChangelogBlade smoke test | **YES** |

### 5.2 Rust Tests

`src-tauri/src/git/conventional.rs` has 13 `#[test]` functions (lines 774-913):
- `test_parse_simple_commit`, `test_parse_commit_with_scope`, `test_parse_breaking_change_bang/footer`, etc.
- `test_validate_valid_message`, `test_validate_long_subject_warning`
- `test_infer_type_test_files`, `test_infer_type_docs`, `test_infer_type_empty`
- `test_commit_type_from_str`, `test_infer_scope_single_dir`, `test_extract_scopes_empty`

`src-tauri/src/git/changelog.rs` has 7 `#[test]` functions (lines 462-606):
- `test_type_order`, `test_type_titles`, `test_changelog_options_default`
- `test_group_sorting`, `test_breaking_change_in_commit`
- `test_template_rendering`, `test_versioned_template_rendering`

**All Rust tests stay in place** -- backend doesn't change.

### 5.3 Missing Tests (Should Be Added)

| Test | Priority | Description |
|------|----------|-------------|
| Extension activation/deactivation test | HIGH | Similar to `content-viewers.test.ts` -- verify blade types registered/unregistered |
| CommitForm degradation test | HIGH | Verify CC toggle hidden when extension disabled |
| `useConventionalCommit` hook test | MEDIUM | Test suggestion initialization, validation debounce, canCommit logic |
| TypeSelector rendering test | LOW | Component already works; visual regression unlikely |

### 5.4 Test Structure Recommendation

Follow the Phase 38 pattern:
```
src/extensions/__tests__/conventional-commits.test.ts
```

Test pattern from `content-viewers.test.ts`:
```typescript
import { ExtensionAPI } from "../ExtensionAPI";
import { getBladeRegistration } from "../../lib/bladeRegistry";
import { onActivate, onDeactivate } from "../conventional-commits";

describe("conventional-commits extension", () => {
  let api: ExtensionAPI;
  beforeEach(() => { api = new ExtensionAPI("conventional-commits"); });

  it("registers blade types on activation", async () => {
    await onActivate(api);
    expect(getBladeRegistration("conventional-commit")).toBeDefined();
    expect(getBladeRegistration("changelog")).toBeDefined();
    api.cleanup();
  });

  it("registers with coreOverride", async () => {
    await onActivate(api);
    expect(getBladeRegistration("ext:conventional-commits:conventional-commit")).toBeUndefined();
    api.cleanup();
  });

  it("cleans up on deactivation", async () => {
    await onActivate(api);
    api.cleanup();
    expect(getBladeRegistration("conventional-commit")).toBeUndefined();
    expect(getBladeRegistration("changelog")).toBeUndefined();
  });
});
```

---

## 6. Build / Vite Considerations

### 6.1 Current Vite Config

`vite.config.ts` is minimal:
- No code splitting config beyond defaults
- `optimizeDeps.include` only lists `dagre-d3-es` and `monaco-editor`
- `@` alias for `/src`
- Worker format: ES modules

### 6.2 Blade Discovery System

`src/blades/_discovery.ts` uses `import.meta.glob` for eager registration:
```typescript
const modules = import.meta.glob(
  ["./*/registration.{ts,tsx}", "!./_shared/**"],
  { eager: true }
);
```

**Impact:** When CC blade registrations move from `src/blades/conventional-commit/registration.ts` and `src/blades/changelog/registration.ts` to the extension, these files must be removed (or emptied). The `_discovery.ts` EXPECTED_TYPES array (line 17-21) should also be updated to remove `"conventional-commit"` and `"changelog"`.

### 6.3 Code Splitting

The CC blade already uses React.lazy for code splitting:
```typescript
const ConventionalCommitBlade = lazy(() =>
  import("./ConventionalCommitBlade").then(m => ({ default: m.ConventionalCommitBlade }))
);
```

The extension `onActivate` will follow the same pattern (like content-viewers does):
```typescript
const ConventionalCommitBlade = lazy(() =>
  import("../../blades/conventional-commit/ConventionalCommitBlade").then(...)
);
```

**Module boundaries:** Extension components can remain in their current file locations during the initial extraction. They are dynamically imported via `lazy()` from the extension entry point. No Vite config changes needed.

### 6.4 Build Output Impact

Moving registrations to the extension means:
- CC blade code is no longer eagerly loaded at startup (it was already lazy via `registration.ts`)
- The extension's `onActivate` triggers lazy loading of the same chunks
- Net effect on bundle: **negligible** -- chunk boundaries remain the same

---

## 7. Phase 38 Lessons Learned

### 7.1 What Worked Well

1. **`coreOverride: true` pattern**: Allows built-in extensions to register blade types without `ext:` prefix namespace. Essential for backward compatibility -- existing code that opens `"conventional-commit"` blade type continues to work.

2. **Lazy component imports in onActivate**: `React.lazy(() => import("../../blades/..."))` defers component loading until first render. Zero activation cost.

3. **Simple extension entry point**: `content-viewers/index.ts` is only 54 lines. Just `onActivate` and `onDeactivate`. Minimal boilerplate.

4. **ExtensionAPI.cleanup() handles everything**: No manual cleanup needed in `onDeactivate`. The API tracks all registrations and removes them atomically.

5. **registerBuiltIn in App.tsx**: Clean pattern for bundled extensions. Import `onActivate`/`onDeactivate`, call `registerBuiltIn` with config object.

### 7.2 Pain Points / Gaps Found

1. **RepoBrowserBlade hardcoded types (Gap 1)**: The blade-opening logic ignored the dispatched type and hardcoded blade type names. The CC extraction must ensure that `CommitForm.tsx` does NOT hardcode `"conventional-commit"` -- it should check blade registration before offering the CC option.

2. **BladeRenderer doesn't subscribe to registry changes (Gap 2)**: Already-open blades don't auto-update when extension is re-enabled. For CC this is less of an issue since the CC blade is only opened via user action (not auto-opened like file viewers).

3. **EXPECTED_TYPES in _discovery.ts was not updated**: Phase 38 did not remove content viewer types from the expected list, causing console warnings. Phase 39 must update this array.

4. **bladeTypes.ts BladePropsMap must be updated**: Extension-provided blade types with `coreOverride` still need entries in `BladePropsMap` for TypeScript type safety. This is a mild coupling point -- the core BladePropsMap knows about extension blade types.

### 7.3 Recommendations for Phase 39

1. **Update CommitForm.tsx to check blade registration**: Before showing the CC toggle, check if the `"conventional-commit"` blade type is registered:
   ```typescript
   import { getBladeRegistration } from "../../lib/bladeRegistry";
   const ccAvailable = !!getBladeRegistration("conventional-commit");
   ```

2. **Update _discovery.ts EXPECTED_TYPES**: Remove `"conventional-commit"` and `"changelog"` from the array.

3. **Remove registration.ts files**: Delete `src/blades/conventional-commit/registration.ts` and `src/blades/changelog/registration.ts` since the extension now handles registration.

4. **Keep BladePropsMap entries**: Leave `"conventional-commit"` and `"changelog"` in `BladePropsMap` for type safety. These entries define the shape of props, not the registration itself.

---

## 8. Complete File Inventory and Migration Plan

### 8.1 Files to Create (New Extension)

| File | Purpose |
|------|---------|
| `src/extensions/conventional-commits/index.ts` | Extension entry point (onActivate/onDeactivate) |

### 8.2 Files to Move (Logically -- Components Stay in Place, Registered by Extension)

Phase 38 kept viewer components in `src/blades/viewer-*` and registered them from `src/extensions/content-viewers/index.ts`. The CC extension should follow the same pattern -- keep component files in their current locations but register them from the extension entry point.

### 8.3 Files to Delete

| File | Reason |
|------|--------|
| `src/blades/conventional-commit/registration.ts` | Registration moves to extension |
| `src/blades/changelog/registration.ts` | Registration moves to extension |

### 8.4 Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add `registerBuiltIn` call for `"conventional-commits"` extension |
| `src/blades/_discovery.ts` | Remove `"conventional-commit"` and `"changelog"` from `EXPECTED_TYPES` |
| `src/components/commit/CommitForm.tsx` | Add registration check for graceful degradation |

### 8.5 Files That Stay Unchanged (Core Utilities Used by Non-CC Code)

| File | Reason Stays |
|------|-------------|
| `src/lib/commit-type-theme.ts` | Used by CommitBadge in topology graph |
| `src/lib/conventional-utils.ts` | Used by layoutUtils.ts (topology graph) |
| `src/lib/conventional-utils.test.ts` | Tests core utility |
| `src/components/icons/CommitTypeIcon.tsx` | Used in commit history, topology graph |
| `src/hooks/useCommitExecution.ts` | Generic commit hook, not CC-specific |
| `src/hooks/useAmendPrefill.ts` | Has CC-specific `prefillConventional` but also used in simple mode |
| `src-tauri/src/git/conventional.rs` | Backend service -- always available |
| `src-tauri/src/git/changelog.rs` | Backend service -- always available |
| `src/stores/bladeTypes.ts` | BladePropsMap entries remain for type safety |

---

## 9. Extension Entry Point Design

### 9.1 Proposed `src/extensions/conventional-commits/index.ts`

```typescript
import { lazy } from "react";
import type { ExtensionAPI } from "../ExtensionAPI";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy component imports
  const ConventionalCommitBlade = lazy(() =>
    import("../../blades/conventional-commit/ConventionalCommitBlade").then(m => ({
      default: m.ConventionalCommitBlade,
    }))
  );
  const ChangelogBlade = lazy(() =>
    import("../../blades/changelog/ChangelogBlade").then(m => ({
      default: m.ChangelogBlade,
    }))
  );

  // Register blade types with coreOverride
  api.registerBlade({
    type: "conventional-commit",
    title: "Conventional Commit",
    component: ConventionalCommitBlade,
    lazy: true,
    singleton: true,
    coreOverride: true,
  });

  api.registerBlade({
    type: "changelog",
    title: "Generate Changelog",
    component: ChangelogBlade,
    singleton: true,
    coreOverride: true,
  });

  // Register commands
  api.registerCommand({
    id: "open-conventional-commit",
    title: "Open Conventional Commit",
    category: "Git",
    action: () => {
      // Open the conventional commit blade
      // This needs access to blade navigation -- see section 9.2
    },
  });

  api.registerCommand({
    id: "generate-changelog",
    title: "Generate Changelog",
    category: "Git",
    action: () => {
      // Open the changelog blade
    },
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all unregistrations
}
```

### 9.2 Command Action Access to Navigation

The extension commands need to open blades. Options:
1. **Import `useBladeNavigation` at module level**: Not possible -- it's a React hook
2. **Use the navigation machine actor directly**: The navigation actor is in React context
3. **Add a `openBlade` helper to ExtensionAPI**: New API method that dispatches to navigation

**Recommended approach**: Use the existing `pushBlade` function from the blade stack store, which is a Zustand store and can be called from anywhere:

```typescript
import { useBladesStore } from "../../stores/blades";

api.registerCommand({
  id: "open-conventional-commit",
  title: "Open Conventional Commit",
  category: "Git",
  action: () => {
    useBladesStore.getState().pushBlade({
      type: "conventional-commit",
      title: "Conventional Commit",
      props: {},
    });
  },
});
```

This avoids extending ExtensionAPI and uses the existing store pattern.

---

## 10. onWillCommit Middleware Validation

### 10.1 GitHookBus Analysis

The `GitHookBus` at `src/lib/gitHookBus.ts` supports:
- `onWill(operation, handler)`: Pre-operation hook that can cancel
- `onDid(operation, handler)`: Post-operation hook
- `emitWill(operation, ctx)`: Returns `{ cancel?: boolean, reason?: string }`
- `emitDid(operation, ctx)`: Fire-and-forget

### 10.2 Current Usage

`useCommitExecution.ts` currently only calls `emitDid("commit")` and `emitDid("push")` -- there is **no `emitWill("commit")` call** in the current codebase.

### 10.3 Validation via onWillCommit

To use `onWillCommit` for CC validation, two changes are needed:

1. **Add `emitWill("commit")` to `useCommitExecution`** before `commands.createCommit`:
   ```typescript
   const willResult = await gitHookBus.emitWill("commit", { commitMessage: message });
   if (willResult.cancel) {
     toast.warning(willResult.reason ?? "Commit cancelled by extension");
     return;
   }
   ```

2. **Register a `onWillGit("commit")` handler** in the CC extension:
   ```typescript
   api.onWillGit("commit", async (ctx) => {
     if (!ctx.commitMessage) return;
     const validation = await commands.validateConventionalCommit(ctx.commitMessage);
     if (!validation.isValid) {
       return { cancel: true, reason: "Commit message does not follow Conventional Commits format" };
     }
   });
   ```

**Risk**: This intercepts ALL commits, including simple mode. The handler should be configurable (opt-in).

**Recommendation**: Do NOT add `onWillCommit` validation in the initial extraction. It's an enhancement that should be added later with a user setting to opt in/out. The current CC form already validates before the commit button is enabled -- the `canCommit` flag prevents invalid messages.

---

## 11. Migration Checklist

### Phase 39.1: Create Extension Entry Point

- [ ] Create `src/extensions/conventional-commits/index.ts`
- [ ] Export `onActivate` and `onDeactivate`
- [ ] Register `conventional-commit` blade with `coreOverride: true`, `lazy: true`, `singleton: true`
- [ ] Register `changelog` blade with `coreOverride: true`, `singleton: true`
- [ ] Register commands for opening CC blade and changelog blade

### Phase 39.2: Update Core Infrastructure

- [ ] Add `registerBuiltIn` call in `src/App.tsx` for `"conventional-commits"` extension
- [ ] Delete `src/blades/conventional-commit/registration.ts`
- [ ] Delete `src/blades/changelog/registration.ts`
- [ ] Update `src/blades/_discovery.ts` EXPECTED_TYPES to remove `"conventional-commit"` and `"changelog"`

### Phase 39.3: Graceful Degradation

- [ ] Update `src/components/commit/CommitForm.tsx` to check blade registration before showing CC toggle
- [ ] When CC extension disabled: hide "Conventional Commits" checkbox or show disabled state with "Extension required" tooltip
- [ ] When CC extension disabled: hide "Open in blade" button
- [ ] Simple commit form continues to work regardless of extension state

### Phase 39.4: Tests

- [ ] Create `src/extensions/__tests__/conventional-commits.test.ts`
- [ ] Test blade registration on activation
- [ ] Test coreOverride (no ext: prefix)
- [ ] Test cleanup on deactivation
- [ ] Test CommitForm degradation when extension is disabled
- [ ] Move `src/blades/changelog/ChangelogBlade.test.tsx` (update imports if needed)

### Phase 39.5: Verification

- [ ] All 187+ existing tests pass
- [ ] CC blade opens correctly from sidebar CommitForm
- [ ] CC blade opens correctly from command palette
- [ ] Changelog blade opens and generates correctly
- [ ] Disabling extension hides CC options in CommitForm
- [ ] Re-enabling extension restores CC options
- [ ] Extension Manager shows "Conventional Commits" as built-in extension

---

## 12. Dependency Graph Summary

```
                  CORE (always available)
                  ======================
                  conventional-utils.ts
                  commit-type-theme.ts
                  CommitTypeIcon.tsx
                  useCommitExecution.ts
                  useAmendPrefill.ts
                  CommitForm.tsx (integration point)
                  gitHookBus.ts
                  bladeRegistry.ts
                  createBladeStore.ts
                       |
                       | checks registration
                       v
          EXTENSION: conventional-commits
          ================================
          index.ts (onActivate/onDeactivate)
               |
               | lazy imports + coreOverride registers
               v
          ConventionalCommitBlade.tsx
          ConventionalCommitForm.tsx
          TypeSelector.tsx
          ScopeAutocomplete.tsx
          BreakingChangeSection.tsx
          CharacterProgress.tsx
          ValidationErrors.tsx
          CommitPreview.tsx
          CommitActionBar.tsx
          TemplateSelector.tsx
          ScopeFrequencyChart.tsx
          ChangelogBlade.tsx
          ChangelogPreview.tsx
          useConventionalCommit.ts (hook)
          useBladeFormGuard.ts (hook)
          conventional.ts (store)
          changelog/store.ts (store)
          commit-templates.ts
               |
               | IPC calls (always available)
               v
          BACKEND (Rust -- unchanged)
          ============================
          git/conventional.rs
          git/changelog.rs
          git/commit.rs
```

---

_Research completed: 2026-02-10_
_Researcher: dev-researcher agent_
