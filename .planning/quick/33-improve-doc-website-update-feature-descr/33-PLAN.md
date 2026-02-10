---
phase: 33-improve-doc-website
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/index.md
  - docs/download.md
  - docs/features/index.md
  - docs/features/conventional-commits.md
  - docs/features/github-integration.md
  - docs/.vitepress/config.mts
autonomous: true

must_haves:
  truths:
    - "Homepage showcases all major v1.5.0 features including GitHub Integration"
    - "Download page shows v1.5.0 with correct phmatray GitHub org URLs"
    - "Conventional Commits feature page reflects shipped status, not upcoming"
    - "Features overview lists GitHub Integration as a core capability"
    - "GitHub Integration has its own feature page in the docs"
    - "VitePress sidebar includes GitHub Integration link"
  artifacts:
    - path: "docs/index.md"
      provides: "Updated homepage with 6 feature cards"
      contains: "GitHub Integration"
    - path: "docs/download.md"
      provides: "v1.5.0 download links with phmatray org"
      contains: "v1.5.0"
    - path: "docs/features/index.md"
      provides: "Features overview with GitHub Integration section"
      contains: "GitHub Integration"
    - path: "docs/features/conventional-commits.md"
      provides: "Conventional Commits page without upcoming banner"
    - path: "docs/features/github-integration.md"
      provides: "New GitHub Integration feature page"
      contains: "Pull Requests"
    - path: "docs/.vitepress/config.mts"
      provides: "Sidebar with GitHub Integration entry"
      contains: "github-integration"
  key_links:
    - from: "docs/index.md"
      to: "/features/github-integration"
      via: "feature card link"
      pattern: "GitHub Integration"
    - from: "docs/features/index.md"
      to: "/features/github-integration"
      via: "Learn more link"
      pattern: "github-integration"
---

<objective>
Update the FlowForge documentation website to accurately reflect v1.5.0 capabilities.

Purpose: The docs are outdated — download page shows v1.4.0, conventional commits is marked "upcoming" but shipped months ago, the GitHub Extension (v1.5.0 flagship feature) has no documentation, and download URLs reference the wrong GitHub org. This plan brings all docs current.

Output: Updated homepage, download page, features overview, conventional commits page, new GitHub Integration feature page, and updated VitePress config.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/index.md
@docs/download.md
@docs/features/index.md
@docs/features/conventional-commits.md
@docs/.vitepress/config.mts
@src/extensions/github/index.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix download page, conventional commits status, and GitHub org references</name>
  <files>docs/download.md, docs/features/conventional-commits.md</files>
  <action>
**docs/download.md — Update to v1.5.0:**
- Change heading from "Latest Release -- v1.4.0" to "Latest Release -- v1.5.0"
- Update release date to current (check git log for v1.5.0 tag date, or use "February 2026")
- Replace ALL occurrences of `Atypical-Consulting` with `phmatray` in GitHub URLs (the repo lives at github.com/phmatray/FlowForge, not Atypical-Consulting)
- Replace ALL occurrences of `1.4.0` with `1.5.0` in download URLs, filenames, and install commands
- Update the "All Releases" link at the bottom to also use `phmatray` org

**docs/features/conventional-commits.md — Remove "upcoming" status:**
- Remove the entire `::: info Upcoming Feature` / `:::` callout block at the top (lines 3-5)
- The Conventional Commit blade is fully shipped (ConventionalCommitBlade.tsx exists with full form, preview, templates, scope autocomplete, amend support)
- Keep all other content as-is — the feature descriptions accurately match the implementation
- Optionally add a brief note at the top that the feature is available via the Conventional Commit blade (accessible from staging or command palette)
  </action>
  <verify>
- `grep -c "1.4.0" docs/download.md` returns 0
- `grep -c "Atypical-Consulting" docs/download.md` returns 0
- `grep -c "v1.5.0" docs/download.md` returns at least 1
- `grep -c "Upcoming Feature" docs/features/conventional-commits.md` returns 0
  </verify>
  <done>Download page shows v1.5.0 with correct phmatray GitHub org URLs. Conventional Commits page reflects shipped status without "upcoming" banner.</done>
</task>

<task type="auto">
  <name>Task 2: Add GitHub Integration feature page and update homepage + features overview</name>
  <files>docs/features/github-integration.md, docs/features/index.md, docs/index.md, docs/.vitepress/config.mts</files>
  <action>
