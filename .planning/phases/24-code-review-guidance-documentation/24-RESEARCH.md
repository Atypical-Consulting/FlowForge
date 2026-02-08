# Phase 24: Code Review Guidance & Documentation - Research

**Researched:** 2026-02-08
**Domain:** Pre-merge review UX + static documentation site generation
**Confidence:** HIGH

## Summary

Phase 24 has two distinct deliverables: (1) a pre-merge review checklist that surfaces inside the FinishFlowDialog when users finish a Gitflow feature, release, or hotfix, with configurable checklist items persisted via the existing Tauri plugin-store, and (2) a documentation website deployed to GitHub Pages via VitePress with the official Catppuccin theme, containing getting-started, feature overview, and keyboard shortcuts pages.

The review checklist is a pure frontend feature that extends the existing `FinishFlowDialog` component. No Rust backend changes are needed -- checklist items are stored in the same `flowforge-settings.json` Tauri store that already handles settings, branch metadata, and navigation state. The checklist should show between the description and the submit button in the existing dialog, with per-flow-type default items and user-configurable overrides.

The documentation website is best served by VitePress because: (a) there is an official `@catppuccin/vitepress` theme that matches the app's Catppuccin Mocha aesthetic, (b) VitePress has first-class GitHub Pages deployment support with an official GitHub Actions workflow, (c) it is lightweight and fast with zero runtime JS by default, and (d) the docs live in a `docs/` subdirectory alongside the existing codebase with no monorepo complexity.

**Primary recommendation:** Extend FinishFlowDialog with a checklist step, persist items via the existing Tauri store, and scaffold a VitePress docs site in `docs/` with `@catppuccin/vitepress` theme deployed via GitHub Actions.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| VitePress | ^1.6.4 | Static documentation site generator | Official GitHub Pages workflow, Markdown-first, fast builds, widely adopted |
| @catppuccin/vitepress | ^0.1.2 | Catppuccin Mocha theme for VitePress | Official Catppuccin port, matches app aesthetic exactly, includes syntax highlighting |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-store | ^2 (already installed) | Persist checklist configuration | Store user-defined checklist items per flow type |
| zustand | ^5 (already installed) | State management for checklist | Manage checklist state in the FinishFlowDialog |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| VitePress | Astro Starlight | Better component model, but no official Catppuccin theme; adds Astro as a new framework dependency |
| VitePress | Docusaurus | More features (versioning, i18n), but heavier (React SSR), no Catppuccin theme, overkill for 3-5 pages |
| Tauri store for checklist | Git config (`.gitconfig`) | Portable across machines, but requires Rust backend changes and is harder to manage arrays of items |

**Installation:**
```bash
# VitePress + Catppuccin theme (devDependencies for docs only)
npm install -D vitepress @catppuccin/vitepress
```

No new runtime dependencies needed for the checklist feature -- it uses existing Zustand and Tauri store.

## Architecture Patterns

### Recommended Project Structure

```
FlowForge/
├── docs/                              # VitePress documentation site (NEW)
│   ├── .vitepress/
│   │   ├── config.mts                 # VitePress config (nav, sidebar, theme)
│   │   └── theme/
│   │       └── index.ts               # Catppuccin theme import
│   ├── index.md                       # Landing page (hero)
│   ├── getting-started.md             # Installation + first repo
│   ├── features/
│   │   ├── index.md                   # Feature overview
│   │   ├── gitflow.md                 # Gitflow workflow guide
│   │   ├── staging.md                 # Staging & commits
│   │   ├── branches.md                # Branch management
│   │   └── topology.md                # Topology graph
│   └── reference/
│       ├── keyboard-shortcuts.md      # Full shortcuts table
│       └── settings.md                # Settings reference
├── .github/
│   └── workflows/
│       ├── release.yml                # Existing release workflow
│       └── docs.yml                   # NEW: Deploy docs to GitHub Pages
├── src/
│   ├── stores/
│   │   └── reviewChecklist.ts         # NEW: Checklist items store
│   └── components/
│       └── gitflow/
│           ├── FinishFlowDialog.tsx    # MODIFIED: Add checklist step
│           └── ReviewChecklist.tsx     # NEW: Checklist UI component
└── package.json                       # Add docs:dev, docs:build scripts
```

### Pattern 1: Checklist State in FinishFlowDialog

