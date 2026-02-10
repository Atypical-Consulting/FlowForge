---
phase: 41-sandbox-polish
plan: 02
status: complete
---

# Plan 41-02 Summary: Remove 16 Deprecated Store Re-export Shims

## What was done

Removed all 16 deprecated backward-compatibility shim files from `src/stores/` that were created during Phase 30's store consolidation. Updated ~55 consumer files to import directly from domain stores using semantic `as` aliases.

## Shims removed

### Git-ops shims (10 files -> `useGitOpsStore` from `stores/domain/git-ops`)
- `clone.ts`, `worktrees.ts`, `gitflow.ts`, `staging.ts` (staging was actually ui-state)
- `tags.ts`, `undo.ts`, `topology.ts`, `stash.ts`, `branches.ts`, `repository.ts`

### Preferences shims (5 files -> `usePreferencesStore` from `stores/domain/preferences`)
- `navigation.ts`, `theme.ts`, `settings.ts`, `reviewChecklist.ts`, `branchMetadata.ts`

### UI-state shims (1 file -> `useUIStore` from `stores/domain/ui-state`)
- `commandPalette.ts`

Note: `staging.ts` was also a ui-state shim (re-exported `useUIStore`), counted with git-ops group above.

## Migration pattern

```typescript
// BEFORE (via shim):
import { useRepositoryStore } from "../stores/repository";

// AFTER (direct domain import with alias):
import { useGitOpsStore as useRepositoryStore } from "../stores/domain/git-ops";
```

For shims that re-exported types (theme, settings, reviewChecklist, branchMetadata), type imports were redirected to source slices:
```typescript
import type { Theme } from "../stores/domain/preferences/theme.slice";
```

## Files changed

- 16 shim files deleted
- ~55 consumer files updated (components, commands, hooks, blades, extensions)
- 1 test file updated (`stores/repository.test.ts`)

## Verification

- TypeScript compilation: PASS (zero errors)
- Vitest: 203 tests pass (4 test suites with pre-existing Monaco-related failures unaffected)
- Grep for old shim imports: zero results
- All 16 shim files confirmed deleted

## Commits

1. `b865446` — refactor(41-02): remove git-ops store shims and update consumers
2. `04bf61d` — refactor(41-02): remove preferences/ui-state shims and complete migration
3. `1c3578d` — fix(41-02): update repository test to use domain store import
