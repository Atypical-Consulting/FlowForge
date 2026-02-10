---
phase: 41-sandbox-polish
verified: 2026-02-10T23:04:24Z
status: passed
score: 5/5 must-haves verified
human_verification:
  - test: "Open FlowForge, navigate to Extension Manager, verify all 4 built-in extensions show as Active"
    expected: "Content Viewers, Conventional Commits, Gitflow, and GitHub extensions all display status Active"
    why_human: "Cannot verify runtime UI rendering programmatically"
  - test: "Open a repository and verify toolbar actions for GitHub extension are visible"
    expected: "GitHub status, PRs, Issues, Create PR toolbar buttons present when repo has GitHub remote"
    why_human: "Toolbar visibility depends on runtime state and store subscriptions"
---

# Phase 41: Sandbox & Polish Verification Report

**Phase Goal:** Extension sandbox infrastructure is prepared for future third-party extensions, deprecated code is removed, and v1.6.0 ships with full test coverage and documentation
**Verified:** 2026-02-10T23:04:24Z
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Extension manifest distinguishes built-in from external via trust level flag | VERIFIED | `src-tauri/src/extensions/manifest.rs:40-46` has `trust_level: String` with `#[serde(default = "default_trust_level")]` defaulting to `"sandboxed"`. `src/extensions/extensionTypes.ts:3` defines `TrustLevel = "built-in" \| "user-trusted" \| "sandboxed"`. `ExtensionHost.ts:363` sets `trustLevel: "built-in" as const` in `registerBuiltIn`. |
| 2 | Worker-based sandbox prototype demonstrates postMessage communication | VERIFIED | `src/extensions/sandbox/SandboxBridge.ts` (185 lines) implements Worker lifecycle, postMessage RPC, method whitelisting via `isSandboxSafe()`, pending call tracking, and clean termination. `sandbox-worker.ts` (79 lines) implements init/api-call/terminate protocol. `types.ts` defines `HostToWorkerMessage` and `WorkerToHostMessage` union types. 9 tests in `SandboxBridge.test.ts` cover handshake, bidirectional messaging, method blocking, and termination. |
| 3 | ExtensionAPI methods classified as sandbox-safe vs requires-trust, documented in code | VERIFIED | 9 `@sandboxSafety` JSDoc annotations found in `ExtensionAPI.ts` (6 requires-trust + 3 sandbox-safe). `sandbox-api-surface.ts` exports `SANDBOX_SAFE_METHODS` (3) and `REQUIRES_TRUST_METHODS` (6) constants with `isSandboxSafe()` type guard. `SandboxedExtensionAPI.ts` proxy class blocks 6 requires-trust methods with descriptive errors. |
| 4 | 16 deprecated re-export shims removed and all consumers use direct imports | VERIFIED | All 16 shim files confirmed deleted (ls returns "No such file" for all). Grep for old import paths `stores/(repository\|branches\|tags\|...)` across `src/` returns zero results. `src/extensions/github/index.ts:14` uses `useGitOpsStore as useRepositoryStore` from `stores/domain/git-ops`. `src/components/RepositoryView.tsx:11` uses same pattern. |
| 5 | Extension lifecycle tests cover activate, deactivate, and registry cleanup for all new registries | VERIFIED | `github.test.ts` (8 tests): 7 blade, 5 command, 4 toolbar registration + cleanup + deactivate polling cancellation. `ExtensionHost.test.ts` (9 tests): registerBuiltIn status/trustLevel/builtIn, activate callback, deactivate transition, cleanup, onDeactivate callback, re-activation, error recovery. All 4 built-in extensions now have test files: content-viewers, conventional-commits, gitflow, github. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/extensions/manifest.rs` | Rust trust_level field | VERIFIED | Line 44-45: `pub trust_level: String` with serde default. 110 lines, substantive struct. |
| `src/extensions/extensionTypes.ts` | TrustLevel type + ExtensionInfo field | VERIFIED | Line 3: `TrustLevel` union type. Line 22: `trustLevel: TrustLevel` on ExtensionInfo. 33 lines. |
| `src/extensions/ExtensionHost.ts` | trustLevel set in registerBuiltIn + discoverExtensions | VERIFIED | Line 150,162: `trustLevel: (manifest as any).trustLevel ?? "sandboxed"`. Line 363: `trustLevel: "built-in" as const`. 407 lines. |
| `src/extensions/sandbox/sandbox-api-surface.ts` | Classification constants + isSandboxSafe | VERIFIED | Exports SANDBOX_SAFE_METHODS (3), REQUIRES_TRUST_METHODS (6), isSandboxSafe(). 33 lines. |
| `src/extensions/sandbox/SandboxedExtensionAPI.ts` | Restricted API proxy | VERIFIED | 67 lines. 3 pass-through sandbox-safe methods, 6 blocked requires-trust methods with `trustError()`. |
| `src/extensions/sandbox/SandboxBridge.ts` | Host-side Worker bridge | VERIFIED | 185 lines. start(), initialize(), callApi(), terminate(). Uses isSandboxSafe() for method whitelisting, Map for pending call tracking. |
| `src/extensions/sandbox/sandbox-worker.ts` | Worker entry point | VERIFIED | 79 lines. Sends "ready" on load, handles init/api-call/terminate messages. Prototype echo implementation. |
| `src/extensions/sandbox/types.ts` | Shared message types | VERIFIED | 20 lines. HostToWorkerMessage (init, api-call, terminate) and WorkerToHostMessage (ready, initialized, api-request, api-response, error). |
| `src/extensions/sandbox/__tests__/SandboxBridge.test.ts` | Bridge protocol tests | VERIFIED | 223 lines, 9 test cases. MockWorker simulates Web Worker. Covers handshake, timeout, API call/response, all 6 requires-trust blocked, all 3 sandbox-safe allowed, termination, double-start, error responses. |
| `src/extensions/__tests__/github.test.ts` | GitHub extension lifecycle tests | VERIFIED | 239 lines, 8 tests. Covers 7 blade + 5 command + 4 toolbar registration, cleanup, deactivate with polling cancellation. |
| `src/extensions/__tests__/ExtensionHost.test.ts` | ExtensionHost store lifecycle tests | VERIFIED | 184 lines, 9 tests. Covers registerBuiltIn, trustLevel, builtIn flag, activate callback, deactivation, cleanup, onDeactivate, re-activation, error recovery. |
| `docs/extension-api.md` | API method reference with classification | VERIFIED | 177 lines. Classification table with all 10 methods (9 + cleanup). Sections per method group, sandbox safety notes, cleanup order. |
| `docs/extension-manifest.md` | Manifest JSON schema docs | VERIFIED | 107 lines. Full schema example, field reference table with trustLevel documentation, contributes section, discovery process. |
| `docs/trust-levels.md` | Trust level architecture docs | VERIFIED | 113 lines. Three-tier model table, determination rules, sandbox-safe vs requires-trust classification, Worker architecture, design tokens. |
| `package.json` | Version 1.6.0 | VERIFIED | Line 4: `"version": "1.6.0"` |
| `src-tauri/Cargo.toml` | Version 1.6.0 | VERIFIED | Line 3: `version = "1.6.0"` |
| `src-tauri/tauri.conf.json` | Version 1.6.0 | VERIFIED | Line 4: `"version": "1.6.0"` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ExtensionHost.ts` | `extensionTypes.ts` | `trustLevel` field in registerBuiltIn | WIRED | Line 363: `trustLevel: "built-in" as const` in synthetic manifest |
| `SandboxedExtensionAPI.ts` | `sandbox-api-surface.ts` | REQUIRES_TRUST_METHODS import | PARTIAL | Import exists (line 1) but the constant is not actually referenced in the function body. Methods are hardcoded individually. Classification is still correct -- unused import only. |
| `SandboxBridge.ts` | `sandbox-api-surface.ts` | isSandboxSafe check | WIRED | Import (line 1) + usage (line 109): `if (!isSandboxSafe(method))` |
| `SandboxBridge.ts` | `types.ts` | SandboxMessage type import | WIRED | Line 2: imports `HostToWorkerMessage, WorkerToHostMessage` from `./types`. Used in message handling. |
| `github/index.ts` | `stores/domain/git-ops` | useGitOpsStore import | WIRED | Line 14: `import { useGitOpsStore as useRepositoryStore }` |
| `RepositoryView.tsx` | `stores/domain/git-ops` | useGitOpsStore import | WIRED | Line 11: `import { useGitOpsStore as useRepositoryStore }` |
| `docs/extension-api.md` | `ExtensionAPI.ts` | documents all public methods | WIRED | Table lists all 10 methods with sandbox safety classification |
| `docs/trust-levels.md` | `extensionTypes.ts` | documents TrustLevel type | WIRED | Describes all three levels: built-in, user-trusted, sandboxed |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| SAND-01: Extension manifest supports trust level flag | SATISFIED | -- |
| SAND-02: Worker-based sandbox bridge prototype with postMessage | SATISFIED | -- |
| SAND-03: Extension API methods classified as sandbox-safe vs requires-trust | SATISFIED | -- |
| MAINT-01: Remove 16 backward-compatibility re-export shims | SATISFIED | -- |
| MAINT-02: Test coverage for extension lifecycle | SATISFIED | -- |
| MAINT-03: Documentation updated for v1.6.0 extension architecture | SATISFIED | -- |
| MAINT-04: Version bumped to v1.6.0 | SATISFIED | -- |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `SandboxedExtensionAPI.ts` | 1 | Unused import `REQUIRES_TRUST_METHODS` | Info | No functional impact. Import is referenced in the file but the constant is not used in logic -- methods are hardcoded individually. TypeScript does not flag this because the import is syntactically valid. |

### Human Verification Required

### 1. Built-in Extension Status in UI

**Test:** Open FlowForge, navigate to Extension Manager blade
**Expected:** All 4 built-in extensions (Content Viewers, Conventional Commits, Gitflow, GitHub) show "Active" status
**Why human:** Cannot verify runtime UI rendering and Zustand store hydration programmatically

### 2. Toolbar Actions Visibility

**Test:** Open a repository with a GitHub remote, check toolbar for GitHub actions
**Expected:** GitHub status, PRs, Issues, Create PR buttons visible in toolbar
**Why human:** Toolbar visibility depends on runtime store subscriptions and remote detection

### Gaps Summary

No gaps found. All 5 observable truths are verified. All artifacts exist, are substantive (no stubs), and are wired to their consumers. All 7 requirements are satisfied. Version is 1.6.0 across all config files. Only finding is one unused import in `SandboxedExtensionAPI.ts` (info-level, not a blocker).

---

_Verified: 2026-02-10T23:04:24Z_
_Verifier: Claude (gsd-verifier)_
