---
phase: 31-security-hardening
plan: 01
status: complete
started: 2026-02-10
completed: 2026-02-10
---

# Plan 31-01 Summary: Bundle Monaco Locally & Proxy NuGet Through Rust

## What Was Built

Eliminated all external network dependencies from the frontend by bundling Monaco Editor locally and proxying NuGet API calls through the Rust backend.

## Key Changes

### Task 1: Bundle Monaco Editor Locally
- Replaced CDN loading (`cdn.jsdelivr.net`) with direct `import * as monaco from "monaco-editor"`
- Created `src/lib/monacoWorkers.ts` with ESM `?worker` imports for Vite
- Configured `loader.config({ monaco })` for `@monaco-editor/react` to use local bundle
- Theme registered synchronously instead of through async `loader.init().then()`
- Added `monaco-editor` to `optimizeDeps.include` and `worker.format: "es"` in vite.config.ts

### Task 2: Proxy NuGet API Through Rust
- Created `src-tauri/src/git/nuget.rs` with `fetch_nuget_info` Tauri command
- Follows same pattern as `gitignore.rs` (reqwest + GitError)
- Used `u32` for `totalDownloads` instead of `u64` (specta BigInt restriction)
- Updated `NugetPackageViewer.tsx` to use `commands.fetchNugetInfo()` via Tauri IPC
- Removed local `NugetPackageInfo` interface (now generated from specta bindings)

## Key Files

### Created
- `src/lib/monacoWorkers.ts` — Monaco worker configuration for local bundling
- `src-tauri/src/git/nuget.rs` — Rust NuGet API proxy command

### Modified
- `src/lib/monacoTheme.ts` — Switched from CDN to local Monaco
- `vite.config.ts` — Added Monaco to optimizeDeps and worker format
- `src-tauri/src/git/mod.rs` — Added `pub mod nuget`
- `src-tauri/src/lib.rs` — Registered `fetch_nuget_info` command
- `src/components/viewers/NugetPackageViewer.tsx` — Uses Tauri IPC instead of fetch()
- `src/bindings.ts` — Regenerated with new command

## Deviations

1. **`u64` → `u32` for totalDownloads**: specta forbids `u64` (BigInt in JS). Changed to `u32` which handles up to ~4 billion downloads — sufficient for any NuGet package.
2. **Error handling in NugetPackageViewer**: Used `result.error.type` instead of `result.error.message` because `GitError` is a tagged union where some variants lack a `message` field.

## Verification

- `grep -r "cdn.jsdelivr" src/` → zero matches
- `grep -r "azuresearch\|api\.nuget\.org" src/` → zero matches (only in src-tauri/)
- `npm run build` → succeeds
- `cargo build` → succeeds

## Self-Check: PASSED
