# Quick Task 033 — Improve Doc Website for v1.5.0

## What Changed

### Task 1: Fix download page + conventional commits status
- **docs/download.md** — Updated from v1.4.0 to v1.5.0, replaced all `Atypical-Consulting` org references with `phmatray`, updated release date
- **docs/features/conventional-commits.md** — Removed "Upcoming Feature" info banner (feature has shipped)

### Task 2: Add GitHub Integration + update homepage and overview
- **docs/features/github-integration.md** — Created new feature page covering authentication (Device Flow), pull requests, issues, and automatic remote detection
- **docs/index.md** — Expanded homepage from 4 to 6 feature cards: added "GitHub Integration" and "Extension System", renamed "Conventional Commits Friendly" to "Conventional Commits" with updated description
- **docs/features/index.md** — Added "GitHub Integration" and "Extension System" sections to features overview
- **docs/.vitepress/config.mts** — Added "GitHub Integration" entry to features sidebar navigation

## Verification
- No references to v1.4.0 remain in docs
- No references to Atypical-Consulting remain in docs
- No "Upcoming Feature" banners remain
- VitePress builds successfully without errors

## Commit
`c535621` — docs: update doc website for v1.5.0 with GitHub Integration