**What:** Add a configurable checklist between the flow description and the submit button in the existing `FinishFlowDialog`. The dialog already handles feature, release, and hotfix flows via a `flowType` prop. The checklist items are stored per flow type and persisted to Tauri store.

**When to use:** Every time a user clicks "Finish Feature/Release/Hotfix" in the GitflowPanel.

**Example:**
```typescript
// src/stores/reviewChecklist.ts
// Follows existing pattern from stores/settings.ts and stores/branchMetadata.ts
import { create } from "zustand";
import { getStore } from "../lib/store";

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

type FlowType = "feature" | "release" | "hotfix";

const DEFAULT_CHECKLIST: Record<FlowType, Omit<ChecklistItem, "checked">[]> = {
  feature: [
    { id: "tests-pass", label: "All tests pass" },
    { id: "no-debug", label: "No debug/console.log statements" },
    { id: "code-reviewed", label: "Code has been self-reviewed" },
  ],
  release: [
    { id: "changelog-updated", label: "Changelog is up to date" },
    { id: "version-bumped", label: "Version number has been bumped" },
    { id: "tests-pass", label: "All tests pass" },
    { id: "docs-updated", label: "Documentation is current" },
  ],
  hotfix: [
    { id: "fix-verified", label: "Fix has been verified" },
    { id: "tests-pass", label: "Regression test added" },
    { id: "no-side-effects", label: "No unintended side effects" },
  ],
};

interface ReviewChecklistState {
  customItems: Record<FlowType, Omit<ChecklistItem, "checked">[]>;
  initChecklist: () => Promise<void>;
  getItems: (flowType: FlowType) => Omit<ChecklistItem, "checked">[];
  updateItems: (flowType: FlowType, items: Omit<ChecklistItem, "checked">[]) => Promise<void>;
}
```

### Pattern 2: VitePress Config with Catppuccin Theme

**What:** VitePress site configuration using the official Catppuccin theme, with Mocha as dark variant and Latte as light variant. The site uses `base: '/FlowForge/'` for GitHub Pages deployment under the org repository URL.

**When to use:** One-time scaffold, then content updates.

**Example:**
```typescript
// docs/.vitepress/config.mts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'FlowForge',
  description: 'A modern, opinionated Git client for Gitflow workflows',
  base: '/FlowForge/',

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'Features', link: '/features/' },
      { text: 'Reference', link: '/reference/keyboard-shortcuts' },
    ],
    sidebar: {
      '/features/': [
        {
          text: 'Features',
          items: [
            { text: 'Overview', link: '/features/' },
            { text: 'Gitflow', link: '/features/gitflow' },
            { text: 'Staging & Commits', link: '/features/staging' },
            { text: 'Branches', link: '/features/branches' },
            { text: 'Topology', link: '/features/topology' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Keyboard Shortcuts', link: '/reference/keyboard-shortcuts' },
            { text: 'Settings', link: '/reference/settings' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Atypical-Consulting/FlowForge' },
    ],
  },

  markdown: {
    theme: {
      light: 'catppuccin-latte',
      dark: 'catppuccin-mocha',
    },
  },
})
```

```typescript
// docs/.vitepress/theme/index.ts
import DefaultTheme from "vitepress/theme";
import "@catppuccin/vitepress/theme/mocha/mauve.css";

export default DefaultTheme;
```

### Pattern 3: GitHub Actions Docs Workflow

**What:** A separate GitHub Actions workflow that builds and deploys the VitePress site to GitHub Pages on pushes to `main`. Kept separate from the existing `release.yml` so docs deploy independently of app releases.

**When to use:** Automatically on every push to main that changes `docs/**`.

