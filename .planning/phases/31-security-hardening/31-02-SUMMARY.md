---
phase: 31-security-hardening
plan: 02
status: complete
started: 2026-02-10
completed: 2026-02-10
---

# Plan 31-02 Summary: Apply Strict CSP, Disable Asset Protocol, Audit Capabilities

## What Was Built

Locked down security boundaries with strict Content-Security-Policy, disabled the unused asset protocol, and narrowed Tauri capabilities to minimum required permissions.

## Key Changes

### Task 1: Strict CSP Configuration
- **Production CSP**: `script-src 'self'`, `connect-src ipc: http://ipc.localhost`, `object-src 'none'`, `frame-ancestors 'none'`
- **Dev CSP**: Adds `'unsafe-eval'` for Vite HMR and `ws://localhost:*` for WebSocket hot reload
- **`img-src`** includes `https:` intentionally — needed for external images in markdown (README badges, screenshots)
- **`style-src`** includes `'unsafe-inline'` — needed for Tailwind v4 and framer-motion inline styles
- **`worker-src`** includes `blob:` — needed for Monaco editor web workers
- Asset protocol disabled: `"enable": false, "scope": []`
- Tauri auto-hashes the inline FOUC prevention script at compile time

### Task 2: Narrowed Capabilities
- Replaced `core:default` umbrella with 5 specific core modules:
  - `core:app:default` — app version, exit
  - `core:event:default` — Tauri event system
  - `core:path:default` — OS path resolution
  - `core:resources:default` — bundled resources
  - `core:webview:default` — webview management
- Kept `core:window:default` (was duplicate before)
- Removed unused: `core:tray:default`, `core:menu:default`, `core:image:default`
- Removed `protocol-asset` from Cargo.toml features

## Key Files

### Modified
- `src-tauri/tauri.conf.json` — CSP, devCsp, disabled asset protocol
- `src-tauri/capabilities/default.json` — Narrowed from core:default to specific modules
- `src-tauri/Cargo.toml` — Removed protocol-asset feature
- `Cargo.lock` — Updated for feature change

## Deviations

None — all changes matched the plan exactly.

## Verification

- `cargo build` — succeeds without protocol-asset
- `grep "core:default" src-tauri/capabilities/default.json` → zero matches
- `grep "protocol-asset" src-tauri/Cargo.toml` → zero matches
- CSP configured as JSON object (Tauri v2 supported format)

## Self-Check: PASSED
