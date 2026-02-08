# Project Research Summary

**Project:** FlowForge v1.4.0 - Frontend Architecture Improvements
**Domain:** Desktop Git client - navigation FSM, test infrastructure, API integration
**Researched:** 2026-02-08
**Confidence:** HIGH

## Executive Summary

FlowForge v1.4.0 introduces critical architectural improvements to an existing Tauri desktop Git client: replacing imperative blade navigation with an XState finite state machine, establishing a test infrastructure foundation with Vitest, and adding GitHub .gitignore API integration for the Init Repo blade. The codebase currently has 21 Zustand stores, 13 blade types, and zero tests across ~30K lines of code.

Research confirms that XState v5's `setup()` pattern is production-ready for navigation FSMs with TypeScript type safety, Vitest 4 with jsdom provides the right test infrastructure for a Vite-based project with complex DOM dependencies (Monaco, Three.js, framer-motion), and the GitHub gitignore API offers 163 templates accessible without authentication. The recommended approach isolates each architectural change into sequential phases: test infrastructure first, XState navigation second, new blades third, avoiding the "big bang" restructuring pitfall that would touch 100+ files simultaneously.

The highest-risk pitfall is XState absorbing Zustand responsibilities, creating a god machine that manages all state. The boundary must be enforced: XState owns navigation flow control (which blade/process is active, valid transitions), Zustand owns data (repo state, settings, UI state). Secondary risks include breaking the blade registry auto-discovery during file restructuring, Tauri IPC mock type drift in tests, and GitHub API rate limiting without proper caching.

## Key Findings

### Recommended Stack Additions

From STACK.md and v1.4.0-STACK.md:

**XState Navigation FSM:**
- `xstate` v5.26.0 + `@xstate/react` v6.0.0 - Finite state machine for navigation with TypeScript type safety
- ~52KB total (tree-shakeable)
- Replaces imperative `useBladeStore` (Zustand) for blade stack management
- Use `createActorContext` pattern for global access, `useSelector` for selective re-renders

**Test Infrastructure:**
- `vitest` v4.0.18 - Native Vite integration, API-compatible with Jest
- `jsdom` v28.0.0 - Complete DOM API coverage (required for Monaco, framer-motion, react-virtuoso, Three.js)
- `@testing-library/react` v16.3.2 + `@testing-library/jest-dom` v6.9.1 + `@testing-library/user-event` v14.6.1
- `@vitest/coverage-v8` v4.0.18 - V8-based code coverage
- Why jsdom over happy-dom: happy-dom is faster but has incomplete Web API coverage; FlowForge's dependencies (Monaco, Three.js, etc.) probe many DOM APIs

**Gitignore API Integration:**
- `reqwest` v0.12 (Rust crate) with `json` feature - Async HTTP client for GitHub API
- Approach: Rust Tauri command via `tauri-specta`, not `@tauri-apps/plugin-http`
- Rationale: Consistent with existing 50+ Tauri commands, avoids plugin registration overhead, desktop apps have no CORS restrictions

**Anti-recommendations:**
- Do NOT use `@xstate/store` - For simple key-value stores, not FSMs
- Do NOT use `@tauri-apps/plugin-http` - Overkill for 2 endpoints; Rust command approach is simpler
- Do NOT use `happy-dom` - Incomplete DOM APIs for FlowForge's complex dependencies
- Do NOT use `playwright` or `cypress` - E2e testing for Tauri requires special setup; defer to future milestone

### Expected Features

From FEATURES.md and v1.4.0-FEATURES.md:

**Must have (table stakes):**
- XState navigation FSM with push/pop/replace/reset events, blade stack in context, navigation guards (prevent invalid transitions), process switching (staging/topology), singleton blade enforcement, stack depth limit
- Blade-centric file structure with feature modules per blade type, barrel exports, auto-discovery preservation, shared infrastructure stays central, gradual migration support
- Init Repo blade with .gitignore template search/filter (163 GitHub templates), template preview panel, multi-template composition, offline fallback (bundle top 15-20 templates), default branch name selection, README auto-generation, initial commit option
- Dedicated Conventional Commit blade (full-width workspace) with type selector, scope autocomplete, live validation, character progress, breaking change section, full-width preview, commit & push workflow, post-commit navigation (auto-pop to staging)
- Test infrastructure with Vitest setup, XState machine unit tests, Zustand store unit tests, component smoke tests

