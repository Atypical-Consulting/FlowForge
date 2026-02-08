# Feature Landscape

**Domain:** Desktop Git client frontend architecture improvements (v1.4.0 milestone)
**Researched:** 2026-02-08
**Confidence:** HIGH (based on codebase analysis, XState v5 docs, GitHub API docs, competitor analysis)

---

## Executive Summary

This milestone introduces four connected architectural improvements to FlowForge: an XState v5 navigation finite state machine replacing the imperative Zustand blade store, blade-centric file organization grouping each feature into self-contained modules, an Init Repo blade with GitHub .gitignore template search, and a dedicated Conventional Commit blade promoting the cramped sidebar form to a full workspace. Additionally, tech debt cleanup (store consolidation, duplicate code removal) and test infrastructure (Vitest) provide the foundation for sustainable development.

Research confirms XState v5's `setup()` + `createMachine()` pattern is production-ready for navigation FSMs with guards, the GitHub gitignore API provides 163 templates accessible without authentication, and the existing conventional commit components are well-factored for extraction into a standalone blade. The blade-centric file structure follows the established "feature-based architecture" pattern now standard in the React ecosystem.

---

## Table Stakes

Features users expect for this milestone. Missing means the architectural upgrade feels incomplete.

### 1. XState Navigation FSM

The current `useBladeStore` (Zustand) manages navigation imperatively with `pushBlade`, `popBlade`, `popToIndex`, `replaceBlade`, and `resetStack`. This works but lacks transition guards, state validation, and predictable state modeling. An XState FSM formalizes these operations as events with guarded transitions.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Push/pop/replace/reset as machine events | Formalizes existing imperative operations into predictable, guarded transitions | Med | `xstate` v5, `@xstate/react` | Events: `PUSH`, `POP`, `POP_TO_INDEX`, `REPLACE`, `RESET` |
| Blade stack in machine context | Current `bladeStack: TypedBlade[]` moves to XState context with `assign()` actions | Med | XState `assign` action | Stack manipulation logic moves from Zustand setter to XState actions |
| Navigation guards | Prevent destructive navigation (pop/reset) when forms have unsaved state | Med | XState guards, dirty-state detection | Guards: `canNavigateAway` checks conventional commit store, init form state |
| Process switching (staging/topology) | Currently `setProcess()` resets stack; FSM models as top-level state or parameterized event | Low | XState states or context | `SET_PROCESS` event transitions and resets stack atomically |
| Singleton blade enforcement | `SINGLETON_TYPES` array prevents duplicate settings/changelog blades | Low | XState guards | Guard: `bladeNotAlreadyOpen` on `PUSH` transitions |
| Stack depth limit | Prevent unbounded stack growth from power users drilling deep | Low | XState guards | Guard: `stackNotFull` with max depth (e.g., 20) |
| Back navigation via blade strips | `BladeStrip` components allow clicking collapsed blades; maps to `POP_TO_INDEX` event | Low | Existing `BladeStrip` component | No visual change; behavior wired to machine events |
| `createActorContext` for global access | Navigation machine must be accessible from hooks, command palette, and non-React contexts | Med | `@xstate/react` `createActorContext` | Replaces `useBladeStore.getState()` pattern in `bladeOpener.ts` |

**Confidence:** HIGH. XState v5 `setup()` function provides full TypeScript type safety for context, events, guards, and actions. The `createActorContext` pattern from `@xstate/react` provides the same global access as Zustand's `getState()`. Guards are synchronous pure functions, matching the validation needs.

### 2. Blade-Centric File Structure