**Example:**
```yaml
# .github/workflows/docs.yml
name: Deploy Documentation

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - '.github/workflows/docs.yml'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run docs:build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

### Anti-Patterns to Avoid

- **Blocking merge on unchecked items:** The checklist is advisory guidance, not a gate. Users must always be able to proceed even with unchecked items. Making it mandatory would frustrate users and duplicate CI/CD functionality.
- **Storing checklist state per-branch:** Checklist checked/unchecked state is ephemeral (per dialog session), not persisted. Only the item definitions (labels) are stored. Do not track completion history.
- **Putting docs site in a separate repository:** Keeping docs in the same repo (`docs/` directory) ensures they stay in sync with the codebase and can reference screenshots from `screenshots/`.
- **Using Vue components in docs:** VitePress supports Vue components, but using them for this simple docs site adds complexity. Stick to pure Markdown with frontmatter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static docs site | Custom React SSG or raw HTML | VitePress | Handles routing, search, sidebar, responsive design, dark mode |
| Catppuccin theming for docs | Custom CSS variables | @catppuccin/vitepress | Pre-built theme matching all 4 flavors with syntax highlighting |
| GitHub Pages deployment | Custom deploy script | actions/deploy-pages@v4 | Official action handles artifact upload, caching, CNAME |
| Persistent settings | localStorage or custom JSON file | @tauri-apps/plugin-store | Already used throughout the app, handles disk I/O, JSON serialization |
| Checklist UI | Custom checkbox component library | Native HTML checkbox + Tailwind | Simple enough, matches existing form patterns in dialog components |

**Key insight:** The checklist is deliberately lightweight -- it's a pre-merge reminder, not a code review system. The docs site is deliberately simple -- 5-8 Markdown pages with a theme, not a knowledge base. Over-engineering either deliverable would violate the "out of scope" constraints (no full code review mode, no built-in editor).

## Common Pitfalls

### Pitfall 1: VitePress `base` Path Misconfiguration
**What goes wrong:** Assets and links 404 on GitHub Pages because the base path doesn't match the repository name.
**Why it happens:** GitHub Pages serves org repos at `https://org.github.io/repo-name/`, requiring `base: '/repo-name/'` in VitePress config.
**How to avoid:** Set `base: '/FlowForge/'` in `docs/.vitepress/config.mts`. Verify with `npm run docs:preview` before deploying.
**Warning signs:** Broken CSS/images on the deployed site while everything works locally.

### Pitfall 2: FinishFlowDialog Becoming Too Complex
**What goes wrong:** The dialog grows too large with checklist, tag message, description, and error handling all in one component.
**Why it happens:** Adding features without extracting sub-components.
**How to avoid:** Extract the checklist into a standalone `ReviewChecklist` component that receives items as props and reports checked state up. Keep FinishFlowDialog as the orchestrator.
**Warning signs:** Component exceeds 200 lines, nested state management, hard to follow the submit flow.

### Pitfall 3: Checklist Items Not Persisted Properly
**What goes wrong:** User adds custom checklist items but they disappear after app restart.
**Why it happens:** Forgetting to call `store.save()` after `store.set()`, or not initializing the store on app startup.
**How to avoid:** Follow the exact pattern from `branchMetadata.ts` -- `await store.set(key, data); await store.save();` and add `initChecklist()` to the app startup sequence.
**Warning signs:** Items work during session but reset on restart.

### Pitfall 4: GitHub Pages Source Conflict
**What goes wrong:** GitHub Pages deployment fails because the repository is already configured to deploy from a branch instead of GitHub Actions.
**Why it happens:** The repository may have Pages configured to deploy from `gh-pages` branch or `docs/` folder on main.
**How to avoid:** In repository settings, change Pages source to "GitHub Actions" before deploying the workflow. The existing `release.yml` does not conflict because it uses a different workflow.
**Warning signs:** Workflow runs but site shows old content or 404.

### Pitfall 5: Checklist Blocks Submit
**What goes wrong:** Users can't finish a Gitflow flow because all checklist items must be checked.
**Why it happens:** Treating checklist as a hard gate instead of advisory.
**How to avoid:** Never disable the "Finish" button based on checklist state. The items are reminders, not requirements. Optionally show a warning if items are unchecked, but always allow proceeding.
**Warning signs:** Users report being unable to finish features/releases.

## Code Examples

Verified patterns from the existing codebase:

### Extending the FinishFlowDialog

The current `FinishFlowDialog` (at `src/components/gitflow/FinishFlowDialog.tsx`) has this structure:
1. Description of the merge operation
2. Optional tag message input (release/hotfix)
3. Error display
4. Cancel / Finish buttons

The checklist inserts between step 1 and step 2:

```typescript
// In FinishFlowDialog.tsx, add checklist between description and tag message
<form onSubmit={handleSubmit} className="space-y-4">
  <p className="text-sm text-ctp-overlay1">{getDescription()}</p>

  {/* NEW: Review checklist */}
  <ReviewChecklist flowType={flowType} />

  {needsTagMessage && (
    <div>
      {/* existing tag message input */}
    </div>
  )}
  {/* ...rest of form */}
</form>
```

### ReviewChecklist Component Pattern

Following the existing dialog component style (checkbox usage from InitGitflowDialog):