**Should have (differentiators):**
- XState visual inspector (Stately Studio) in dev mode
- Smart .gitignore recommendation (auto-detect project type from existing files)
- CC blade scope tree visualization (frequency chart from history)
- Blade transition animation variants (different animations for push vs pop vs replace)
- Navigation guard "dirty form" indicator on blade strip
- Test coverage threshold in CI (60% for feature modules)

**Defer (v2+):**
- LICENSE picker in init blade
- AI-powered commit message generation
- Blade tabs (multiple active blades side-by-side)
- E2E testing with Playwright/Cypress for Tauri
- XState HMR for machine definitions
- Navigation history (browser-style forward/back)

**Anti-features (explicitly avoid):**
- Replacing ALL Zustand stores with XState - XState is for navigation FSM only; Zustand for simple UI state
- File-based routing (React Router v7 style) - FlowForge uses blade stack, not URL routing
- Custom .gitignore text editor in init blade - Template picker + preview is sufficient
- Snapshot testing - Brittle for UI; use behavior-based Testing Library tests

### Architecture Approach

From ARCHITECTURE.md and v1.4.0-ARCHITECTURE.md:

**Blade-Centric Module Structure:**
Move from layer-based (`components/`, `stores/`, `hooks/`) to feature-based (`blades/{blade-name}/`, `features/{feature-name}/`, `shared/`) organization. Each blade becomes a self-contained module with co-located component, registration, store, hooks, and tests. Shared infrastructure (UI primitives, blade system, global stores) stays in `shared/`.

**Import boundary rules:**
- `shared/` can import from `shared/` only
- `blades/X/` can import from `shared/`, `blades/X/` only (not other blades)
- `features/X/` can import from `shared/`, `features/X/` only (not other features)
- `app/` can import from anywhere
- Cross-feature communication through shared stores or events, never direct imports

**XState Navigation FSM:**
Machine states represent navigation contexts (`welcome`, `repository`). Events are explicit (`OPEN_REPO`, `PUSH_BLADE`, `POP_BLADE`, `SWITCH_PROCESS`). Guards prevent invalid transitions. Actions fire side effects. Context holds `bladeStack: TypedBlade[]`, `activeProcess: ProcessType`. Use `createActorContext` from `@xstate/react` for global access. Persist via Tauri plugin-store using `getPersistedSnapshot()`.

**XState + Zustand Coexistence:**
Clear ownership: XState owns navigation FSM (blade stack, process switching, transition guards). Zustand owns simple UI state (toasts, theme, dropdowns, command palette), persisted preferences, async server state (via React Query). No duplication between systems.

**Major components:**
1. XState Navigation Actor - Owns blade stack, process type, transition guards, singleton enforcement
2. Zustand UI Stores - Simple UI state with direct hook usage
3. Zustand Persistence Stores - Persisted preferences via Tauri Store plugin
4. React Query - Async server state (commit history, staging status, gitignore templates)
5. Tauri IPC Layer - Type-safe Rust command invocation via specta bindings
6. Blade Registry - Component resolution (maps BladeType to React component + metadata)

**Key patterns:**
- Singleton XState actor created at app startup
- XState guards for navigation rules (not ad-hoc conditionals)
- React Query for gitignore template cache with `staleTime: Infinity`
- Tauri mock factory for tests
- Co-located test files (Component.test.tsx next to Component.tsx)

### Critical Pitfalls

From PITFALLS.md, v1.4.0-PITFALLS.md, and PITFALLS-v2-frontend.md:

**1. Big Bang Restructuring**
Attempting file restructuring, store consolidation, and XState introduction simultaneously. Each touches 50-100+ files. Combined, they create an unreviewable diff that is impossible to debug.
- **Prevention:** Phase strictly: (1) Path aliases first, (2) Move files second, (3) Consolidate stores third, (4) Add XState last. Each step is independently deployable.

