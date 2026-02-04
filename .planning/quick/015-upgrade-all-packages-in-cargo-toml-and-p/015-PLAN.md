---
phase: quick
plan: 015
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/Cargo.toml
  - package.json
  - Cargo.lock
  - package-lock.json
autonomous: true

must_haves:
  truths:
    - "All Rust dependencies are at latest stable versions"
    - "Rust edition is 2024"
    - "All npm packages are at latest versions"
    - "Project builds and runs successfully"
  artifacts:
    - path: "src-tauri/Cargo.toml"
      provides: "Updated Rust dependencies and edition"
      contains: 'edition = "2024"'
    - path: "package.json"
      provides: "Updated npm dependencies"
  key_links:
    - from: "src-tauri/Cargo.toml"
      to: "Cargo.lock"
      via: "cargo update"
    - from: "package.json"
      to: "package-lock.json"
      via: "npm install"
---

<objective>
Upgrade all dependencies to their latest versions

Purpose: Keep the project up-to-date with the latest features, security patches, and performance improvements from all dependencies.
Output: Updated Cargo.toml (with Rust 2024 edition), package.json, and regenerated lock files.
</objective>

<context>
@src-tauri/Cargo.toml
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Upgrade Rust dependencies and edition</name>
  <files>src-tauri/Cargo.toml</files>
  <action>
Update src-tauri/Cargo.toml with the following changes:

1. Change edition from "2021" to "2024"

2. Update dependencies to latest versions:
   - tauri-build = "2" (keep as-is, will resolve to 2.10.x)
   - tauri = "2" (keep as-is, will resolve to 2.10.x)
   - tauri-plugin-opener = "2" (keep as-is)
   - tauri-plugin-dialog = "2" (keep as-is)
   - tauri-plugin-store = "2" (keep as-is)
   - tauri-plugin-window-state = "2" (keep as-is)
   - tauri-specta = "2.0.0-rc.21" (keep as-is, this is latest RC)
   - specta = "=2.0.0-rc.22" (keep as-is, this is latest RC)
   - specta-typescript = "0.0.9" (keep as-is, this is latest)
   - serde = "1" (keep as-is)
   - serde_json = "1" (keep as-is)
   - tokio = "1" (keep as-is)
   - thiserror = "2" (keep as-is)
   - git2 = "0.20" (keep as-is, will resolve to 0.20.x)
   - statig = "0.3" (keep as-is)
   - git-conventional = "0.12" (keep as-is, will resolve to 0.12.x)
   - tera = "1" (keep as-is)
   - chrono = "0.4" (keep as-is, will resolve to 0.4.x)

3. Run `cargo update` in src-tauri/ directory to update Cargo.lock

Note: The Rust 2024 edition is the latest stable edition and provides new language features and improved ergonomics.
  </action>
  <verify>
Run from src-tauri directory:
- `cargo check` passes without errors
- `grep 'edition = "2024"' Cargo.toml` shows the new edition
  </verify>
  <done>Cargo.toml uses Rust 2024 edition and all dependencies resolve to latest compatible versions</done>
</task>

<task type="auto">
  <name>Task 2: Upgrade npm packages</name>
  <files>package.json</files>
  <action>
Run npm-check-updates to upgrade all packages to their latest versions:

```bash
# Install ncu if not available
npx npm-check-updates -u

# Install updated packages
npm install
```

This will update all dependencies in package.json to their latest versions:
- React 19.x (already latest major)
- Tauri 2.x plugins (already latest major)
- Vite 6.x (already latest major)
- Tailwind CSS 4.x (already latest major)
- All other packages to latest minor/patch versions

After update, verify the project still builds correctly.
  </action>
  <verify>
Run:
- `npm run build` completes successfully
- `npm run tauri build` completes successfully (or at minimum `npm run tauri dev` starts)
  </verify>
  <done>All npm packages are at their latest versions and the project builds successfully</done>
</task>

<task type="auto">
  <name>Task 3: Verify full build and commit changes</name>
  <files>src-tauri/Cargo.toml, package.json, Cargo.lock, package-lock.json</files>
  <action>
1. Run a full build to verify everything works together:
   ```bash
   npm run tauri build
   ```

2. If build fails due to Rust 2024 edition incompatibilities, address them:
   - Check for deprecated patterns that are errors in 2024 edition
   - Update any code that uses removed features
   - Most likely candidates: raw string literals, unsafe blocks, lifetime elision rules

3. If all builds pass, commit the changes:
   ```bash
   git add src-tauri/Cargo.toml src-tauri/Cargo.lock package.json package-lock.json
   git commit -m "chore: upgrade all dependencies to latest versions

- Rust edition updated from 2021 to 2024
- Cargo dependencies updated via cargo update
- npm packages updated to latest versions"
   ```
  </action>
  <verify>
- Full Tauri build completes without errors
- Application launches and functions correctly
- Git commit is created
  </verify>
  <done>All dependencies upgraded, project builds successfully, changes committed</done>
</task>

</tasks>

<verification>
- `cargo check` in src-tauri/ passes
- `npm run build` passes
- `npm run tauri dev` launches the application
- Git shows clean working tree with new commit
</verification>

<success_criteria>
- Rust edition is 2024
- All Cargo dependencies resolve to their latest compatible versions
- All npm dependencies are at their latest versions
- The application builds and runs without errors
- Changes are committed to git
</success_criteria>

<output>
After completion, create `.planning/quick/015-upgrade-all-packages-in-cargo-toml-and-p/015-SUMMARY.md`
</output>
