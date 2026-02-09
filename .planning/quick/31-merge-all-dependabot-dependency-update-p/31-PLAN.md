# Quick Task 031: Merge all dependabot dependency update PRs (#6-#13)

## Task

Merge all 8 open dependabot PRs into main, verify builds pass, and clean up.

## PRs to Merge (ordered by category)

### Wave 1: GitHub Actions (no code conflicts)
1. **#7** - `actions/checkout` 4 → 6
2. **#8** - `actions/upload-pages-artifact` 3 → 4
3. **#9** - `actions/setup-node` 4 → 6

### Wave 2: Rust dependencies
4. **#6** - `time` 0.3.46 → 0.3.47
5. **#10** - `reqwest` 0.12 → 0.13

### Wave 3: npm dependencies
6. **#11** - minor-and-patch group (3 updates)
7. **#12** - `@vitest/coverage-v8` 3.2.4 → 4.0.18
8. **#13** - `vitest` 4.0.18

## Strategy

- Merge via `gh pr merge --merge` to preserve commit history
- Merge in waves: GitHub Actions → Rust → npm
- After each wave, pull main and let subsequent PRs rebase automatically
- vitest and @vitest/coverage-v8 should be merged together (version alignment)
- After all merges: verify `npm install && npm run build && npm test` pass

## Risk Assessment

- **vitest 3→4**: Major version bump, may require test config changes
- **reqwest 0.12→0.13**: Major version bump for Rust HTTP client, may require API changes
- **actions/***: Low risk, typically backward compatible
- **time 0.3.46→0.3.47**: Patch bump, very low risk