**2. XState Absorbing Zustand Responsibilities**
XState machine context starts holding repo state, staging state, toast state - becoming a god machine with all concerns.
- **Prevention:** Hard rule - XState manages ONLY which view/blade is active and valid transitions. Context should contain at most: `currentBlade`, `bladeStack`, `activeProcess`. No domain data.

**3. Breaking the Blade Registration System**
Moving files to blade-centric structure breaks `import.meta.glob` auto-discovery. The dev-mode exhaustiveness check only warns, doesn't throw.
- **Prevention:** Before moving files, refactor glob to `../../features/**/registration.ts` or use explicit imports. Add runtime assertion (hard error in dev) that registry has expected number of entries.

**4. Tauri IPC Mock Type Drift**
Hand-written mocks return stale/incorrect shapes when Rust command changes. TypeScript won't catch it because mock return types are often `any`.
- **Prevention:** Type mock factories against actual binding types: `vi.fn<typeof commands.getStagingStatus>()`. Use `satisfies` to ensure mock return values match expected types. Run `tsc --noEmit` in CI separately from tests.

**5. Testing Zustand Stores Without Isolation**
Zustand stores are module-level singletons. State persists across test cases without explicit reset.
- **Prevention:** Create `src/__mocks__/zustand.ts` that wraps `create` with auto-reset on `afterEach`. Mock `@tauri-apps/plugin-store` globally in `vitest.setup.ts`. Mock `../bindings` with typed mocks.

**6. GitHub API Rate Limiting**
Init Repo blade fetches template list on every open, hits 60/hour unauthenticated limit.
- **Prevention:** React Query with `staleTime: Infinity`. Prefetch template list on app startup. Bundle top 10-20 templates as fallback JSON. Show clear error message when rate limited.

**7. Circular Dependencies During Store Consolidation**
Merging stores creates circular imports. Currently `gitflow.ts` imports from `branches.ts` and `repository.ts` at module level.
- **Prevention:** Map full dependency graph BEFORE consolidating. Use Zustand slices pattern but keep slice creators in separate files that don't import each other. Cross-slice communication via `getState()` at call time, not import time.

**8. `useActor` Performance Trap**
Using `useActor` or `useMachine` in frequently-rendered components triggers re-render on every navigation state change.
- **Prevention:** Use `useSelector(navActor, specificSelector)` everywhere. Use `useActorRef` for components that only dispatch events. Reserve `useActor` for top-level components or debugging only.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Test Infrastructure Foundation
**Rationale:** Zero tests exist. Test infrastructure must come first to verify all subsequent architectural changes. XState machine testing is highest-value target (pure logic, deterministic).

**Delivers:** Vitest config with jsdom, setup file, Tauri mock factory, and 5-10 example tests covering utility function, Zustand store, React component, and XState machine.

**Technologies:** Vitest 4, jsdom, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, @vitest/coverage-v8

**Addresses:** Table stakes feature "test infrastructure". Avoids Pitfall #4 (mock type drift) by establishing typed mock patterns from day one. Avoids Pitfall #5 (store isolation) by creating auto-reset Zustand mock.

**Research flag:** Low - Vitest + React Testing Library patterns are well-documented.

### Phase 2: XState Navigation FSM
**Rationale:** Core architectural change. Replace imperative `useBladeStore` (Zustand) with XState machine. All blade features depend on this. Do it while file structure is familiar (before restructuring) to isolate issues.

**Delivers:** XState machine definition, `createActorContext` setup with persistence, migration of `BladeContainer`, `ProcessNavigation`, `useBladeNavigation`, `bladeOpener` to XState. Remove `useBladeStore` after compatibility shim verified.

**Technologies:** xstate 5.26.0, @xstate/react 6.0.0

**Addresses:** Table stakes feature "XState navigation FSM". Avoids Pitfall #1 (big bang) by keeping file structure stable during migration. Avoids Pitfall #2 (XState absorbing Zustand) by enforcing clear ownership boundary.

**Uses:** Tests from Phase 1 to verify navigation FSM behavior (guards, stack operations, edge cases).

**Research flag:** Medium - XState v5 `setup()` pattern is well-documented, but integration with existing blade system needs careful design.

