---
phase: quick-41
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # README files (new)
  - src/extensions/conventional-commits/README.md
  - src/extensions/gitflow/README.md
  - src/extensions/github/README.md
  - src/extensions/init-repo/README.md
  - src/extensions/viewer-3d/README.md
  - src/extensions/viewer-code/README.md
  - src/extensions/viewer-markdown/README.md
  - src/extensions/worktrees/README.md
  # manifest.json files (new)
  - src/extensions/conventional-commits/manifest.json
  - src/extensions/gitflow/manifest.json
  - src/extensions/github/manifest.json
  - src/extensions/init-repo/manifest.json
  - src/extensions/viewer-3d/manifest.json
  - src/extensions/viewer-code/manifest.json
  - src/extensions/viewer-markdown/manifest.json
  - src/extensions/worktrees/manifest.json
  # File moves for init-repo (blade from components/ to blades/)
  - src/extensions/init-repo/blades/InitRepoBlade.tsx
  - src/extensions/init-repo/components/index.ts
  - src/extensions/init-repo/index.ts
autonomous: true

must_haves:
  truths:
    - "Every extension (8 total) has a README.md describing its purpose, structure, blades, commands, and hooks"
    - "Every extension has a manifest.json matching the ExtensionManifest type schema"
    - "init-repo has its blade in blades/ directory instead of components/"
    - "All imports and barrel exports still resolve correctly after file moves"
    - "The application builds without errors (ignoring pre-existing TS2440 in bindings.ts)"
  artifacts:
    - path: "src/extensions/conventional-commits/README.md"
      provides: "Extension documentation"
    - path: "src/extensions/conventional-commits/manifest.json"
      provides: "Extension metadata"
    - path: "src/extensions/init-repo/blades/InitRepoBlade.tsx"
      provides: "Blade component in correct location"
  key_links:
    - from: "src/extensions/init-repo/index.ts"
      to: "src/extensions/init-repo/blades/InitRepoBlade.tsx"
      via: "lazy import path"
      pattern: "import.*blades/InitRepoBlade"
---

<objective>
Create README.md and manifest.json for each of the 8 user-facing extensions, and reorganize
init-repo to move its blade from components/ into a proper blades/ directory.

Purpose: Establish a consistent, documented file structure convention across all extensions so
that future extension authors have a clear pattern to follow. The manifest.json files provide
machine-readable metadata matching the Rust ExtensionManifest type.

