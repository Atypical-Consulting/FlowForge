---
phase: quick-021
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/release.yml
autonomous: true

must_haves:
  truths:
    - "Tag push triggers automated release build"
    - "Builds complete for macOS, Linux, and Windows"
    - "GitHub Release created with all platform artifacts"
  artifacts:
    - path: ".github/workflows/release.yml"
      provides: "Tag-triggered release workflow"
      contains: "on: push: tags"
  key_links:
    - from: ".github/workflows/release.yml"
      to: "GitHub Releases"
      via: "tauri-apps/tauri-action"
      pattern: "tauri-apps/tauri-action"
---

<objective>
Create a GitHub Actions workflow that automatically builds and releases FlowForge for macOS, Linux, and Windows when a version tag is pushed.

Purpose: Enable automated cross-platform release distribution through GitHub Releases
Output: Complete CI/CD workflow file ready for tag-triggered releases
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Create GitHub Actions release workflow</name>
  <files>.github/workflows/release.yml</files>
  <action>
Create the `.github/workflows/` directory and `release.yml` workflow file with:

**Trigger:** Push tags matching `v*` pattern (e.g., v1.0.0, v0.2.0-beta)

**Jobs:**
1. `release` job using matrix strategy for three platforms:
   - `macos-latest` for macOS builds (.dmg, .app)
   - `ubuntu-22.04` for Linux builds (.deb, .AppImage)
   - `windows-latest` for Windows builds (.msi, .exe)

**Steps for each platform:**
1. Checkout code with `actions/checkout@v4`
2. Setup Node.js 20 with `actions/setup-node@v4`
3. Setup Rust stable with `dtolnay/rust-action@stable`
4. Install Linux dependencies (only on ubuntu):
   ```
   sudo apt-get update
   sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
   ```
5. Install npm dependencies: `npm ci`
6. Build and release with `tauri-apps/tauri-action@v0`:
   - Set `tagName: ${{ github.ref_name }}`
   - Set `releaseName: "FlowForge ${{ github.ref_name }}"`
   - Set `releaseBody: "See the assets to download and install this version."`
   - Set `releaseDraft: false`
   - Set `prerelease: false`
   - Pass `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`

**Permissions:** Contents write (for creating releases)
  </action>
  <verify>
    - File exists at `.github/workflows/release.yml`
    - YAML syntax is valid
    - Contains trigger on tag push
    - Contains matrix with all three OS targets
    - Contains tauri-apps/tauri-action step
  </verify>
  <done>
    - Workflow file created with proper structure
    - Triggers on version tags (v*)
    - Builds for macOS, Linux, Windows in parallel
    - Creates GitHub Release with artifacts automatically
  </done>
</task>

</tasks>

<verification>
- [ ] `.github/workflows/release.yml` exists
- [ ] Workflow has valid YAML syntax
- [ ] Trigger is configured for tag pushes (v*)
- [ ] Matrix includes macos-latest, ubuntu-22.04, windows-latest
- [ ] Linux job installs WebKit and other Tauri dependencies
- [ ] Uses tauri-apps/tauri-action for build and release
- [ ] Permissions set for release creation
</verification>

<success_criteria>
When a tag like `v1.0.0` is pushed to the repository:
1. GitHub Actions workflow triggers automatically
2. Three parallel jobs start (macOS, Linux, Windows)
3. Each job builds the Tauri app for its platform
4. A GitHub Release is created with all platform artifacts attached
</success_criteria>
