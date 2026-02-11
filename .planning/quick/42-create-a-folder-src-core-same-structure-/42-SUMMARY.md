# Quick Task 42: Create src/core/ Structure

## What Changed

Moved all core system directories into `src/core/` to mirror the extensions organizational pattern.

### Directories Moved (9 total)
- `src/blades/` → `src/core/blades/`
- `src/commands/` → `src/core/commands/`
- `src/components/` → `src/core/components/`
- `src/hooks/` → `src/core/hooks/`
- `src/lib/` → `src/core/lib/`
- `src/machines/` → `src/core/machines/`
- `src/stores/` → `src/core/stores/`
- `src/test-utils/` → `src/core/test-utils/`
- `src/assets/` → `src/core/assets/`

### Files Remaining at src/ Root
- `App.tsx` - Main entry component
- `main.tsx` - React bootstrap
- `index.css` - Global styles
- `bindings.ts` - Auto-generated Tauri types
- `vite-env.d.ts` - Vite type defs
- `core/` - All core system code
- `extensions/` - All extension code

### Import Path Updates
- 164 files updated across the codebase
- Fixed `from "..."` imports, `vi.mock("...")` paths, dynamic `import("...")` calls
- Updated `vitest.config.ts` (setupFiles, coverage exclude)
- Updated `tsconfig.json` (exclude path)

## Verification
- TypeScript: Compiles with no new errors (pre-existing TS2440 only)
- Vite build: Succeeds
- Tests: 252 pass, 0 failures (3 test files with pre-existing monaco jsdom issue)
- Git history preserved via `git mv`

## Commits
1. `f4ac07c` - Move core directories into src/core/
2. `37537a1` - Fix all import paths after core/ move
