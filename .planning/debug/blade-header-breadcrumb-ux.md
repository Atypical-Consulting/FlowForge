---
status: resolved
trigger: "blade header/breadcrumb UX — back button and breadcrumb should be merged into one row"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:00:00Z
---

## Current Focus

hypothesis: Back button and breadcrumbs are in separate visual rows because BladePanel renders the back button in row 1 (header bar) and RepoBrowserBlade renders breadcrumbs in row 2 (BladeToolbar). Viewer blades use renderPathTitle in the header but it is not interactive (not clickable breadcrumbs). DiffBlade has its own inline toolbar with no breadcrumb at all.
test: Read all blade components, registrations, and the rendering pipeline
expecting: Confirm the two-row layout and inconsistent patterns across blade types
next_action: Document findings

## Symptoms

expected: Back button and breadcrumb in one unified row across all blade types
actual: Two rows — BladePanel header (back button + path title) then BladeToolbar (breadcrumbs) — and inconsistent patterns across viewers
errors: N/A (UX issue, not a code error)
reproduction: Open repo browser, navigate into a subdirectory — observe two rows
started: Since breadcrumb was added

## Eliminated

(none needed — root cause is structural and clear)

## Evidence

- timestamp: 2026-02-07
  checked: BladePanel.tsx, BladeRenderer.tsx, BladeContainer.tsx
  found: BladePanel renders a fixed h-10 header bar with back button + title/titleContent + trailing. BladeRenderer passes goBack, showBack, titleContent from registration.
  implication: The back button lives in BladePanel header (row 1).

- timestamp: 2026-02-07
  checked: RepoBrowserBlade.tsx
  found: Renders <BladeToolbar><Breadcrumbs /></BladeToolbar> as its own child — this appears as row 2 below the BladePanel header.
  implication: Breadcrumbs are in a second visual row, separate from the back button.

- timestamp: 2026-02-07
  checked: All viewer registrations (viewer-code, viewer-markdown, viewer-3d, viewer-image, diff)
  found: All use renderPathTitle() which renders a non-interactive <span> showing "path/ filename" — purely display, not clickable breadcrumbs.
  implication: Viewer blades have no navigable breadcrumb at all, just a static path display in the header.

- timestamp: 2026-02-07
  checked: DiffBlade.tsx
  found: DiffBlade builds its own inline toolbar div (not using BladeToolbar component) with diff toggles and staging navigation. No breadcrumb.
  implication: DiffBlade has a third pattern — custom toolbar, no breadcrumb, path shown only via renderPathTitle in BladePanel header.

## Resolution

root_cause: The blade header system has three separate patterns that should be unified:
  1. BladePanel (row 1) — back button + static renderPathTitle
  2. BladeToolbar (row 2, repo-browser only) — interactive breadcrumbs
  3. DiffBlade — inline custom toolbar (row 2) with no breadcrumb
  The back button and breadcrumb are structurally separated across two DOM rows.

fix: (not applied — diagnosis only)
verification: (not applicable)
files_changed: []
