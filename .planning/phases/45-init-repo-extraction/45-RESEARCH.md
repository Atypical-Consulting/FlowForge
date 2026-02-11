# Phase 45: Init Repo Extraction - Research Synthesis

**Researched:** 2026-02-11
**Method:** 3-agent parallel research (UX, Architecture, Expert Dev)
**Confidence:** HIGH across all domains

---

## Executive Summary

Phase 45 extracts the Init Repo blade from core (`src/blades/init-repo/`) into a toggleable built-in extension (`src/extensions/init-repo/`). This extraction is **unique** among all FlowForge extractions because Init Repo must activate **before any repository is open** (WelcomeView context). The key architectural insight is that `registerBuiltIn()` already activates immediately at app mount and `deactivateAll()` skips built-in extensions, so no special timing work is needed.

**Key findings:**
1. WelcomeView already uses BladeRegistry lookup for init-repo (INFRA-05) -- consumer code needs minimal changes
2. All Init Repo components are self-contained with ZERO external consumers -- clean extraction
3. Import paths don't change because `src/extensions/` and `src/blades/` are at the same depth relative to `src/`
4. The store has zero cross-store dependencies -- safe to move entirely to extension directory
5. A fallback "Run git init" button provides basic functionality when extension is disabled

---

## 1. Architecture Overview

### Current State
- 10 files under `src/blades/init-repo/` (~1,213 lines)
- Core blade registration via `_discovery.ts` eager import
- Store uses `createBladeStore("init-repo", ...)` with zero cross-store dependencies
- WelcomeView already uses BladeRegistry lookup (not direct import)

### Target State
- Extension at `src/extensions/init-repo/` with `onActivate`/`onDeactivate`
- Blade registered via `api.registerBlade()` with `coreOverride: true`
- Command registered in palette under "Repository" category
- WelcomeView shows fallback when extension disabled
- Old `src/blades/init-repo/` directory fully removed

### Dual-Context Activation (Unique to Init Repo)
- Must work in WelcomeView (before repo open) AND blade navigation (after repo open)
- `registerBuiltIn()` activates immediately during App.tsx mount useEffect
- `deactivateAll()` explicitly skips built-in extensions (`!ext.builtIn`)
- Result: blade is registered before WelcomeView renders, persists across repo open/close

---

## 2. File Change Manifest

### CREATE (2 files)
| File | Purpose |
|------|---------|
| `src/extensions/init-repo/index.ts` | Extension entry point (~45 lines) |
| `src/extensions/init-repo/components/index.ts` | Barrel export |

### MOVE (8 files)
| From | To |
|------|----|
| `src/blades/init-repo/store.ts` | `src/extensions/init-repo/store.ts` |
| `src/blades/init-repo/InitRepoBlade.tsx` | `src/extensions/init-repo/components/InitRepoBlade.tsx` |
| `src/blades/init-repo/components/InitRepoForm.tsx` | `src/extensions/init-repo/components/InitRepoForm.tsx` |
| `src/blades/init-repo/components/InitRepoPreview.tsx` | `src/extensions/init-repo/components/InitRepoPreview.tsx` |
| `src/blades/init-repo/components/TemplatePicker.tsx` | `src/extensions/init-repo/components/TemplatePicker.tsx` |
| `src/blades/init-repo/components/TemplateChips.tsx` | `src/extensions/init-repo/components/TemplateChips.tsx` |
| `src/blades/init-repo/components/CategoryFilter.tsx` | `src/extensions/init-repo/components/CategoryFilter.tsx` |
| `src/blades/init-repo/components/ProjectDetectionBanner.tsx` | `src/extensions/init-repo/components/ProjectDetectionBanner.tsx` |

### MODIFY (3 files)
| File | Changes |
|------|---------|
| `src/App.tsx` | Add `registerBuiltIn` call for "init-repo" extension |
| `src/blades/_discovery.ts` | Remove `"init-repo"` from EXPECTED_TYPES |
| `src/components/WelcomeView.tsx` | Add fallback UI when extension disabled |

### DELETE (entire old directory)
- `src/blades/init-repo/registration.ts`
- `src/blades/init-repo/index.ts`
- All moved files (old copies)
- `src/blades/init-repo/` directory itself