Output: 8 README.md files, 8 manifest.json files, init-repo blade relocated to blades/.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/extensions/extensionManifest.ts
@src/extensions/extensionTypes.ts
@src/extensions/conventional-commits/index.ts
@src/extensions/gitflow/index.ts
@src/extensions/github/index.ts
@src/extensions/init-repo/index.ts
@src/extensions/viewer-3d/index.ts
@src/extensions/viewer-code/index.ts
@src/extensions/viewer-markdown/index.ts
@src/extensions/worktrees/index.tsx
@src/bindings.ts (lines 1593-1637 for ExtensionManifest type)
@src/App.tsx (lines 67-129 for registerBuiltIn calls)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create manifest.json for all 8 extensions and restructure init-repo</name>
  <files>
    src/extensions/conventional-commits/manifest.json
    src/extensions/gitflow/manifest.json
    src/extensions/github/manifest.json
    src/extensions/init-repo/manifest.json
    src/extensions/viewer-3d/manifest.json
    src/extensions/viewer-code/manifest.json
    src/extensions/viewer-markdown/manifest.json
    src/extensions/worktrees/manifest.json
    src/extensions/init-repo/blades/InitRepoBlade.tsx
    src/extensions/init-repo/components/index.ts
    src/extensions/init-repo/index.ts
  </files>
  <action>
    **A. Create manifest.json for each extension** matching the ExtensionManifest schema from bindings.ts.
    Each manifest.json must have these fields:
    - `id`: string (matches the id used in App.tsx registerBuiltIn)
    - `name`: string (matches the name used in registerBuiltIn)
    - `version`: "1.0.0"
    - `description`: string (one-sentence description of what the extension does)
    - `apiVersion`: "1"
    - `main`: "index.ts" (or "index.tsx" for worktrees)
    - `contributes`: object with `blades`, `commands`, `toolbar` arrays (nullable)
    - `permissions`: null (built-in extensions have full access)
    - `trustLevel`: "built-in"

    Extension-specific contributes data (extract from each index.ts onActivate):

    1. **conventional-commits**: blades: [{type:"conventional-commit",title:"Conventional Commit",singleton:true},{type:"changelog",title:"Generate Changelog",singleton:true}], commands: [{id:"generate-changelog",title:"Generate Changelog",category:"Repository"},{id:"open-conventional-commit",title:"Open Conventional Commit Composer",category:"Repository"}], toolbar: [{id:"changelog",label:"Changelog",group:"views",priority:30}]

    2. **gitflow**: blades: [{type:"gitflow-cheatsheet",title:"Gitflow Guide",singleton:true}], commands: [{id:"open-gitflow-cheatsheet",title:"Gitflow Cheatsheet",category:"Navigation"}], toolbar: [{id:"gitflow-guide",label:"Gitflow Guide",group:"views",priority:50}]. Also contributes a sidebar panel "gitflow-panel" but sidebar panels are not in the manifest contributes schema, so note it in the README only.

    3. **github**: blades: [{type:"sign-in",title:"GitHub Sign In",singleton:true},{type:"account",title:"GitHub Account",singleton:true},{type:"pull-requests",title:"Pull Requests",singleton:true},{type:"pull-request",title:"Pull Request",singleton:false},{type:"issues",title:"Issues",singleton:true},{type:"issue",title:"Issue",singleton:false},{type:"create-pr",title:"Create Pull Request",singleton:true}], commands: [{id:"sign-in",title:"Sign in to GitHub",category:"GitHub"},{id:"sign-out",title:"Sign out of GitHub",category:"GitHub"},{id:"open-pull-requests",title:"View Pull Requests",category:"GitHub"},{id:"open-issues",title:"View Issues",category:"GitHub"},{id:"create-pull-request",title:"Create Pull Request",category:"GitHub"}], toolbar: [{id:"github-status",label:"GitHub",group:"app",priority:60},{id:"open-pull-requests",label:"Pull Requests",group:"views",priority:50},{id:"open-issues",label:"Issues",group:"views",priority:45},{id:"create-pr",label:"Create Pull Request",group:"views",priority:55}]

    4. **init-repo**: blades: [{type:"init-repo",title:"Initialize Repository",singleton:true}], commands: [{id:"init-repository",title:"Initialize Repository",category:"Repository"}], toolbar: null

    5. **viewer-3d**: blades: [{type:"viewer-3d",title:"3D Model",singleton:null}], commands: null, toolbar: null

    6. **viewer-code**: blades: [{type:"viewer-code",title:"Code",singleton:null}], commands: null, toolbar: null

    7. **viewer-markdown**: blades: [{type:"viewer-markdown",title:"Markdown",singleton:null}], commands: null, toolbar: null

    8. **worktrees**: blades: null (sidebar panel only, no blade types), commands: [{id:"create-worktree",title:"Create Worktree",category:"Worktrees"},{id:"refresh-worktrees",title:"Refresh Worktrees",category:"Worktrees"}], toolbar: null. Also contributes sidebar panel "worktree-panel" (not in manifest schema).

    **B. Restructure init-repo:**
    1. Create `src/extensions/init-repo/blades/` directory
    2. Move `src/extensions/init-repo/components/InitRepoBlade.tsx` to `src/extensions/init-repo/blades/InitRepoBlade.tsx`
    3. Update the lazy import in `src/extensions/init-repo/index.ts` from `"./components/InitRepoBlade"` to `"./blades/InitRepoBlade"`
    4. Remove `InitRepoBlade` from `src/extensions/init-repo/components/index.ts` barrel export (if it's exported there)
    5. Verify no other file imports InitRepoBlade from the old path
  </action>
  <verify>
    - Run `ls src/extensions/*/manifest.json` to confirm 8 manifest files exist
    - Run `cat src/extensions/init-repo/blades/InitRepoBlade.tsx | head -5` to confirm blade was moved
    - Run `grep -r "components/InitRepoBlade" src/extensions/init-repo/` to confirm no old import paths remain
    - Run `npx tsc --noEmit 2>&1 | grep -v "bindings.ts(1493"` to verify no new type errors
  </verify>
  <done>
    8 manifest.json files exist with correct ExtensionManifest-schema fields.
    init-repo blade lives at blades/InitRepoBlade.tsx, index.ts imports from new path, no broken imports.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create README.md for all 8 extensions documenting structure and API surface</name>
  <files>
    src/extensions/conventional-commits/README.md
    src/extensions/gitflow/README.md
    src/extensions/github/README.md
    src/extensions/init-repo/README.md
    src/extensions/viewer-3d/README.md
    src/extensions/viewer-code/README.md
    src/extensions/viewer-markdown/README.md
    src/extensions/worktrees/README.md
  </files>
  <action>
    Create a README.md for each of the 8 extensions following a consistent template.

    Each README.md must contain these sections:

    ```
    # {Extension Name}

    {One-paragraph description of what the extension does and why it exists.}

    ## File Structure

    ```
    {extension-name}/
    ├── README.md
    ├── manifest.json
    ├── index.ts          # Entry point (onActivate / onDeactivate)
    ├── blades/            # (if applicable)
    │   └── ...
    ├── components/        # (if applicable)
    │   └── ...
    ├── hooks/             # (if applicable)
    │   └── ...
    ├── machines/          # (if applicable - for future XState machines)
    │   └── ...
    ├── types.ts           # (if applicable)
    └── store.ts           # (if applicable)
    ```

    Only include directories/files that actually exist in this extension.

    ## Blades

    | Type | Title | Singleton | Description |
    |------|-------|-----------|-------------|
    | ... | ... | ... | ... |

    (Or "This extension does not register any blades." if none.)

    ## Commands

    | ID | Title | Category | Description |
    |----|-------|----------|-------------|
    | ... | ... | ... | ... |

    (Or "This extension does not register any commands." if none.)

    ## Toolbar Actions

    | ID | Label | Group | Priority |
    |----|-------|-------|----------|
    | ... | ... | ... | ... |

    (Or "This extension does not contribute any toolbar actions." if none.)

    ## Sidebar Panels

    (Only include this section for gitflow and worktrees which contribute sidebar panels.)
    | ID | Title | Default Open |
    |----|-------|-------------|
    | ... | ... | ... |

    ## Hooks & Stores

    (Only include if the extension has hooks/ or store files. Brief description of each.)

    ## Extension Standard Structure Reference

    Every FlowForge extension should follow this directory convention:

    ```
    extension-name/
    ├── README.md          # Extension documentation (this file)
    ├── manifest.json      # Extension metadata
    ├── index.ts           # Entry point (onActivate/onDeactivate)
    ├── blades/            # Blade components
    ├── components/        # Shared UI components
    ├── commands/          # Command definitions (if complex)
    ├── hooks/             # React hooks
    ├── machines/          # XState machines
    ├── types.ts           # Extension-specific types
    └── store.ts           # Zustand stores
    ```
    ```

    **Extension-specific content:**

    1. **conventional-commits**: Provides conventional commit composer and changelog generator. Has 2 blades (conventional-commit, changelog), 2 commands, 1 toolbar action. Components: form, type selector, scope autocomplete, validation, preview, template selector. Blade-local store (changelog/store.ts) and blade-local hook (useBladeFormGuard).

    2. **gitflow**: Provides Gitflow workflow management with cheatsheet blade, sidebar panel, and action dialogs. Has 1 blade, 1 command, 1 toolbar action, 1 sidebar panel. Components: action cards, diagram, branch reference, init/start/finish dialogs, review checklist.

    3. **github**: Comprehensive GitHub integration with auth, PRs, and issues. Has 7 blades, 5 commands, 4 toolbar actions. Has hooks/ (useGitHubQuery, useGitHubMutation), githubStore.ts, types.ts. Components: status button, label pills, comment cards, merge dialogs, user avatars, etc.

    4. **init-repo**: Repository initialization wizard with .gitignore templates. Has 1 blade (now in blades/), 1 command. Has store.ts. Components: form, template picker, preview, project detection.

    5. **viewer-3d**: 3D model file viewer (.obj, .stl, etc.). Has 1 blade, no commands, no toolbar.

    6. **viewer-code**: Source code viewer with Monaco editor. Has 1 blade, no commands, no toolbar.

    7. **viewer-markdown**: Markdown file viewer with rendered preview. Has 1 blade, no commands, no toolbar.

    8. **worktrees**: Git worktree management via sidebar panel. Has 0 blades (sidebar panel only), 2 commands, 0 toolbar actions, 1 sidebar panel. Components: worktree item, create/delete dialogs.

    Do NOT include the "Extension Standard Structure Reference" section in every README -- only include it once in a top-level comment at the end of each README as a short note: "See the [Extension Development Guide](../EXTENSIONS.md) for the standard structure convention." (We will not create EXTENSIONS.md now -- just reference it as a future doc.)

    Actually, simplify: just include the standard structure tree directly in each README in a collapsed `<details>` block at the bottom titled "Extension Directory Convention".
  </action>
  <verify>
    - Run `ls src/extensions/*/README.md` to confirm 8 README files exist
    - Verify each README has at minimum: title, description, file structure, blades table, commands table
    - Run `wc -l src/extensions/*/README.md` to confirm each has substantive content (>30 lines)
  </verify>
  <done>
    All 8 extensions have README.md files with consistent structure documenting blades, commands,
    toolbar actions, sidebar panels, hooks, and stores. Each includes the actual file tree and a
    collapsed reference to the standard extension directory convention.
  </done>
</task>

<task type="auto">
  <name>Task 3: Verify build and test integrity after all changes</name>
  <files></files>
  <action>
    Run the full verification suite to ensure nothing is broken:
    1. `npx tsc --noEmit` -- type check (ignore pre-existing TS2440 in bindings.ts)
    2. `npx vitest run` -- run all tests to ensure no regressions
    3. Verify the init-repo lazy import resolves by checking the import path in index.ts matches the actual file location

    If any test failures or type errors appear (beyond the known bindings.ts TS2440), fix them before completing.
  </action>
  <verify>
    - `npx tsc --noEmit 2>&1 | grep -v "bindings.ts(1493" | grep "error"` returns no results
    - `npx vitest run` passes (or only pre-existing failures)
  </verify>
  <done>
    TypeScript compilation succeeds (no new errors). All tests pass. The application would build
    and run correctly with the new manifest.json files, README.md files, and relocated init-repo blade.
  </done>
</task>

</tasks>

<verification>
- 8 manifest.json files exist and are valid JSON matching ExtensionManifest schema
- 8 README.md files exist with consistent section structure
- init-repo blade is at blades/InitRepoBlade.tsx, not components/InitRepoBlade.tsx
- `npx tsc --noEmit` passes (ignoring known bindings.ts issue)
- `npx vitest run` passes
</verification>

<success_criteria>
Every extension in src/extensions/ (excluding __tests__ and sandbox) has:
1. A manifest.json with id, name, version, description, apiVersion, main, contributes, permissions, trustLevel
2. A README.md documenting its purpose, file structure, blades, commands, toolbar actions, and any hooks/stores
3. init-repo follows the standard structure with blade in blades/ directory
4. No build or test regressions
</success_criteria>

<output>
After completion, create `.planning/quick/41-create-a-readme-for-each-extension-defin/41-SUMMARY.md`
</output>
