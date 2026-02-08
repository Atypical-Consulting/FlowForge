# Phase 27 Research: Init Repo Blade (Synthesis)

**Researched by**: 3-agent team (UX, Architecture, Expert Developer)
**Date**: 2026-02-08
**Detailed files**: 27-RESEARCH-UX.md

---

## Key Findings Across All Perspectives

### 1. Rendering Context: Pre-Repo Blade

**Critical finding**: The Init Repo blade runs BEFORE a repo is open. The blade container (`BladeContainer`) only renders inside `RepositoryView`, which requires `status` to be non-null.

**Recommendation: Approach A** — Render `InitRepoBlade` as a standalone view within `WelcomeView`, not inside the blade infrastructure. The component should use the same visual patterns (BladePanel header, Catppuccin colors, same spacing) but render outside blade navigation. After init succeeds, `openRepository(path)` sets `status` → `RepositoryView` renders automatically.

```typescript
// In WelcomeView.tsx
{pendingInitPath && !error && (
  <InitRepoBlade
    path={pendingInitPath}
    onCancel={() => setPendingInitPath(null)}
    onComplete={async (path) => {
      await openRepository(path);
      await addRecentRepo(path);
    }}
  />
)}
```

### 2. Two-Column Split Pane Layout

All three perspectives converge on a **two-column layout**:
- **Left (55%)**: Configuration form with collapsible sections
- **Right (45%)**: Context-sensitive preview panel

Reuse existing `SplitPaneLayout` component. This mirrors the `StagingChangesBlade` pattern.

### 3. Form Architecture: Single-Page with Sections

**Not a wizard** — single-page layout with collapsible sections because:
- Only 5-6 decisions total (low cognitive load)
- Sections are interdependent (gitignore affects commit summary)
- Matches existing SettingsBlade density
- Progressive disclosure via collapsible sections

**Sections:**
1. **Core Config** (always visible): directory path, branch name, project detection badge
2. **.gitignore** (collapsible, expanded): recommendations, selected chips, template picker
3. **README.md** (collapsible, collapsed): toggle + project name + description
4. **Initial Commit** (collapsible, collapsed): toggle + commit message

### 4. Rust Backend: 4 New Commands

| Command | Signature | Purpose |
|---|---|---|
| `list_gitignore_templates` | `() -> Result<GitignoreTemplateList, GitError>` | Fetch names from GitHub API, fallback to bundled |
| `get_gitignore_template` | `(name: String) -> Result<GitignoreTemplate, GitError>` | Fetch single template content |
| `detect_project_type` | `(path: String) -> Result<ProjectDetection, GitError>` | Scan directory for marker files |
| `write_init_files` | `(path: String, files: Vec<InitFile>) -> Result<(), GitError>` | Write .gitignore, README.md to disk |

**Existing commands reused as-is:** `git_init` (already in `src-tauri/src/git/init.rs`), `open_repository`, `stage_all`, `create_commit`.

**New Rust dependency:** `reqwest` for GitHub API calls (with 5s timeout, fallback to bundled on failure).

### 5. Offline Strategy

**Approach: Let request fail gracefully** — no proactive network detection.
- Attempt `reqwest` with 5-second timeout
- On any error → fall back to 20 bundled templates embedded via `include_str!()`
- Return `source: "github" | "bundled"` field so UI can display status
- Bundled templates stored as `src-tauri/resources/bundled-gitignore-templates.json` (~5-8 KB)

**Top 20 bundled:** Node, Python, Rust, Go, Java, C#, Swift, Kotlin, Ruby, C++, VisualStudio, JetBrains, VisualStudioCode, macOS, Windows, Linux, Unity, Gradle, Maven, Terraform

### 6. Template Composition Logic

Client-side TypeScript (no IPC needed):
- Concatenate templates in user-specified order
- Deduplicate rules across templates
- Comment each section with template name: `# === Node ===`
- Collapse excessive blank lines

Place in `src/lib/gitignoreComposer.ts`.

### 7. Project Type Detection (INIT-09)

Scan target directory for marker files in Rust:

| Marker | Detected Type | Recommended Templates |
|---|---|---|
| `package.json` | Node | Node |
| `tsconfig.json` | TypeScript | Node |
| `Cargo.toml` | Rust | Rust |
| `go.mod` | Go | Go |
| `pom.xml` / `build.gradle` | Java | Java, Gradle/Maven |
| `*.csproj` / `*.sln` | C# | VisualStudio |
| `requirements.txt` / `pyproject.toml` | Python | Python |
| `.idea/` | JetBrains | JetBrains |
| `.vscode/` | VS Code | VisualStudioCode |