**docs/features/github-integration.md — Create new feature page:**
Create a feature page for the GitHub Integration extension (the v1.5.0 flagship feature). Content should cover:

- **Overview paragraph** — FlowForge's GitHub extension connects your local repository to GitHub, letting you manage pull requests, issues, and authentication without leaving the app. It uses GitHub's Device Flow for secure sign-in.

- **Authentication section** — Device Flow sign-in (no PAT pasting), scope profiles (Basic read-only vs Full access vs Custom), secure token storage in OS keychain, account management blade showing username/avatar.

- **Pull Requests section** — Browse open/closed/merged PRs, view PR details (description, reviewers, labels, checks), create new PRs from current branch with title/body/base-branch/draft toggle, toolbar button for quick access.

- **Issues section** — Browse open/closed issues, view issue details (description, labels, assignees, comments), toolbar button for quick access.

- **Automatic Remote Detection** — FlowForge auto-detects GitHub remotes when opening a repository, toolbar buttons appear contextually only when authenticated and a GitHub remote is detected.

- **See Also links** at the bottom: link to getting-started and concepts/blade-navigation.

**docs/features/index.md — Add GitHub Integration section:**
After the "Review Checklist" section (last current item), add:

```
### GitHub Integration
Connect your local repository to GitHub without leaving FlowForge. Browse and create pull requests, view issues, and manage your GitHub account — all from dedicated blades. Sign in securely via GitHub's Device Flow. [Learn more →](/features/github-integration)
```

Also add a section for "Extension System" briefly noting that FlowForge v1.5.0 introduced an extension architecture, and GitHub Integration is the first built-in extension.

**docs/index.md — Update homepage feature cards:**
The homepage currently has 4 feature cards. Update to 6 cards that better represent v1.5.0:

1. "Gitflow Built-In" — keep as-is
2. "Fast & Native" — keep as-is
3. "Visual Topology" — keep as-is
4. "GitHub Integration" — NEW: "Browse pull requests, create PRs from your current branch, and view issues — all without leaving FlowForge. Sign in via GitHub Device Flow."
5. "Conventional Commits" — UPDATE details to: "Write structured commit messages with a guided editor, live preview, scope autocomplete, and reusable templates."
6. "Extension System" — NEW: "FlowForge v1.5.0 introduces a modular extension architecture. GitHub Integration ships as the first built-in extension, with more to come."

**docs/.vitepress/config.mts — Add sidebar entry:**
In the `/features/` sidebar items array, add a new entry after "Conventional Commits":
```ts
{
  text: "GitHub Integration",
  link: "/features/github-integration",
},
```
  </action>
  <verify>
- `ls docs/features/github-integration.md` confirms file exists
- `grep "GitHub Integration" docs/features/index.md` returns matches
- `grep "GitHub Integration" docs/index.md` returns matches
- `grep "github-integration" docs/.vitepress/config.mts` returns matches
- Run `cd /Users/phmatray/Repositories/github-phm/FlowForge && npx vitepress build docs` to confirm docs build without errors
  </verify>
  <done>GitHub Integration has a dedicated feature page. Homepage shows 6 feature cards including GitHub Integration and Extension System. Features overview includes GitHub Integration section. VitePress sidebar links to the new page. Docs build successfully.</done>
</task>

</tasks>

<verification>
1. `npx vitepress build docs` completes without errors
2. No references to v1.4.0 remain in any docs file: `grep -r "1.4.0" docs/` returns nothing
3. No references to Atypical-Consulting remain: `grep -r "Atypical-Consulting" docs/` returns nothing
4. No "Upcoming Feature" or "currently in development" text remains: `grep -r "Upcoming Feature" docs/` returns nothing
5. GitHub Integration is linked from homepage, features overview, and sidebar
6. All internal links resolve (no broken links in build output)
</verification>

<success_criteria>
- Download page shows v1.5.0 with phmatray org GitHub URLs
- Conventional Commits page reflects shipped status
- GitHub Integration has a complete feature page documenting auth, PRs, issues, and remote detection
- Homepage features 6 cards covering the full v1.5.0 capability set
- Features overview includes GitHub Integration section
- VitePress builds without errors and sidebar includes all feature pages
</success_criteria>

<output>
After completion, create `.planning/quick/33-improve-doc-website-update-feature-descr/33-SUMMARY.md`
</output>