### Phase 3: Init Repo Blade with Gitignore Templates
**Rationale:** New blade type that depends on XState FSM for lifecycle (blade push/pop). GitHub API integration is independent of file restructuring and store consolidation.

**Delivers:** New `"init-repo"` blade type with .gitignore template search/filter (GitHub API via Rust Tauri command), template preview, multi-template composition, offline fallback (bundled top 15-20 templates), default branch name selection, README auto-generation, initial commit option.

**Technologies:** reqwest 0.12 (Rust), React Query for template caching

**Addresses:** Table stakes feature "Init Repo blade with .gitignore template search". Avoids Pitfall #6 (rate limiting) with React Query `staleTime: Infinity` and offline fallback. Avoids Pitfall #3 (breaking registration) by following existing blade registration pattern.

**Uses:** XState from Phase 2 for blade lifecycle. React Query for gitignore template cache.

**Research flag:** Low - GitHub gitignore API is stable, unauthenticated, simple JSON responses. Blade registration pattern is proven.

### Phase 4: Dedicated Conventional Commit Blade
**Rationale:** New blade type that reuses all existing CC components. Depends on XState FSM for post-commit navigation (auto-pop to staging). Independent of file restructuring.

**Delivers:** New `"conventional-commit"` blade type with full-width workspace, reusing existing `TypeSelector`, `ScopeAutocomplete`, `ValidationErrors`, `CharacterProgress`, `BreakingChangeSection` components. Adds commit & push workflow, post-commit navigation, amend mode support.

**Technologies:** Existing conventional.ts store, existing Rust `validate_conventional_commit` command

**Addresses:** Table stakes feature "Dedicated Conventional Commit blade". All sub-components already exist and are well-factored - lowest-risk new blade type.

**Uses:** XState from Phase 2 for post-commit navigation (`POP` event on commit success).

**Research flag:** Low - All components exist, blade registration pattern is proven.

### Phase 5: Blade-Centric File Structure Migration
**Rationale:** Do file restructuring AFTER new blades exist (init-repo, conventional-commit). New blades start in correct structure; migrate existing ones gradually. Easier to debug issues when blade system is stable.

**Delivers:** Feature modules (`blades/{blade-name}/`, `features/{feature-name}/`, `shared/`) with co-located components, stores, hooks, tests. Auto-discovery adapted to new paths. Import boundaries enforced.

**Technologies:** No new dependencies - mechanical file moves

**Addresses:** Table stakes feature "Blade-centric file structure". Avoids Pitfall #3 (breaking registration) by updating glob pattern first. Avoids Pitfall #1 (big bang) by migrating blade-by-blade with re-export shims.

**Uses:** Tests from Phase 1 to verify no behavior change during migration.

**Research flag:** Low - Feature-based architecture is consensus React pattern. Vite `import.meta.glob` supports multiple glob patterns.

### Phase 6: Zustand Store Consolidation
**Rationale:** After file structure is stable, co-locate stores with feature modules. Merge related stores (branches + branchMetadata, etc.). Remove blade store (already replaced by XState).

**Delivers:** 18-20 stores reduced to 4-5 domain-grouped stores. Co-located with feature modules. Consistent `.store.ts` naming. Blade store removed (replaced by XState machine).

**Technologies:** No new dependencies - store consolidation only

**Addresses:** Table stakes feature "Tech debt cleanup - store consolidation". Avoids Pitfall #7 (circular dependencies) by mapping dependency graph first. Avoids Pitfall #2 (XState overuse) by consolidating Zustand stores only, not converting to XState.

**Uses:** Tests from Phase 1 to verify merged stores behave identically to originals.

**Research flag:** Low - Zustand docs and community consensus favor separate stores for independent state.

### Phase Ordering Rationale

- **Test infrastructure first** because it verifies all subsequent changes. XState machines are inherently testable; having tests ready enables confident FSM refactoring.
- **XState navigation before file restructuring** because file moves are mechanical but touching navigation system is behavioral. Do the risky behavioral change while file structure is familiar to isolate issues.
- **New blades after XState** because they depend on XState for lifecycle (push/pop/navigation). New blades can start in correct file structure as examples for migration.
- **File restructuring before store consolidation** because store consolidation needs stable import paths. Moving files and consolidating stores simultaneously creates merge conflicts.
- **Store consolidation last** because it's tech debt cleanup, not user-facing. It can happen incrementally alongside other work.

