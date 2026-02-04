---
phase: quick-020
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
  - LICENSE
  - CHANGELOG.md
  - .gitignore
autonomous: true

must_haves:
  truths:
    - "README.md exists with project description, features, and installation"
    - "LICENSE file exists with MIT license"
    - "CHANGELOG.md exists with v1.0.0 release notes"
    - ".gitignore excludes .planning/ directory"
  artifacts:
    - path: "README.md"
      provides: "Project documentation for GitHub"
      contains: "FlowForge"
    - path: "LICENSE"
      provides: "Open source license"
      contains: "MIT"
    - path: "CHANGELOG.md"
      provides: "Version history"
      contains: "1.0.0"
---

<objective>
Prepare FlowForge for public GitHub release with essential documentation files.

Purpose: Enable users to understand, install, and contribute to the project.

Output: README.md, LICENSE, CHANGELOG.md, and updated .gitignore.
</objective>

<context>
FlowForge v1.0 is complete:
- Tauri + React desktop Git client
- Gitflow workflow support
- Catppuccin Mocha theme
- Conventional commits
- Topology visualization
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create README.md</name>
  <files>README.md</files>
  <action>
    Create comprehensive README.md at project root with:
    - Project name and tagline
    - Screenshot placeholder
    - Features list (Gitflow, staging, branches, topology, conventional commits)
    - Tech stack (Tauri, React, Rust, libgit2)
    - Installation instructions (prerequisites, build from source)
    - Development setup
    - Contributing guidelines
    - License reference
  </action>
  <verify>test -f README.md && head -5 README.md</verify>
  <done>README.md exists with project documentation</done>
</task>

<task type="auto">
  <name>Task 2: Create LICENSE and CHANGELOG.md</name>
  <files>LICENSE, CHANGELOG.md</files>
  <action>
    Create LICENSE with MIT license text (year: 2026, author: phmatray).
    
    Create CHANGELOG.md following Keep a Changelog format with:
    - Header and format description
    - [1.0.0] - 2026-02-04 section with Added features
  </action>
  <verify>test -f LICENSE && test -f CHANGELOG.md</verify>
  <done>LICENSE and CHANGELOG.md exist</done>
</task>

<task type="auto">
  <name>Task 3: Update .gitignore</name>
  <files>.gitignore</files>
  <action>
    Add .planning/ to .gitignore to exclude internal planning documents from public repository.
    
    Also ensure these are excluded:
    - .planning/
    - target/
    - node_modules/
    - dist/
    - .DS_Store
  </action>
  <verify>grep -q ".planning" .gitignore</verify>
  <done>.gitignore updated to exclude planning docs</done>
</task>

</tasks>

<verification>
1. README.md contains "FlowForge" and installation instructions
2. LICENSE contains "MIT License"
3. CHANGELOG.md contains "1.0.0"
4. .gitignore contains ".planning/"
</verification>

<success_criteria>
- All 4 files exist at project root
- README is comprehensive and user-friendly
- LICENSE is valid MIT
- CHANGELOG follows standard format
- .gitignore excludes internal docs
</success_criteria>