Pre-select recommended templates by default (smart defaults).

### 8. Extensibility: Init Step Registry Pattern

The blade should use a **pipeline of composable init steps** (like bladeRegistry):

```typescript
interface InitStep {
  id: string;
  label: string;
  icon: React.ComponentType;
  defaultEnabled: boolean;
  order: number;
  ConfigPanel: React.ComponentType<InitStepPanelProps>;
  produce: (config, context) => InitArtifact | null;
}
```

**Built-in steps:** gitignore, branch, readme, initial-commit
**Future steps (easy to add):** license, editorconfig, gitattributes, CI pipeline

Adding a new step requires: 1) ConfigPanel component, 2) produce function, 3) registry call. No blade/store/Rust changes.

### 9. Generic TemplatePicker Component

Design the template picker as `TemplatePicker<T>` — not tied to .gitignore:

```typescript
interface TemplatePickerProps<T> {
  templates: T[];
  getLabel: (t: T) => string;
  getCategory?: (t: T) => string;
  getContent?: (t: T) => string | Promise<string>;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  multiSelect?: boolean;
}
```

Reusable for future license/CI/editorconfig template pickers.

### 10. State Management

**Zustand store** (`useInitRepoStore`) for init blade state — consistent with existing pattern. Not react-hook-form because:
- Multi-step wizard with toggleable steps doesn't fit form-validation model
- Need template multi-select, search, and async detection state
- Zustand is consistent with all other FlowForge stores

**React Query** for template data caching — `staleTime: Infinity` within session.

### 11. Entry Points

**Entry A (existing):** WelcomeView → user picks non-git folder → currently shows `GitInitBanner` inline. Replace banner with button that opens Init Repo view. Path captured in `pendingInitPath`.

**Entry B (new):** Add "Init Repository" button to WelcomeView alongside "Open Repository" and "Clone Repository".

### 12. Init Execution Pipeline

```
1. git_init(path, defaultBranch)           // Create .git/
2. write_init_files(path, files)           // Write .gitignore, README.md
3. open_repository(path)                   // Set as active repo
4. If "initial commit" enabled:
   4a. stage_all()                         // Stage files
   4b. create_commit("Initial commit")     // First commit
```

### 13. Blade Registration

```typescript
// src/components/blades/registrations/init-repo.ts
registerBlade<{ path: string }>({
  type: "init-repo",
  defaultTitle: "Initialize Repository",
  component: InitRepoBlade,
  lazy: true,
  singleton: true,
  wrapInPanel: false,
});
```

Add `"init-repo"` to `BladePropsMap` and `EXPECTED_TYPES`.

### 14. File Organization (Phase 29 Ready)

```
src/
  components/
    blades/
      InitRepoBlade.tsx
      registrations/init-repo.ts
    init-repo/
      InitRepoView.tsx              // Standalone view for WelcomeView
      steps/
        GitignoreStep.tsx
        BranchStep.tsx
        ReadmeStep.tsx
        InitialCommitStep.tsx
      components/
        TemplatePicker.tsx           // Generic, reusable
        TemplatePreview.tsx
        CategoryFilter.tsx
        ProjectDetectionBanner.tsx
        InitProgress.tsx
  hooks/
    useGitignoreTemplates.ts         // React Query hooks
  lib/
    initStepRegistry.ts
    gitignoreComposer.ts
    gitignoreCategories.ts
  stores/
    initRepo.ts
src-tauri/src/
  git/
    gitignore.rs                     // New: GitHub API + bundled templates
    init.rs                          // Existing: no changes
  resources/
    bundled-gitignore-templates.json
```

### 15. Accessibility

- Full keyboard navigation for template picker (Arrow keys, Space, Enter)
- ARIA roles: `listbox` with `aria-multiselectable="true"` for templates
- `aria-live="polite"` for selection changes and progress updates
- Focus management: auto-focus search on picker open, return focus on close
- `useReducedMotion()` for all framer-motion animations
- WCAG 2.1 AA contrast compliance with Catppuccin Mocha tokens

---

## RESEARCH COMPLETE

All three perspectives (UX, Architecture, Expert Developer) converge on the same core architecture. Key differentiator from competitors: multi-template .gitignore composition with preview. Ready for planning.