The current codebase organizes by technical type: `components/blades/`, `components/staging/`, `stores/`, `hooks/`, `lib/`. Each blade's files are scattered across 3-4 directories. A blade-centric (feature-based) structure co-locates all files for a single blade type.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Feature module per blade type | Each blade gets own directory: component, registration, types, hooks, tests | Med | File moves only (no runtime changes) | e.g., `features/staging-changes/` contains component + registration + tests |
| Barrel exports | Each module exports via `index.ts` | Low | None | Clean import paths: `from '@/features/staging-changes'` |
| Auto-discovery preservation | Current `import.meta.glob` in `registrations/index.ts` must adapt to new paths | Med | Vite glob imports | Pattern: `import.meta.glob('../../features/*/registration.ts', { eager: true })` |
| Shared blade infrastructure stays central | `BladeContainer`, `BladeRenderer`, `BladePanel`, `BladeStrip`, `BladeErrorBoundary` | Low | None | These are framework components, not feature modules |
| Gradual migration support | Old and new structures can coexist during transition | Low | None | Move blade by blade; auto-discovery handles both locations |

**Confidence:** HIGH. Feature-based architecture is the consensus React pattern in 2025-2026. Vite's `import.meta.glob` supports multiple glob patterns, enabling gradual migration.

### 3. Init Repo Blade with .gitignore Template Search

