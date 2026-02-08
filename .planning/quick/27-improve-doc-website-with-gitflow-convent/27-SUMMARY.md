# Quick Task 027 — Summary

## Task
Improve doc website with GitFlow/Conventional Commits explanations and download button.

## Changes Made

### New Pages (4 files)
- **`docs/concepts/index.md`** — Concepts overview page introducing GitFlow and Conventional Commits
- **`docs/concepts/gitflow.md`** — Educational guide explaining the GitFlow branching model: branch structure, lifecycle (features, releases, hotfixes), when to use it, and how FlowForge implements it
- **`docs/concepts/conventional-commits.md`** — Guide covering commit message format, types (feat, fix, docs, etc.), breaking changes, scopes, automated changelogs, and semantic versioning integration
- **`docs/download.md`** — Download page with platform-specific tables linking to v1.3.0 release assets (DMG, EXE, MSI, DEB, RPM, AppImage) with installation instructions

### Updated Pages (3 files)
- **`docs/.vitepress/config.mts`** — Added "Concepts" and "Download" to top nav; added `/concepts/` sidebar group
- **`docs/index.md`** — Changed primary hero CTA to "Download"; added "Conventional Commits Friendly" feature card
- **`docs/getting-started.md`** — Added download section pointing to the download page; added Concepts links to Next Steps; updated Node.js version to 22

## Commit
`d0c8da3` — docs: add Concepts section, download page, and homepage improvements

## Verification
- VitePress build completes successfully with no errors