```typescript
// src/components/gitflow/ReviewChecklist.tsx
import { useState, useEffect } from "react";
import { ClipboardCheck } from "lucide-react";
import { useReviewChecklistStore } from "../../stores/reviewChecklist";

interface ReviewChecklistProps {
  flowType: "feature" | "release" | "hotfix";
}

export function ReviewChecklist({ flowType }: ReviewChecklistProps) {
  const { getItems } = useReviewChecklistStore();
  const items = getItems(flowType);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggleItem = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-ctp-overlay0 uppercase tracking-wider">
        <ClipboardCheck className="w-3.5 h-3.5" />
        <span>Review checklist</span>
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <label
            key={item.id}
            className="flex items-center gap-2 text-sm text-ctp-overlay1 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={checked[item.id] ?? false}
              onChange={() => toggleItem(item.id)}
              className="rounded border-ctp-surface2 bg-ctp-surface0 text-ctp-blue focus:ring-ctp-blue"
            />
            {item.label}
          </label>
        ))}
      </div>
    </div>
  );
}
```

### Tauri Store Pattern for Checklist Persistence

Following the established pattern from `branchMetadata.ts`:

```typescript
// src/stores/reviewChecklist.ts
import { create } from "zustand";
import { getStore } from "../lib/store";

const STORE_KEY = "review-checklist-items";

// ... (interface definitions from Architecture Pattern 1)

export const useReviewChecklistStore = create<ReviewChecklistState>(
  (set, get) => ({
    customItems: { feature: [], release: [], hotfix: [] },

    initChecklist: async () => {
      try {
        const store = await getStore();
        const saved = await store.get<Record<FlowType, Omit<ChecklistItem, "checked">[]>>(STORE_KEY);
        if (saved) {
          set({ customItems: saved });
        }
      } catch (e) {
        console.error("Failed to load checklist items:", e);
      }
    },

    getItems: (flowType) => {
      const custom = get().customItems[flowType];
      return custom.length > 0 ? custom : DEFAULT_CHECKLIST[flowType];
    },

    updateItems: async (flowType, items) => {
      const updated = { ...get().customItems, [flowType]: items };
      try {
        const store = await getStore();
        await store.set(STORE_KEY, updated);
        await store.save();
      } catch (e) {
        console.error("Failed to persist checklist items:", e);
      }
      set({ customItems: updated });
    },
  }),
);
```

### VitePress Keyboard Shortcuts Page

The keyboard shortcuts are already documented inline in `src/hooks/useKeyboardShortcuts.ts`. The docs page extracts these into a reference table:

```markdown
<!-- docs/reference/keyboard-shortcuts.md -->
# Keyboard Shortcuts

## General

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + O` | Open repository |
| `Cmd/Ctrl + ,` | Open settings |
| `Cmd/Ctrl + Shift + P` | Command palette |
| `Escape` | Close current blade / pop stack |
| `Backspace` | Navigate back |

