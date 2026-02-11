# Phase 42 Research: Audit Tech Debt Cleanup

**Researched:** 2026-02-11
**Approach:** 3-agent parallel research (UX, Architecture, Expert Developer)

## Executive Summary

Phase 42 closes 3 tech debt items from the v1.6.0 milestone audit. All changes are low-complexity refactorings with zero breaking changes. The key finding is that BladeRegistry is the only plain Map registry — all others (Sidebar, StatusBar, Toolbar, ContextMenu) are Zustand stores with reactive subscriptions. Converting BladeRegistry to Zustand is the recommended approach.

## Success Criteria (from Roadmap)

1. BladeRenderer subscribes to blade registry changes so already-open blades auto-restore when a disabled extension is re-enabled (no manual close/reopen needed)
2. SandboxedExtensionAPI uses the REQUIRES_TRUST_METHODS constant from sandbox-api-surface.ts instead of hardcoding method names
3. GFEX-03 requirement text in REQUIREMENTS.md reflects ADR-2 decision (branch classification remains in core)

---

## Change 1: BladeRenderer Registry Subscription

### Problem

When a user disables an extension, open blades show a "Puzzle" fallback. When the extension is re-enabled, blade registrations are restored to the Map, but BladeRenderer doesn't know — the Puzzle persists. Users must manually close and reopen the blade.

### Root Cause

`src/lib/bladeRegistry.ts:21` — `const registry = new Map<string, BladeRegistration<any>>()` is a **plain JavaScript Map** with no change notification. BladeRenderer at `src/blades/_shared/BladeRenderer.tsx:16` calls `getBladeRegistration(blade.type)` once per render with no subscription mechanism.

### Registry Pattern Comparison

| Registry | File | Type | Reactive? |
|----------|------|------|-----------|
| **BladeRegistry** | `src/lib/bladeRegistry.ts` | Plain Map | **NO** |
| CommandRegistry | `src/lib/commandRegistry.ts` | Plain Map | No (OK — re-queried each open) |
| ContextMenuRegistry | `src/lib/contextMenuRegistry.ts` | Zustand | Yes |
| SidebarPanelRegistry | `src/lib/sidebarPanelRegistry.ts` | Zustand + visibilityTick | Yes |
| StatusBarRegistry | `src/lib/statusBarRegistry.ts` | Zustand + visibilityTick | Yes |
| ToolbarRegistry | `src/lib/toolbarRegistry.ts` | Zustand + visibilityTick | Yes |

### Recommended Approach: Convert to Zustand Store

**Why:** Matches the pattern used by 4 other registries. Proven, consistent, devtools-integrated.

**Files to modify:**
1. `src/lib/bladeRegistry.ts` (67 lines) — Convert Map to Zustand store with `registrations` state and `registryTick` counter
2. `src/blades/_shared/BladeRenderer.tsx` (69 lines) — Subscribe to `useBladeRegistry` to trigger re-render on registry changes

**Backward compatibility:** Export existing function names (`registerBlade`, `unregisterBlade`, `getBladeRegistration`, etc.) as thin wrappers around `useBladeRegistry.getState()`. All 24 importing files continue to work unchanged.

**Consumer pattern (from DynamicSidebarPanels in RepositoryView.tsx:51-58):**
```tsx
const items = useBladeRegistry((s) => s.registrations);
const tick = useBladeRegistry((s) => s.registryTick);
const reg = useMemo(() => getBladeRegistration(blade.type), [blade.type, items, tick]);
```

### UX Considerations

- **Active blade auto-restore:** BladeRenderer re-renders, calls `getBladeRegistration()` again, finds registration, renders blade component instead of Puzzle — seamless
- **Stack blades:** Only active blade renders via BladeRenderer; other blades re-check when navigated to — naturally staggered
- **Animation:** No explicit transition needed — component swap is instant; AnimatePresence already handles blade transitions
- **Accessibility:** BladeContainer already has `aria-live="polite"` for blade transitions
- **Performance:** Only 1 BladeRenderer instance active at a time; negligible overhead

### Existing Consumers (24 files)

