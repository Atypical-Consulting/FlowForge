# Quick Task 30: Make repo-browser a singleton blade in XState navigation machine

## Summary

Added `"repo-browser"` to the `SINGLETON_TYPES` set in the XState navigation machine so that clicking the Repository Browser button multiple times no longer stacks duplicate blades.

## Changes

| File | Change |
|------|--------|
| `src/machines/navigation/navigationMachine.ts:13` | Added `"repo-browser"` to `SINGLETON_TYPES` set |
| `src/machines/navigation/guards.ts:9` | Synced `SINGLETON_TYPES` — added `"conventional-commit"` and `"repo-browser"` (was stale, missing `conventional-commit`) |

## How it works

The `isNotSingleton` guard in the XState navigation machine checks if a `PUSH_BLADE` event targets a type in `SINGLETON_TYPES`. If the type already exists in the blade stack, the push is silently blocked. This prevents duplicate instances of singleton blades.

## Verification

- TypeScript compilation: passes
- All 31 navigation machine tests pass
- `guards.ts` now matches `navigationMachine.ts` singleton set

## Commit

`415f2e7` - fix(navigation): add repo-browser to singleton blade types
