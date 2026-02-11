# Phase 43: Infrastructure Prep - Research Synthesis

**Researched:** 2026-02-11
**Perspectives:** UX Specialist, Technical Architect, Expert Developer (Tauri/React/Zustand)
**Confidence:** HIGH (all 3 researchers converge on the same patterns)

## Executive Summary

Phase 43 migrates the 2 remaining plain-Map registries (commandRegistry, previewRegistry) to Zustand stores, adds infrastructure hooks for extension-aware process navigation and WelcomeView rendering, resets CC store on extension disable, and expands the sandbox API surface.

**Key insight from all 3 researchers:** Every pattern needed already exists in the codebase. BladeRegistry (migrated in v1.6) is the exact template. 5 other Zustand registries confirm the pattern. Zero novel infrastructure needed.

## Convergent Findings

### 1. Registry Migration is a Solved Pattern
- BladeRegistry, toolbarRegistry, sidebarPanelRegistry, contextMenuRegistry, statusBarRegistry ALL use identical Zustand pattern
- `create<State>()(devtools((set, get) => ({...}), { name: "...", enabled: import.meta.env.DEV }))`
- Backward-compatible function exports delegate to `useStore.getState().method()`
- commandRegistry has 13 consumers (only CommandPalette needs modification), previewRegistry has 2 consumers

### 2. CommandPalette Has a Critical Reactivity Gap
- Current: `useMemo(() => getEnabledCommands(), [isOpen])` — only refreshes on open/close
- Target: `useCommandRegistry((s) => s.commands)` — live subscription, instant updates
- UX impact: Commands appear/disappear in real-time when extensions toggle

### 3. Source-Based Cleanup Unifies All Registries
- `Command.source` field already exists; `PreviewRegistration.source` must be added
- After migration: `ExtensionAPI.cleanup()` simplifies to `unregisterBySource()` across all 7 registries
- Single state update per registry (no ARIA announcement storms)

### 4. Process Tab Visibility is a Simple BladeRegistry Selector
- `useBladeRegistry((s) => s.blades.has("topology-graph"))` — one-liner
- Auto-fallback to "staging" when active process becomes unavailable
- Keep tab bar visible even with single tab (preserve spatial consistency)

### 5. WelcomeView Lookup is Defensive + Reactive
- Replace `import { InitRepoBlade }` with `useBladeRegistry((s) => s.blades.get("init-repo"))`
- Loading fallback if registration hasn't arrived yet (race condition guard)
- Registration ordering guaranteed by eager `import.meta.glob` in `_discovery.ts`

### 6. CC Store Reset via api.onDispose()
- `useConventionalStore.getState().reset()` called during extension cleanup
- Prevents ghost state on re-enable
- Consider resetting `scopeFrequencies` and `pushAfterCommit` for full cleanup

### 7. Sandbox API Methods Already Implemented
- `onDidNavigate`, `events`, `settings` exist in ExtensionAPI.ts
- Only classification change needed in `sandbox-api-surface.ts`
- SandboxedExtensionAPI needs proxy methods

### 8. Zero Circular Import Risk
- commandRegistry imports only LucideIcon (external type)
- previewRegistry imports only React/bindings types
- Dependency direction stays one-way: extension layer -> registry layer -> types

## Key Pitfalls to Guard Against

| Pitfall | Risk | Mitigation |
|---------|------|------------|
| CommandPalette selected index out of bounds | MEDIUM | Clamp `selectedIndex` when command list shrinks |
| ARIA announcement storm on bulk unregister | MEDIUM | Use `unregisterBySource()` for single state update |
| ProcessNavigation infinite loop on auto-fallback | HIGH | Guard effect: only switch if `activeProcess !== "staging"`, memoize process list |
| WelcomeView race condition on first load | LOW | Defensive fallback + Zustand subscription triggers re-render |
| PreviewRegistry missing source field | HIGH | Add `source?: string` to interface, update 5 core registrations |
| CC store ghost data on re-enable | MEDIUM | `api.onDispose(() => store.reset())` in CC extension activate |

## Execution Order Dependencies

```
INFRA-01 (commandRegistry → Zustand) ─┐
                                       ├─> INFRA-03 (CommandPalette reactive)
INFRA-02 (previewRegistry → Zustand) ──┘

BladeRegistry (already done) ──> INFRA-04 (process tab visibility)
                              ──> INFRA-05 (WelcomeView lookup)

INFRA-06 (CC store reset) ──> independent
INFRA-07 (sandbox API) ──> independent
```

**Recommended wave structure:**
- **Wave 1:** INFRA-01 + INFRA-02 (registry migrations — foundational)
- **Wave 2:** INFRA-03 + INFRA-04 + INFRA-05 + INFRA-06 + INFRA-07 (all depend on Wave 1 or are independent)

## Files to Modify

| File | Change | Risk |
|------|--------|------|
| `src/lib/commandRegistry.ts` | Zustand store + backward-compat exports | LOW |
| `src/lib/previewRegistry.ts` | Zustand store + source field + backward-compat exports | LOW |
| `src/components/command-palette/CommandPalette.tsx` | useCommandRegistry selector | LOW |
| `src/blades/_shared/ProcessNavigation.tsx` | Conditional tab visibility | LOW |
| `src/components/WelcomeView.tsx` | BladeRegistry lookup | MEDIUM |
| `src/extensions/sandbox/sandbox-api-surface.ts` | Add 3 methods | LOW |
| `src/extensions/conventional-commits/index.ts` | api.onDispose store reset | LOW |
| `src/blades/staging-changes/components/previewRegistrations.ts` | Add source: "core" | LOW |

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useProcessTabVisibility.ts` | Hook for conditional process tab rendering |

## Detailed Research Documents

- [43-RESEARCH-UX.md](./43-RESEARCH-UX.md) — UX patterns, accessibility, graceful degradation
- [43-RESEARCH-ARCHITECTURE.md](./43-RESEARCH-ARCHITECTURE.md) — Store architecture, source tracking, enforceability
- [43-RESEARCH-IMPLEMENTATION.md](./43-RESEARCH-IMPLEMENTATION.md) — Code patterns, file impact, testing approach

## RESEARCH COMPLETE