### UNCHANGED
- `src/stores/bladeTypes.ts` -- "init-repo" entry preserved by coreOverride
- `src/hooks/useGitignoreTemplates.ts` -- shared hook
- `src/lib/gitignoreComposer.ts`, `src/lib/gitignoreCategories.ts` -- shared libs
- `src/components/welcome/GitInitBanner.tsx` -- core welcome component

---

## 3. Import Path Analysis

**No import path changes needed.** Both `src/blades/init-repo/` and `src/extensions/init-repo/` are at the same depth relative to `src/`, so all `../../` and `../../../` imports remain identical after the move.

Only change: `InitRepoBlade.tsx` moves into `components/` subdirectory, so its imports of sibling components change from `./components/X` to `./X`, and its store import changes from `./store` to `../store`.

---

## 4. Extension Entry Point Design

```typescript
// src/extensions/init-repo/index.ts
import { lazy } from "react";
import { FolderGit2 } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const InitRepoBlade = lazy(() =>
    import("./components/InitRepoBlade").then((m) => ({ default: m.InitRepoBlade }))
  );

  api.registerBlade({
    type: "init-repo",
    title: "Initialize Repository",
    component: InitRepoBlade,
    singleton: true,
    lazy: true,
    coreOverride: true,
  });

  api.registerCommand({
    id: "init-repository",
    title: "Initialize Repository",
    description: "Set up a new Git repository with .gitignore, README, and initial commit",
    category: "Repository",
    icon: FolderGit2,
    keywords: ["init", "initialize", "new", "repository", "git", "create"],
    action: async () => { /* directory picker + navigate to blade */ },
  });

  // Reset store on dispose
  const { useInitRepoStore } = await import("./store");
  api.onDispose(() => useInitRepoStore.getState().reset());
}

export function onDeactivate(): void {}
```

---

## 5. WelcomeView Fallback Design (INIT-04)

### When Extension Enabled
- GitInitBanner shows "Set Up Repository" -> renders full Init Repo blade via BladeRegistry

### When Extension Disabled
- GitInitFallbackBanner shows "Run git init" -> calls `commands.gitInit(path, "main")` directly
- Info text: "Enable the Init Repo extension for .gitignore templates, README setup, and more"
- Same visual styling as GitInitBanner (bg-ctp-surface0/50, framer-motion fadeInUp)

### Mid-Session Disable Recovery
- If user disables while Init Repo blade is active, reset `showInitRepo` to false
- Show toast: "Init Repo extension was disabled"
- Pending init path preserved so fallback banner appears

---

## 6. Tauri Commands Used

| Command | Purpose | Available Pre-Repo |
|---------|---------|-------------------|
| `commands.gitInit(path, branch)` | Create .git directory | Yes |
| `commands.writeInitFiles(path, files[])` | Write .gitignore, README | Yes |
| `commands.stageAll()` | Stage for initial commit | After init |
| `commands.createCommit(msg, amend)` | Initial commit | After init |
| `commands.getGitignoreTemplate(name)` | Fetch template content | Yes |
| `commands.isGitRepository(path)` | Check if .git exists | Yes |
| `commands.listGitignoreTemplates()` | List available templates | Yes |
| `commands.detectProjectType(path)` | Auto-detect project type | Yes |

All commands operate on filesystem paths, not the currently-open repo. No Rust changes needed.

---

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| WelcomeView stuck on "Preparing setup..." when ext disabled | HIGH | Reset `showInitRepo` when `initRepoRegistration` becomes undefined |
| `_discovery.ts` warning about missing "init-repo" registration | HIGH | Remove from EXPECTED_TYPES |
| Store stale state on re-enable | LOW | `api.onDispose(() => reset())` pattern |
| useEffect timing (blade not ready on first render) | LOW | Existing defensive fallback handles race condition |
| Import path errors after move | LOW | Same depth = no path changes; TypeScript catches errors |

---

## Detailed Research Files

- [UX-RESEARCH.md](./UX-RESEARCH.md) -- Fallback UX design, accessibility, graceful degradation
- [ARCH-RESEARCH.md](./ARCH-RESEARCH.md) -- Extension architecture, lifecycle, store migration ADR
- [DEV-RESEARCH.md](./DEV-RESEARCH.md) -- File inventory, Tauri commands, import analysis, code patterns

---

*Synthesized from 3 parallel research agents: 2026-02-11*