The current `GitInitBanner` is a small inline prompt (~110 lines) embedded in `WelcomeView`. It offers only branch name selection (main vs default). A dedicated blade provides space for template search, preview, and multi-select.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Dedicated init-repo blade type | Full-width workspace for repo initialization options | Med | New `BladePropsMap` entry: `"init-repo": { path: string }` | Replaces inline `GitInitBanner` |
| .gitignore template search/filter | 163 GitHub templates need fuzzy search for usability | Med | GitHub REST API `GET /gitignore/templates`, existing `fuzzySearch.ts` | Reuse existing fuzzy search utility |
| Template preview panel | Show .gitignore contents before applying | Low | GitHub REST API `GET /gitignore/templates/{name}` | Fetch on selection, monospace preview |
| Multi-template composition | Real projects need multiple templates (e.g., Node + macOS + JetBrains) | Med | Local merge/dedup logic | Concatenate selected templates, deduplicate comment headers and rules |
| Offline fallback | GitHub API may be unreachable; bundle common templates | Med | Embedded JSON or Rust-side fallback | Ship top ~15-20 templates (Node, Python, Rust, Go, Java, C#, VisualStudio, macOS, Linux, Windows, JetBrains) |
| Default branch name selection | Already exists in `GitInitBanner` | Low | Existing `git_init` Rust command | Port existing UI |
| README.md auto-generation | GitKraken generates README on init; expected baseline | Low | Rust-side file write after `git_init` | Optional checkbox: writes `# {folder-name}\n` |
| Initial commit option | Option to create first commit with generated files | Low | Existing `create_commit` command | Checkbox: "Create initial commit with .gitignore and README" |
| Template category grouping | 163 flat templates are hard to scan; group by type | Med | Category mapping (manual or from github/gitignore repo structure) | Categories: Languages, Frameworks, Editors/IDEs, OS, Infrastructure |

**Confidence:** HIGH. GitHub gitignore API is stable, unauthenticated, returns simple JSON. 163 templates confirmed via direct API call. GitKraken's init flow (path + .gitignore + license + README) validates the expected feature set.

**API Details (verified):**
- List all: `GET https://api.github.com/gitignore/templates` returns `string[]`
- Get one: `GET https://api.github.com/gitignore/templates/{name}` returns `{ name: string, source: string }`
- No authentication required for public access
- General GitHub API rate limits apply (60 req/hr unauthenticated, 5000 authenticated)

### 4. Dedicated Conventional Commit Blade

The current `ConventionalCommitForm` is embedded inside `CommitForm` at the bottom of the left sidebar, constrained to `max-h-[60vh]` with an overflow scroll. The dedicated blade provides full-width workspace matching the importance of structured commit messages.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Standalone CC blade type | Full-width workspace for conventional commit composition | Med | New `BladePropsMap` entry: `"conventional-commit": Record<string, never>` | Reads staged files from existing stores |
| Type selector with descriptions | Already exists as `TypeSelector` component | Low (reuse) | Existing `conventional.ts` store | Shared component, wider layout |
| Scope autocomplete from history | Already exists as `ScopeAutocomplete` component | Low (reuse) | Existing `conventional.ts` store | Shared component |
| Live validation with errors | Already exists as `ValidationErrors` component | Low (reuse) | Existing Rust `validate_conventional_commit` | Shared component |
| Character progress indicator | Already exists as `CharacterProgress` component | Low (reuse) | None | Shared component |
| Breaking change section | Already exists as `BreakingChangeSection` component | Low (reuse) | None | Shared component |
| Full-width message preview | Current preview is `max-h-32`; blade gets generous space | Low | None | Larger monospace preview, possible syntax coloring |
| Commit + Push workflow | After commit, offer inline "Push now" (currently toast-only) | Low | Existing push mutation | Add "Commit & Push" button |
| Post-commit navigation | Auto-navigate back to staging after successful commit | Low | XState `POP` event | Machine sends `POP` on commit success |
| Amend mode support | Currently only in simple form; CC blade should also support | Med | Existing `getLastCommitMessage` command | Parse last message to pre-fill type/scope/description fields |
| Sidebar mode preserved | Keep existing inline CC form as a quick-commit option | Low | No changes to existing `CommitForm` | Both modes coexist: sidebar for quick, blade for full |

**Confidence:** HIGH. All sub-components already exist and are well-factored. The blade registration pattern is proven (1 registration file + 1 component = new blade). The `useConventionalCommit` hook encapsulates all state logic and is reusable.

### 5. Tech Debt Cleanup

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Zustand store consolidation | 21 stores is excessive; merge related stores | Med | All consumers | Candidates: `branches` + `branchMetadata`, `blades` + (subsumed by XState), `clone` into `repository` |
| Remove duplicate blade opener | `useBladeNavigation.ts` and `lib/bladeOpener.ts` share 90% logic | Low | All consumers | Single source in lib; hook wraps it |
| Consistent error handling | Mix of `getErrorMessage()`, raw catches, console.error, toast | Med | All async store actions | Standardize: Result pattern + toast integration |
| Remove deprecated type aliases | `Blade` type alias marked `@deprecated` in `blades.ts` | Low | Search for usage | Clean removal |

**Confidence:** HIGH. Direct codebase inspection reveals the duplications and inconsistencies clearly.

### 6. Test Infrastructure

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Vitest setup | Zero test files exist; need testing framework | Med | `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` | Configure in `vitest.config.ts` |
| XState machine unit tests | Navigation FSM is highest-value test target (pure logic) | Med | `vitest`, direct `machine.transition()` calls | Test guards, stack ops, edge cases |
| Zustand store unit tests | Stores contain testable logic | Low | `vitest` | Test `buildCommitMessage`, blade stack operations |
| Component smoke tests | Basic render tests catch import/prop errors | Low | `@testing-library/react` | Each blade renders without crashing |

**Confidence:** HIGH. Vitest is the standard React + Vite testing tool. XState machines are inherently testable (pure functions, deterministic transitions).

---

## Differentiators

Features that set FlowForge apart. Not strictly expected but significantly enhance the experience.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| XState visual inspector (dev-only) | Stately Inspector shows live machine state in separate window; exceptional for debugging navigation transitions | Low | `@stately-ai/inspect` (dev dep) | Only in DEV mode; opt-in via settings or env var |
| Smart .gitignore recommendation | Auto-detect project type from existing files (package.json = Node, Cargo.toml = Rust) and pre-select templates | Med | File system scan via Tauri backend | Meaningful UX improvement over blind template search |
| CC blade scope tree visualization | Show commit scopes as frequency chart or tree from history | Med | Existing `getScopeSuggestions` command | Helps users pick meaningful scopes |
| Blade transition animation variants | Different enter/exit animations for push vs pop vs replace | Low | framer-motion variants, XState transition metadata | Currently all transitions use same animation |
| Navigation guard "dirty form" indicator | Visual badge on blade strip when a form has unsaved changes | Low | XState guard + blade strip UI | Warns users before they accidentally navigate away |
| Test coverage threshold in CI | Enforce minimum coverage for new code | Low | vitest coverage (istanbul) | Pragmatic: 60% threshold for feature modules |
| Commit message templates | Pre-defined CC templates for common patterns (e.g., "fix(ci): ..." for CI fixes) | Low | Local storage or repo config | Quick-start for repetitive commit types |

---

## Anti-Features

Features to explicitly NOT build in this milestone. These would add complexity without proportional value or conflict with architecture goals.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Replace all Zustand with XState | XState is ideal for navigation FSM (complex transitions, guards) but overkill for data stores (theme, toast, settings with simple get/set). Migrating 21 stores would be a rewrite with no UX benefit | Use XState ONLY for navigation; keep Zustand for data stores. They coexist cleanly -- XState handles flow, Zustand handles data |
| File-based routing (React Router v7 style) | FlowForge uses blade stack navigation, not URL-mapped pages. File-based routing solves a fundamentally different problem | Keep blade stack pattern; XState governs transitions, not URL routes |
| Custom .gitignore text editor in init blade | Full editor at init time adds complexity; users can edit .gitignore after repo creation in any editor | Template picker + preview is sufficient; post-init editing is the escape hatch |
| AI-powered commit message generation | Requires LLM integration, API keys, privacy concerns, latency. Orthogonal to architecture goals | Existing type/scope inference from staged files is the right level of automation |
| Blade tabs (multiple active blades side-by-side) | Fundamentally breaks the stack metaphor; requires complete layout rethinking | Stack with collapsible strips IS the established UX. Enhance, do not replace |
| E2E testing (Playwright for Tauri) | Tauri E2E testing ecosystem is immature. Setup complexity is high. Unit tests provide better ROI | Start with Vitest unit tests for machines and stores. E2E in future milestone |
| XState HMR for machine definitions | Machine configs are static; HMR creates ghost states and race conditions | Accept page reload on machine changes; component HMR still works |
| Navigation history (browser-style forward/back) | Requires maintaining a separate forward stack alongside the blade stack; complex edge cases | Simple push/pop/replace covers all current use cases. Add forward stack only if users request it |
| LICENSE file picker in init blade | Low-priority feature that adds scope to init blade | Defer to future enhancement; users can add LICENSE manually |

---

## Feature Dependencies

```
Test Infrastructure (Vitest setup)
  [no upstream deps -- do first]

XState Navigation FSM
  |- depends on: Vitest (for machine tests)
  |-> enables: Dedicated CC Blade (post-commit navigation)
  |-> enables: Init Repo Blade (blade lifecycle)
  |-> enables: Navigation Guards (dirty form protection)
  |-> enables: Tech debt - blade store removal (replaced by machine)

Blade-Centric File Structure
  |- depends on: nothing (pure reorganization)
  |-> enables: Co-located tests (tests live in feature dirs)
  |-> enables: Clean onboarding for new blade types

Init Repo Blade
  |- depends on: XState FSM (for blade push/pop)
  |- depends on: BladePropsMap extension (new "init-repo" type)
  |-> requires: GitHub gitignore API integration (frontend fetch or Rust HTTP)
  |-> requires: Offline fallback templates (bundled asset)

Dedicated CC Blade
  |- depends on: XState FSM (for post-commit navigation)
  |- depends on: BladePropsMap extension (new "conventional-commit" type)
  |- depends on: Existing CC components (TypeSelector, ScopeAutocomplete, etc.)
  |-> shares: conventional.ts store (unchanged)

Tech Debt Cleanup
  |- depends on: XState FSM complete (blade store removal)
  |-> Store consolidation (branches + branchMetadata, etc.)
  |-> Duplicate blade opener removal
  |-> Error handling standardization

Test Coverage
  |- depends on: Vitest setup
  |- depends on: XState FSM (primary test target)
  |-> XState machine tests
  |-> Store unit tests
  |-> Component smoke tests
```

---

## MVP Recommendation

### Phase 1: Foundation (do first, everything depends on it)

1. **Vitest setup** -- Zero test files exist. Configure vitest, jsdom, testing-library. Enables all subsequent testing.
2. **XState navigation FSM** -- Core architectural change. Replace `useBladeStore` with XState machine. All blade features depend on this.
3. **Duplicate blade opener consolidation** -- Quick win before FSM integration; reduces confusion.

### Phase 2: Feature Blades (builds on FSM)

4. **Init Repo blade** with .gitignore template search -- Replaces basic `GitInitBanner`. GitHub API integration with offline fallback. Multi-template composition with preview.
5. **Dedicated Conventional Commit blade** -- Promotes inline form to full blade. Reuses all existing CC components. Adds amend mode and Commit & Push.

### Phase 3: Structure and Polish (best after new blades exist)

6. **Blade-centric file structure migration** -- Move blade files into feature modules. New blades (init-repo, CC) start in correct structure; migrate existing ones gradually.
7. **Zustand store consolidation** -- Merge related stores. Remove blade store (replaced by XState).
8. **XState machine + store unit tests** -- Write tests for navigation FSM guards and transitions. Test conventional store logic.

### Defer to Future Milestones

- LICENSE picker: Add to init blade later
- Smart .gitignore recommendation: Nice differentiator, not blocking
- Navigation history (forward/back): High complexity, no user demand yet
- E2E testing: Wait for Tauri testing maturity
- Scope tree visualization: Polish feature for CC blade

---

## New BladeTypes Required

| BladeType | Props | Purpose | Priority |
|-----------|-------|---------|----------|
| `"init-repo"` | `{ path: string }` | Full init experience with .gitignore templates | P0 |
| `"conventional-commit"` | `Record<string, never>` | Dedicated CC workspace blade | P0 |

**Note:** Both new types require entries in `BladePropsMap` (in `bladeTypes.ts`), a registration file, and a component. The existing blade registry auto-discovery pattern handles the rest.

---

## New Dependencies Required

| Package | Purpose | Size Impact | Priority |
|---------|---------|-------------|----------|
| `xstate` | Navigation FSM | ~45KB (tree-shakeable) | P0 |
| `@xstate/react` | React hooks for XState | ~5KB | P0 |
| `vitest` | Unit testing framework | Dev dep | P0 |
| `@testing-library/react` | Component testing | Dev dep | P0 |
| `@testing-library/jest-dom` | DOM matchers | Dev dep | P0 |
| `jsdom` | DOM environment for tests | Dev dep | P0 |
| `@stately-ai/inspect` | XState visual debugger (dev-only) | Dev dep | P2 (differentiator) |

**Not needed:**
| Package | Why Not |
|---------|---------|
| `@xstate/store` | Full XState machine is needed for guards/transitions; `@xstate/store` is for simpler cases |
| `react-router` v7 upgrade | Blade navigation does not use URL routing |

---

## Quality Gate Verification

- [x] Categories clear (table stakes vs differentiators vs anti-features)
- [x] Complexity noted for each feature with Low/Med/High
- [x] Dependencies on existing features identified with arrows
- [x] New BladeTypes enumerated with props
- [x] NPM dependencies identified with size impact
- [x] Feature dependency graph documented
- [x] MVP phasing recommendation with rationale
- [x] Anti-features explicitly called out with alternatives

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| XState v5 navigation FSM | HIGH | Official docs verified: `setup()`, guards, `createActorContext`, `@xstate/react` hooks |
| GitHub gitignore API | HIGH | Direct API call confirmed 163 templates; endpoints, response format, auth verified |
| Blade-centric file structure | HIGH | Industry consensus on feature-based React architecture; Vite glob supports it |
| Conventional Commit blade | HIGH | All sub-components inspected; well-factored, reusable, proven pattern |
| Tech debt scope | HIGH | Direct codebase inspection of 21 stores, duplicate code, inconsistent patterns |
| XState + Zustand coexistence | MEDIUM | Multiple community examples but no official "best practice" doc; pattern is straightforward |
| Offline gitignore fallback | MEDIUM | Bundling approach is standard but exact template selection and format needs validation |
| Test infrastructure (Vitest) | HIGH | Standard tool for Vite + React; well-documented setup |

---

## Sources

### Official Documentation (HIGH confidence)
- [XState v5 Documentation](https://stately.ai/docs/xstate)
- [@xstate/react Hooks](https://stately.ai/docs/xstate-react) -- `useActor`, `useMachine`, `useSelector`, `useActorRef`, `createActorContext`
- [XState Guards](https://stately.ai/docs/guards) -- Guard syntax, composition with `and`/`or`/`not`
- [XState State Machines](https://stately.ai/docs/machines) -- `createMachine`, `setup()`, context, transitions
- [XState TypeScript](https://stately.ai/docs/typescript) -- Type-safe setup, requires TS 5.0+
- [XState Setup Function](https://stately.ai/docs/setup) -- Recommended approach for typed machines
- [GitHub REST API: Gitignore](https://docs.github.com/en/rest/gitignore/gitignore) -- List templates, get template content
- [github/gitignore Repository](https://github.com/github/gitignore) -- 163 templates, root/Global/Community structure
- [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) -- Specification

### Verified Sources (MEDIUM confidence)
- [GitKraken Init Documentation](https://help.gitkraken.com/gitkraken-desktop/open-clone-init/) -- Init flow: path + .gitignore + license + README
- [Global State with XState and React](https://stately.ai/blog/2024-02-12-xstate-react-global-state) -- Global actor patterns
- [Improve React Navigation with XState v5](https://dev.to/gtodorov/improve-react-navigation-with-xstate-v5-2l15) -- Navigation FSM patterns
- [Scalable React Projects with Feature-Based Architecture](https://dev.to/naserrasouli/scalable-react-projects-with-feature-based-architecture-117c) -- Feature module structure
- [React Folder Structure in 5 Steps 2025](https://www.robinwieruch.de/react-folder-structure/) -- Feature-first organization

### Codebase Analysis (HIGH confidence)
- FlowForge `src/stores/blades.ts` -- Current navigation: 97 lines, `pushBlade`/`popBlade`/`replaceBlade`/`resetStack`
- FlowForge `src/stores/bladeTypes.ts` -- `BladePropsMap` with 13 types, `TypedBlade` discriminated union
- FlowForge `src/hooks/useBladeNavigation.ts` -- Singleton guards, title resolution, 83 lines
- FlowForge `src/lib/bladeOpener.ts` -- Non-React blade opener, duplicates hook logic, 32 lines
- FlowForge `src/lib/bladeRegistry.ts` -- Registration pattern: `registerBlade()`, `getBladeRegistration()`, Map-based
- FlowForge `src/components/blades/registrations/index.ts` -- `import.meta.glob` auto-discovery, HMR support
- FlowForge `src/stores/conventional.ts` -- CC store: 11 types, suggestions, validation, message building
- FlowForge `src/hooks/useConventionalCommit.ts` -- Debounced validation, filtered scopes, canCommit flag
- FlowForge `src/components/commit/ConventionalCommitForm.tsx` -- 202 lines, TypeSelector + ScopeAutocomplete + validation
- FlowForge `src/components/welcome/GitInitBanner.tsx` -- 111 lines, basic init with branch name option only
- FlowForge `src-tauri/src/git/init.rs` -- `git_init` command: path validation, git2 init with branch name
- FlowForge `package.json` -- v1.3.0, React 19, Zustand 5, Tailwind 4, Vite 7, no XState or test deps