All use function exports (`registerBlade`, `getBladeRegistration`, etc.) — preserved as wrappers:
- Registration files: 10 blade `registration.ts` files
- ExtensionAPI: `src/extensions/ExtensionAPI.ts` (lines 7, 289-290)
- BladeRenderer: `src/blades/_shared/BladeRenderer.tsx`
- BladeOpener: `src/lib/bladeOpener.ts`
- RepoBrowserBlade: `src/blades/repo-browser/RepoBrowserBlade.tsx`
- Navigation: `src/machines/navigation/navigationMachine.ts`, `src/hooks/useBladeNavigation.ts`
- Discovery: `src/blades/_discovery.ts`
- Tests: 5 test files

---

## Change 2: SandboxedExtensionAPI Refactor

### Problem

`src/extensions/sandbox/SandboxedExtensionAPI.ts:1` imports `REQUIRES_TRUST_METHODS` but never uses it. Lines 35-57 manually hardcode 6 method stubs that throw trust errors. If a new requires-trust method is added to `sandbox-api-surface.ts`, the developer must remember to also add a stub — manual sync risk.

### Current State

**Constants (sandbox-api-surface.ts:18-25):**
```typescript
export const REQUIRES_TRUST_METHODS = [
  "registerBlade", "registerCommand", "contributeToolbar",
  "contributeContextMenu", "contributeSidebarPanel", "contributeStatusBar",
] as const;
```

**SandboxedExtensionAPI.ts (lines 35-57):** 6 individual method stubs, each calling `this.trustError("methodName")`.

### Recommended Approach: Dynamic Stub Generation

Use `REQUIRES_TRUST_METHODS` to generate blocked stubs in the constructor, keeping sandbox-safe methods as explicit implementations.

**Options evaluated:**
- **Proxy-based:** Intercept property access, check against constant — elegant but adds Proxy overhead and TypeScript complexity
- **Constructor loop:** Iterate `REQUIRES_TRUST_METHODS`, assign `this[method] = () => { throw this.trustError(method); }` — simple, type-safe with `RequiresTrustMethod` type
- **Runtime assertion:** Keep stubs, add `constructor` check that all REQUIRES_TRUST_METHODS have corresponding methods — minimal change, catches mismatches

**Recommendation:** Constructor loop approach — removes 30 lines of repetitive stubs, uses constant as single source of truth, readable and debuggable.

**File to modify:** `src/extensions/sandbox/SandboxedExtensionAPI.ts` (67 lines)

### Test Impact

`src/extensions/sandbox/__tests__/SandboxBridge.test.ts` — tests call blocked methods and expect errors. Behavior is identical; no test changes needed.

---

## Change 3: GFEX-03 Requirement Text

### Current State

`REQUIREMENTS.md:38` already reads:
```markdown
- [ ] **GFEX-03**: Branch classification and coloring remains in core (10+ consumers across topology graph and branch list; classification is core Git UX, not Gitflow-specific — per ADR-2)
```

The text is already correct per ADR-2 (it was updated during Phase 40). The checkbox is unchecked but status at line 113 shows `Satisfied (ADR-2)`.

### Action Needed

Check the checkbox: `- [ ]` → `- [x]`

**File to modify:** `.planning/REQUIREMENTS.md` (line 38)

---

## Implementation Summary

| Change | Files | Complexity | Risk |
|--------|-------|-----------|------|
| 1. BladeRegistry → Zustand + BladeRenderer subscription | 2 source files | Low | Zero (backward-compat wrappers) |
| 2. SandboxedExtensionAPI uses constant | 1 source file | Trivial | Zero (same behavior) |
| 3. GFEX-03 checkbox | 1 doc file | Trivial | Zero |

**Total estimated: ~80 lines changed across 4 files. All trivial complexity. No breaking changes.**

### Recommended Plan Structure

Single plan (all 3 items are small, tightly coupled as "audit cleanup"):
- Wave 1: All 3 changes (independent, no dependencies between them)
- Verification: `npx vitest run` passes, BladeRenderer subscribes to registry

---

## RESEARCH COMPLETE
