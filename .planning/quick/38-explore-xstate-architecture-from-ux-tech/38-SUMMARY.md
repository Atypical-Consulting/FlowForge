# Quick Task 38: XState Architecture Exploration — Synthesis

## Executive Summary

Three independent analyses (UX, Architecture, Expert Developer) converge on the same conclusion: FlowForge's existing XState navigation machine proves the pattern works, and extending it to 4 additional workflow machines will eliminate impossible states, unlock extension-contributed workflows, and improve error recovery UX — all while keeping Zustand for data containers and React Query for cache.

The key architectural insight across all three perspectives: **XState machines should be first-class extension citizens**, discoverable via a MachineRegistry, extensible via `machine.provide()`, and integrated with the existing event bus for cross-cutting communication.

---

## Cross-Perspective Agreement Matrix

| Topic | UX Analysis | Architecture Analysis | Dev Analysis | Consensus |
|-------|-------------|----------------------|--------------|-----------|
| Migration priority | Merge > Commit+Push > Gitflow > Clone > Dialogs | Merge > Gitflow > Clone > Commit+Push | Merge > Gitflow > Clone > Commit+Push > Registry | **Merge first, unanimous** |
| Actor lifecycle | — | Module-level singletons (core), extension-managed (ext) | Module-level singletons matching navigation pattern | **Singleton pattern** |
| Zustand coexistence | — | Data in Zustand, workflows in XState | Data in Zustand, workflows in XState | **Hybrid architecture** |
| Extension model | `subscribeToWorkflow()`, `contributeValidation()`, `contributeWorkflowAction()` | `machine.provide()` with typed contracts, MachineRegistry | `machine.provide()` + contribution contracts + MachineRegistry | **provide() + Registry** |
| React integration | — | Pattern A: parallel access (useSelector + Zustand hooks) | `useMergeWorkflow()` hook wrapping useSelector | **Custom hooks per machine** |
| Event bus integration | Extensions observe intermediate states | Machine actions emit to GitHookBus/ExtensionEventBus | `emitWill` as machine guard, `emitDid` as machine action | **Machines as event sources** |

---

## Unified Refactoring Strategy

### Phase 1: Foundation (MachineRegistry + Conventions)

**Create `src/lib/machineRegistry.ts`** following the CommandRegistry pattern:
- `register(id, machine, source)` / `unregister(id)` / `unregisterBySource(source)`
- Zustand-based store for React-aware registration
- Extension cleanup integration via `ExtensionAPI.cleanup()`

**Standardize machine directory structure** (from navigation pattern):
```
src/machines/{name}/
  {name}Machine.ts     — Machine definition (setup + createMachine)
  actors.ts            — fromPromise/fromCallback actors
  types.ts             — Context, events, state types
  selectors.ts         — SnapshotFrom<> typed selectors
  contributions.ts     — Extension contribution contracts
  hooks.ts             — useMergeWorkflow() etc.
  index.ts             — Public API barrel
  {name}Machine.test.ts
```

**Add ExtensionAPI methods:**
- `registerMachine(config)` — Register and start an actor with namespacing + cleanup
- `provideMachineOverrides(machineId, overrides)` — Contribute guards/actions/actors to core machines
- `onMachineTransition(machineId, handler)` — Subscribe to state changes
- `getMachineActor(machineId)` — Get actor reference

### Phase 2: Merge Workflow Machine (Highest Impact)

**Current pain (all three analyses agree):**
- `branchMergeInProgress` + `branchLastMergeResult` are independent booleans that desynchronize
- No "resolving" state — closing dialog loses conflict context
- No retry path after errors
- Extensions can only react after completion, not participate in workflow

**Machine states:** `idle → merging → (conflicted | idle) → resolving → committed | aborting → idle`

**Key patterns introduced:**
- `fromPromise` wrapping `commands.mergeBranch()` — translates Tauri result pattern to promise
- Discriminated `onDone` transitions (conflicts vs. clean merge)
- Extension-contributed merge strategies via `machine.provide()` actor overrides
- `data-[state=conflicted]:bg-ctp-yellow/10` Tailwind v4 state-driven CSS
- `useMergeWorkflow()` hook replacing Zustand boolean consumption

**Extension win:** GitHub extension's `MergeStrategySelector` can register strategy implementations; CI extensions can block merges via `onWillGit("merge")` integrated as a machine guard state.

**Migration:** Bridge via `actor.subscribe()` to keep Zustand slice in sync during incremental migration. Remove bridge once all components use `useMergeWorkflow()`.

### Phase 3: Gitflow Operations Machine

**Current pain:**
- `finishFeature` runs 3-4 sequential async calls — if `loadBranches()` fails after finish, silent stale data
- Single `gitflowIsLoading` boolean covers all operations
- No concurrent operation prevention

