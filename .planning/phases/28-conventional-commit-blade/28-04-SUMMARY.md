# Plan 28-04 Summary: Preview Enhancement, Commit+Push, Amend Mode

## Status: COMPLETE

## What Was Built
- **Syntax-highlighted preview**: Subject line parsed into colored segments (type in CC theme color, scope in teal, breaking `!` in red, separator in overlay1, description in text), body/footer highlighting for BREAKING CHANGE
- **Column-72 ruler**: Dashed vertical line at column 72 with "72" label in full preview variant
- **Copy-to-clipboard**: Button with Check/Copy icon toggle (2s feedback timeout)
- **Subject character count**: Color-coded (green ≤50, yellow 51-72, red >72)
- **Success overlay**: Framer-motion animated checkmark with spring transition, 1.5s auto-navigate timer, "Stay here" cancel link
- **Commit+push pipeline**: Both `commit()` and `commitAndPush()` wired to blade footer via CommitActionBar
- **Amend mode**: Toggle in blade header with RotateCcw icon, warning banner with AlertTriangle, original message comparison in preview panel, CC parsing pre-fill via `useAmendPrefill.prefillConventional()`
- **Confirmation dialogs**: Amend commit and amend+force-push both show window.confirm before executing

## Key Files

### Modified
- `src/components/commit/CommitPreview.tsx` — syntax highlighting, ruler, copy, char count
- `src/components/blades/ConventionalCommitBlade.tsx` — success overlay, amend toggle, warning banner, auto-navigate

## Self-Check: PASSED
- [x] Type check clean
- [x] Vite build succeeds
- [x] 87/87 tests pass
- [x] Preview shows colored segments per CC part
- [x] Column-72 ruler visible in full variant
- [x] Success overlay with spring animation and auto-navigate
- [x] Amend toggle with warning banner and pre-fill

## Commit
`7fe57d7` feat(28-04): add syntax highlighting, success overlay, and amend mode to CC blade