This ordering avoids the "big bang" pitfall: each phase touches different files and can be deployed independently. Phase 1 (tests) touches `vitest.config.ts` + `src/test/`. Phase 2 (XState) touches `src/machines/` + 5-6 navigation files. Phase 3 (init blade) touches `src/blades/init-repo/` only. Phase 4 (CC blade) touches `src/blades/conventional-commit/` only. Phase 5 (file moves) is mechanical. Phase 6 (store consolidation) happens incrementally.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (XState Navigation):** XState machine state design (how to model process switching + blade stack as states vs context). Integration pattern with existing blade registry. Persistence strategy with Tauri plugin-store.
- **Phase 3 (Init Repo Blade):** Multi-template composition algorithm (concatenate + deduplicate rules). Offline fallback template selection (which 15-20 to bundle). GitHub API rate limit handling UI.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Test Infrastructure):** Vitest + React Testing Library is well-documented. Tauri mock factory pattern is established.
- **Phase 4 (Conventional Commit Blade):** All components exist and are well-factored. Blade registration pattern is proven.
- **Phase 5 (File Structure Migration):** Feature-based architecture is consensus. Mechanical file moves with Vite glob.
- **Phase 6 (Store Consolidation):** Zustand consolidation pattern is documented. Dependency graph is clear.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | XState v5, Vitest 4, reqwest 0.12 versions verified via npm view and docs.rs. Peer dependencies cross-checked. |
| Features | HIGH | All table stakes features validated against existing codebase. New blade types require entries in `BladePropsMap`, registration file, and component - pattern is proven. |
| Architecture | HIGH | XState `setup()` + `createActorContext` pattern verified via official docs. Blade-centric structure is consensus React pattern. XState + Zustand coexistence validated via community examples. |
| Pitfalls | HIGH | Critical pitfalls derived from codebase analysis (21 stores, 172 `../../` imports, 13 blade types, 6 cross-store dependencies). XState + Zustand integration risks well-documented in community. |

**Overall confidence:** HIGH

### Gaps to Address

**XState machine granularity:** Tension between modeling process-level navigation as states vs modeling blade stack as states. Recommendation is to model processes as states (`welcome`, `repository.staging`, `repository.topology`) and keep blade stack as context array, but this needs validation during Phase 2 design.

**Store consolidation dependencies:** Current cross-store dependencies (gitflow -> branches + repository, worktrees -> repository) need full mapping before consolidation. Use `madge --circular src/` after each consolidation step to verify no cycles introduced.

**GitHub API rate limiting UX:** 60 req/hr unauthenticated is sufficient with caching, but error message when rate limited needs design. Template list should be prefetched on app startup or first repo open to avoid hitting limit during experimentation.

**Test coverage targets:** Recommendation is 60% coverage for feature modules, but this needs validation during Phase 1. Focus should be on store + hook coverage, not overall coverage.

**Barrel file performance:** Recommendation is NO barrel files for feature modules (direct imports only), but this trades DX for build performance. Needs validation during Phase 5 migration.

## Sources