**Machine states:** `idle → executing → refreshing → (idle | stale) | error`

**Key innovation:** `stale` state — "operation succeeded but view may be outdated, click Refresh." Eliminates silent partial-update bugs.

**Extension win:** Pre-finish validation state collects results from registered validators. Post-finish compound state runs extension-contributed cleanup actions in parallel.

### Phase 4: Clone Progress Machine

**Current pain:**
- No cancel button once clone starts
- Tauri Channel stays open on unmount
- No retry (user must re-enter URL)

**Machine states:** `idle → cloning → (complete | error | idle[cancelled])`

**Key pattern:** `fromCallback` actor wraps Tauri Channel with automatic cleanup. Leaving `cloning` state sets `cancelled = true`, preventing leaked channel listeners. Same pattern reusable for push/pull/fetch.

**Extension win:** Post-clone setup phase where extensions contribute configuration actions (install deps, configure hooks).

### Phase 5: Commit+Push Orchestration Machine

**Current pain:**
- Push retry lives in toast callback (toasts auto-dismiss, losing retry option)
- Hook validation opaque ("cancelled by extension" with no detail)
- Amend commit uses `window.confirm()` instead of themed dialog

**Machine states:** `idle → validatingHooks → (hookRejected | committing) → committed → (pushing → (idle | pushError))`

**Key innovation:** `hookRejected` state shows which extension blocked and why. `pushError` state with persistent retry button (not ephemeral toast).

**Extension win:** Extensions contribute visible validation steps in `validatingHooks` compound state. Post-commit actions (Create PR, Update ticket, Run tests) register as state transitions from `committed`.

---

## Extensibility Architecture

### How Extensions Participate in Workflows

```
Current: Extension reacts AFTER an operation completes
  commit() → onDidGit("commit") → extension toast

XState: Extension participates DURING the workflow
  COMMIT → [validatingHooks: extension checks] → committing → [committed: extension actions] → push
```

### Extension Contribution Contract Types

| Contract | Mechanism | Example |
|----------|-----------|---------|
| Guard override | `machine.provide({ guards })` | CI extension blocks merge if checks fail |
| Action override | `machine.provide({ actions })` | Notification extension on merge complete |
| Actor override | `machine.provide({ actors })` | Custom conflict resolver |
| State subscription | `actor.subscribe()` | Extension shows UI only during conflicts |
| Event sending | `actor.send({ type: "ext...." })` | Extension triggers workflow transition |

### MachineRegistry as Extension Discovery

```
CommandRegistry → Commands extensions can execute
BladeRegistry → Views extensions can show
MachineRegistry → Workflows extensions can participate in
```

Extensions query the registry for available extension points:
```typescript
const mergeEntry = machineRegistry.get("core:merge");
mergeEntry.extensionPoints // [{ type: "guard", name: "shouldAutoResolve", ... }]
```

---

## Anti-Patterns to Avoid

1. **No monolithic app machine** — Each workflow is independent
2. **No Zustand mirror** — Use `useSelector(actor)` directly, don't copy state to Zustand
3. **No event bus duplication** — Machine IS the source of truth; hook bus emissions are machine action side effects
4. **No premature parallel states** — Start flat, add parallel regions only when extensions need concurrent concerns
5. **No over-abstraction of registry** — Simple Map of actor references, not a DI container

---

## Open Questions for Implementation

1. **Machine hot-reload:** Should `machine.provide()` overrides be re-applied when extensions reload?
2. **State persistence:** Should long-running workflows (clone) survive page reloads via `@xstate/persistence`?
3. **Machine-to-machine deps:** Direct actor reference (type-safe, coupled) vs event bus (loose, untyped)?
4. **Testing convention:** Document `machine.provide()` override pattern as standard for all machine tests

---

## Deliverables Produced

| File | Lines | Key Contribution |
|------|-------|-----------------|
| UX-ANALYSIS.md | 417 | UX pain points per machine, error recovery patterns, extension-aware workflow composition |
| ARCH-ANALYSIS.md | 771 | MachineRegistry design, extension boundary model, actor communication matrix, Zustand coexistence |
| DEV-ANALYSIS.md | 1424 | Full machine implementations (merge, gitflow, clone, commit+push), fromPromise/fromCallback patterns, TypeScript contracts, Tailwind v4 state-driven CSS, testing patterns |

---

## Recommended Next Steps

1. **Create a new milestone phase** for "XState Workflow Machines" in ROADMAP.md
2. **Start with MachineRegistry + Merge Machine** as the first implementation phase
3. **Use the ideas document + these analyses** as input to `/gsd:plan-phase` when ready
4. **Consider breaking into sub-phases:** Foundation → Merge → Gitflow → Clone → Commit+Push