## Git Operations

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Shift + A` | Stage all files |
| `Cmd/Ctrl + Shift + U` | Push to remote |
| `Cmd/Ctrl + Shift + L` | Pull from remote |
| `Cmd/Ctrl + Shift + F` | Fetch from remote |
| `Cmd/Ctrl + Shift + M` | Toggle amend commit |

## Topology

| Shortcut | Action |
|----------|--------|
| `Enter` | Open details for selected commit |
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GitHub Pages via `gh-pages` branch | GitHub Actions `deploy-pages@v4` | 2023 | No orphan branch needed, better caching, official support |
| VitePress v0.x (alpha) | VitePress v1.x (stable) | 2024-03 | Stable API, built-in search, production-ready |
| Custom Catppuccin CSS | @catppuccin/vitepress package | 2024 | Drop-in theme with all 4 flavors, maintained by Catppuccin org |
| Manual checklist (mental) | In-app advisory checklist | Phase 24 (now) | Reduces missed review steps without blocking workflow |

**Deprecated/outdated:**
- `actions/upload-artifact@v2` -- use v3, which is required by `deploy-pages@v4`
- VitePress `defineConfig` from `vitepress/config` -- use import from `'vitepress'` directly
- `peaceiris/actions-gh-pages` -- replaced by official `actions/deploy-pages`

## Codebase Integration Points

### Files to Modify

1. **`src/components/gitflow/FinishFlowDialog.tsx`** -- Add `<ReviewChecklist>` component between description and tag message sections
2. **`src/stores/settings.ts`** -- Optionally extend settings to include a "Review" category for checklist item management (or keep in separate store)
3. **`src/main.tsx`** or app initialization -- Call `initChecklist()` during app startup
4. **`package.json`** -- Add `docs:dev`, `docs:build`, `docs:preview` scripts; add VitePress and Catppuccin theme as devDependencies

### Files to Create

1. **`src/stores/reviewChecklist.ts`** -- New Zustand store for checklist item definitions
2. **`src/components/gitflow/ReviewChecklist.tsx`** -- Checklist display component
3. **`docs/.vitepress/config.mts`** -- VitePress configuration
4. **`docs/.vitepress/theme/index.ts`** -- Catppuccin theme setup
5. **`docs/index.md`** -- Landing page
6. **`docs/getting-started.md`** -- Installation and first steps
7. **`docs/features/index.md`** -- Feature overview
8. **`docs/features/gitflow.md`** -- Gitflow workflow guide
9. **`docs/reference/keyboard-shortcuts.md`** -- Keyboard shortcuts reference
10. **`.github/workflows/docs.yml`** -- GitHub Actions deployment workflow

### Settings Integration for Checklist Configuration

The requirement says checklist items should be "configurable." Two approaches:

**Option A (Recommended): Settings Blade Tab** -- Add a "Review" tab to the existing SettingsBlade that lets users edit checklist items per flow type. This follows the existing settings pattern (GeneralSettings, GitSettings, AppearanceSettings, IntegrationsSettings).

**Option B: Inline editing in FinishFlowDialog** -- Add an edit button in the dialog itself. Simpler but less discoverable and clutters the merge flow.

## Open Questions

1. **Checklist configurability scope**
   - What we know: Items should be "configurable" per the requirement
   - What's unclear: Should users be able to add/remove/reorder items, or just toggle defaults on/off?
   - Recommendation: Start with full CRUD (add/remove/edit labels) in a Settings tab. Users who want simple checklists just use defaults; power users can customize. Follow the pattern from `branchMetadata.ts` for persistence.

2. **GitHub Pages CNAME / custom domain**
   - What we know: The repo is at `Atypical-Consulting/FlowForge`, so Pages URL will be `https://atypical-consulting.github.io/FlowForge/`
   - What's unclear: Whether the org has a custom domain configured for GitHub Pages
   - Recommendation: Use the default `base: '/FlowForge/'` path. If a custom domain exists, adjust `base` to `'/'` and add a CNAME file.

3. **Docs content scope**
   - What we know: Getting-started guide, feature overview, keyboard shortcuts reference are required
   - What's unclear: How deep each page should go (quick overview vs. comprehensive tutorial)
   - Recommendation: Keep pages concise (300-500 words each). Link to screenshots from the `screenshots/` directory. The docs are for discovery, not a comprehensive manual.

## Sources

### Primary (HIGH confidence)
- Codebase analysis -- `src/stores/settings.ts`, `src/stores/branchMetadata.ts`, `src/components/gitflow/FinishFlowDialog.tsx` (existing patterns for store, dialogs, settings)
- Codebase analysis -- `src/hooks/useKeyboardShortcuts.ts` (authoritative list of keyboard shortcuts)
- Codebase analysis -- `src/stores/bladeTypes.ts`, `src/lib/bladeRegistry.ts` (blade system architecture)
- [VitePress official docs](https://vitepress.dev/) -- deployment, configuration, theming
- [Context7 /vuejs/vitepress](https://context7.com/vuejs/vitepress) -- GitHub Pages workflow, sidebar config, theme config

### Secondary (MEDIUM confidence)
- [@catppuccin/vitepress on npm](https://www.npmjs.com/package/@catppuccin/vitepress) -- v0.1.2, installation instructions
- [Catppuccin VitePress usage docs](https://vitepress.catppuccin.com/install.html) -- theme/flavor/accent configuration
- [GitHub catppuccin/vitepress](https://github.com/catppuccin/vitepress) -- README, last updated 2026-02-07

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- VitePress is the clear choice due to Catppuccin theme availability; Tauri store pattern is established in codebase
- Architecture: HIGH -- Both features follow existing patterns exactly (store persistence, dialog components, GitHub Actions)
- Pitfalls: HIGH -- Based on direct codebase analysis and official documentation
- Code examples: HIGH -- All examples based on verified existing codebase patterns

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable ecosystem, no fast-moving dependencies)
