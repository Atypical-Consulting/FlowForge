# Plan 29-03 Summary: Migrate 3 Viewer Blades + Changelog

## Status: COMPLETE

## What was built
- Migrated viewer-code, viewer-markdown, viewer-nupkg, and changelog blades
- Changelog store moved into blade directory (blade-exclusive)
- ChangelogPreview sub-component co-located in blade
- Shared hooks (useRepoFile) and components (MarkdownRenderer) correctly left in shared locations

## Blades migrated
1. **viewer-code** — uses shared useRepoFile hook
2. **viewer-markdown** — uses shared useRepoFile + shared MarkdownRenderer
3. **viewer-nupkg** — uses shared NugetPackageViewer
4. **changelog** — exclusive store + sub-component co-located, singleton

## Key decisions
- changelogStore moved to `blades/changelog/store.ts` (blade-exclusive)
- ChangelogPreview moved to `blades/changelog/components/` (blade-exclusive)
- NugetPackageViewer kept shared (used by diff system)

## Self-Check: PASSED
- tsc --noEmit passes
- vitest run — 19 files, 87 tests pass

## Commit
- `7be475d` refactor(29-03): migrate 3 viewer blades and changelog with exclusive store