### Primary (HIGH confidence)
- [XState v5 Documentation](https://stately.ai/docs/xstate) - State machine patterns, `setup()` API, TypeScript types
- [@xstate/react Hooks](https://stately.ai/docs/xstate-react) - `useActor`, `useMachine`, `useSelector`, `useActorRef`, `createActorContext`
- [XState v5 Persistence API](https://stately.ai/docs/persistence) - `getPersistedSnapshot()`, `createActor` with `snapshot` option
- [XState Guards](https://stately.ai/docs/guards) - Guard syntax, composition with `and`/`or`/`not`
- [GitHub REST API: Gitignore](https://docs.github.com/en/rest/gitignore/gitignore) - List templates, get template content
- [github/gitignore Repository](https://github.com/github/gitignore) - 163 templates, root/Global/Community structure
- [Vitest official site](https://vitest.dev/) - v4.0.18, Vite 7 compat, test environment docs
- [Zustand Slices Pattern Documentation](https://zustand.docs.pmnd.rs/guides/slices-pattern) - Store consolidation patterns
- [Zustand Testing Guide](https://zustand.docs.pmnd.rs/guides/testing) - Auto-reset mock pattern
- [Tauri v2 Documentation](https://v2.tauri.app/) - IPC, plugin-store, capabilities
- [git2-rs GitHub](https://github.com/rust-lang/git2-rs) - libgit2 bindings, threading docs
- [tauri-specta GitHub](https://github.com/specta-rs/tauri-specta) - TypeScript binding generation
- [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) - Specification

### Secondary (MEDIUM confidence)
- [XState Global State with React](https://stately.ai/blog/2024-02-12-xstate-react-global-state) - Singleton actor patterns
- [Improve React Navigation with XState v5](https://dev.to/gtodorov/improve-react-navigation-with-xstate-v5-2l15) - Navigation FSM patterns
- [Scalable React Projects with Feature-Based Architecture](https://dev.to/naserrasouli/scalable-react-projects-with-feature-based-architecture-117c) - Feature module structure
- [React Folder Structure in 5 Steps 2025](https://www.robinwieruch.de/react-folder-structure/) - Feature-first organization
- [Bulletproof React: Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) - Import boundaries, barrel files
- [Vite Performance Guide - Barrel Files Warning](https://vite.dev/guide/performance) - Barrel file performance impact
- [Vite Issue #16100: Barrel Files Make Vite Very Slow](https://github.com/vitejs/vite/issues/16100) - HMR degradation
- [Zustand Discussion #2496: Multiple Stores vs Slices](https://github.com/pmndrs/zustand/discussions/2496) - When to use multiple stores
- [GitKraken Init Documentation](https://help.gitkraken.com/gitkraken-desktop/open-clone-init/) - Init flow: path + .gitignore + license + README
- [Testing Library philosophy](https://testing-library.com/docs/react-testing-library/intro/) - Behavior-based testing

### Tertiary (LOW confidence - needs validation)
- [zustand-middleware-xstate](https://github.com/biowaffeln/zustand-middleware-xstate) - Unmaintained, XState v4 only - noted as anti-pattern

### Codebase Analysis (HIGH confidence)
- FlowForge `src/stores/blades.ts` - Current navigation: 97 lines, `pushBlade`/`popBlade`/`replaceBlade`/`resetStack`
- FlowForge `src/stores/bladeTypes.ts` - `BladePropsMap` with 13 types, `TypedBlade` discriminated union
- FlowForge `src/hooks/useBladeNavigation.ts` - Singleton guards, title resolution, 83 lines
- FlowForge `src/lib/bladeOpener.ts` - Non-React blade opener, duplicates hook logic, 32 lines
- FlowForge `src/lib/bladeRegistry.ts` - Registration pattern: `registerBlade()`, `getBladeRegistration()`, Map-based
- FlowForge `src/components/blades/registrations/index.ts` - `import.meta.glob` auto-discovery, HMR support
- FlowForge `src/stores/conventional.ts` - CC store: 11 types, suggestions, validation, message building
- FlowForge `src/hooks/useConventionalCommit.ts` - Debounced validation, filtered scopes, canCommit flag
- FlowForge `src/components/commit/ConventionalCommitForm.tsx` - 202 lines, TypeSelector + ScopeAutocomplete + validation
- FlowForge `src/components/welcome/GitInitBanner.tsx` - 111 lines, basic init with branch name option only
- FlowForge `src-tauri/src/git/init.rs` - `git_init` command: path validation, git2 init with branch name
- FlowForge `package.json` - v1.3.0, React 19, Zustand 5, Tailwind 4, Vite 7, no XState or test deps
- FlowForge codebase statistics: ~29,590 LOC, 21 Zustand stores, 13 blade types, 172 `../../` imports across 96 files, 20 `../../../` imports across 14 files

---
**Research completed:** 2026-02-08
**Ready for roadmap:** Yes
