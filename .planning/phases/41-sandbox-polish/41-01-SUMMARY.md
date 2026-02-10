# Plan 41-01 Summary: Trust Level Flag + API Sandbox Classification

## Status: COMPLETE

## What Was Built

### Task 1: Trust Level in Rust Manifest and TypeScript Types

**`src-tauri/src/extensions/manifest.rs`**
- Added `trust_level: String` field to `ExtensionManifest` struct
- Defaults to `"sandboxed"` via `#[serde(default = "default_trust_level")]`
- Supports three values: `"built-in"`, `"user-trusted"`, `"sandboxed"`

**`src/extensions/extensionTypes.ts`**
- Added `TrustLevel` union type: `"built-in" | "user-trusted" | "sandboxed"`
- Added `trustLevel: TrustLevel` field to `ExtensionInfo` interface

**`src/extensions/ExtensionHost.ts`**
- `registerBuiltIn()` sets `trustLevel: "built-in"` on synthetic ExtensionInfo
- `discoverExtensions()` sets `trustLevel` from manifest (falls back to `"sandboxed"`)

### Task 2: API Method Classification and Sandbox Proxy

**`src/extensions/ExtensionAPI.ts`**
- Added `@sandboxSafety` JSDoc annotations to all 9 public methods
- 6 methods classified as `requires-trust` (registerBlade, registerCommand, contributeToolbar, contributeContextMenu, contributeSidebarPanel, contributeStatusBar)
- 3 methods classified as `sandbox-safe` (onDidGit, onWillGit, onDispose)

**`src/extensions/sandbox/sandbox-api-surface.ts`**
- Exports `SANDBOX_SAFE_METHODS` constant (3 methods)
- Exports `REQUIRES_TRUST_METHODS` constant (6 methods)
- Exports `SandboxSafeMethod` and `RequiresTrustMethod` types
- Exports `isSandboxSafe()` type guard function

**`src/extensions/sandbox/SandboxedExtensionAPI.ts`**
- Proxy class that wraps `ExtensionAPI`
- Passes through sandbox-safe methods to the host API
- Throws descriptive errors for requires-trust methods explaining the Worker boundary limitation

## Verification

- `cargo check` passes (Rust compiles with new `trust_level` field)
- `npx tsc --noEmit` passes (TypeScript types consistent)
- 9 `@sandboxSafety` annotations confirmed in ExtensionAPI.ts
- Commit: `3b3d987`

## Files Changed

| File | Change |
|------|--------|
| `src-tauri/src/extensions/manifest.rs` | Added `trust_level` field + default fn |
| `src/extensions/extensionTypes.ts` | Added `TrustLevel` type + field on `ExtensionInfo` |
| `src/extensions/ExtensionHost.ts` | Set `trustLevel` in registerBuiltIn + discoverExtensions |
| `src/extensions/ExtensionAPI.ts` | Added 9 `@sandboxSafety` JSDoc annotations |
| `src/extensions/sandbox/sandbox-api-surface.ts` | New: method classification constants |
| `src/extensions/sandbox/SandboxedExtensionAPI.ts` | New: restricted API proxy class |
