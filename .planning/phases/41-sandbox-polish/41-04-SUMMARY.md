---
phase: 41-sandbox-polish
plan: 04
status: complete
---

# Plan 41-04 Summary: Extension Lifecycle Tests (GitHub + ExtensionHost)

## What was done

Added comprehensive lifecycle tests for the GitHub extension (the only built-in without tests) and for the ExtensionHost store, covering activation, deactivation, cleanup, trust level, and error recovery.

## New test files

### `src/extensions/__tests__/github.test.ts` (8 tests)
- Registers 7 blade types on activation (sign-in, account, pull-requests, pull-request, issues, issue, create-pr)
- Blade types use `ext:github:` namespace with correct source
- Registers 5 commands on activation (sign-in, sign-out, open-pull-requests, open-issues, create-pull-request)
- Registers 4 toolbar actions on activation (github-status, open-pull-requests, open-issues, create-pr)
- Cleanup removes all blade registrations
- Cleanup removes all command registrations
- Cleanup removes all toolbar registrations
- onDeactivate cancels polling and cleans up cached queries

### `src/extensions/__tests__/ExtensionHost.test.ts` (9 tests)
- registerBuiltIn creates ExtensionInfo with active status
- registerBuiltIn sets trustLevel to "built-in"
- registerBuiltIn sets builtIn flag to true
- registerBuiltIn calls activate callback with ExtensionAPI instance
- deactivateExtension transitions to disabled status
- deactivateExtension calls api.cleanup() removing toolbar registrations
- deactivateExtension calls onDeactivate callback
- Re-activation after deactivation works (status returns to active)
- Activation failure sets error status and cleans up partial registrations

## Test coverage

| Suite | Before | After |
|-------|--------|-------|
| Extension tests (src/extensions/__tests__/) | 33 | 51 |
| All 4 built-in extensions have lifecycle tests | 3/4 | 4/4 |
| ExtensionHost direct tests | 0 | 9 |

All 4 built-in extensions now have lifecycle test coverage:
- content-viewers: 6 tests
- conventional-commits: 7 tests
- gitflow: 9 tests
- github: 8 tests (NEW)

## Verification

- `npx vitest run src/extensions/__tests__/` -- 51 tests pass across 6 test files
- `npx vitest run` -- 225 tests pass (pre-existing Monaco + SandboxBridge failures unrelated)
- Trust level verified in ExtensionHost tests

## Commit

- `e94860f` -- test(41-04): add GitHub extension and ExtensionHost lifecycle tests
