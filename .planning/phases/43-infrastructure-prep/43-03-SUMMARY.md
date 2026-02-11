---
plan: 43-03
status: complete
---

# Plan 43-03: CC Store Reset + Sandbox API Expansion

## What Was Built
Added automatic store reset for the Conventional Commits extension when it is disabled, preventing stale form state from persisting across disable/re-enable cycles. Expanded the sandbox API surface with three new proxy methods (`onDidNavigate`, `events`, `settings`) so that sandboxed extensions can subscribe to navigation events, use inter-extension pub/sub, and access persisted settings.

## Tasks Completed
| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Wire CC store reset on extension disable | done | d62155d |
| 2 | Expand sandbox API surface with 3 new methods | done | d084fa9 |

## Key Files
### Created/Modified
- src/extensions/conventional-commits/index.ts -- Added onDispose reset callback
- src/extensions/sandbox/sandbox-api-surface.ts -- 3 new sandbox-safe methods
- src/extensions/sandbox/SandboxedExtensionAPI.ts -- Proxy methods for new API

## Self-Check
PASSED -- `tsc --noEmit` reports zero new errors (only pre-existing bindings.ts TS2440). All 233 tests pass; the 3 pre-existing Monaco Editor mock failures (DiffBlade, StagingChangesBlade, ViewerCodeBlade) are unrelated to these changes. SANDBOX_SAFE_METHODS has exactly 6 entries. SandboxedExtensionAPI has the 3 new proxy methods (onDidNavigate, events getter, settings getter).

## Deviations
None
