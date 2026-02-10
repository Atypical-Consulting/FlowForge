---
phase: 41-sandbox-polish
plan: 05
status: complete
---

# Plan 41-05 Summary: Extension Docs + Version Bump to v1.6.0

## What was done

Created three extension developer documentation files and bumped the application version from 1.5.0 to 1.6.0 across all config files.

## Documentation created

### `docs/extension-api.md`
- ExtensionAPI method reference with sandbox safety classification table (10 methods)
- Sections for each method group: blades, commands, toolbar, context menu, sidebar, status bar, git hooks, lifecycle
- Automatic namespacing documentation (`ext:{extensionId}:` prefix, `coreOverride`)
- Cleanup order documentation

### `docs/extension-manifest.md`
- Full JSON schema example with all fields
- Field reference table with types, required/optional, defaults
- `trustLevel` field documentation with link to trust-levels.md
- `contributes` section (blades, commands, toolbar) field tables
- Discovery process documentation

### `docs/trust-levels.md`
- Three-tier trust model table (built-in, user-trusted, sandboxed)
- How trust level is determined for each tier
- Sandbox-safe vs requires-trust method classification
- Worker sandbox architecture overview
- Design tokens (Catppuccin CSS custom properties and Tailwind utility classes)

## Version bump

| File | Before | After |
|------|--------|-------|
| `package.json` | 1.5.0 | 1.6.0 |
| `src-tauri/Cargo.toml` | 1.5.0 | 1.6.0 |
| `src-tauri/tauri.conf.json` | 1.5.0 | 1.6.0 |

No remaining references to 1.5.0 in version files.

## Verification

- TypeScript compilation: PASS
- Vitest: 233 tests pass (3 pre-existing Monaco failures unrelated)
- No 1.5.0 references remain in package.json, Cargo.toml, or tauri.conf.json
- All three docs reference correct source files

## Commits

1. `e0ff92a` -- docs(41-05): add extension developer documentation
2. `1886572` -- chore(41-05): bump version to v1.6.0
