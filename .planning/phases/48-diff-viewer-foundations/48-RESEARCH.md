# Phase 48 Research: Diff Viewer Foundations

## Research Team

Three parallel researchers investigated this phase:
1. **UX Researcher** — Diff viewer interaction patterns, accessibility, Catppuccin color strategy
2. **Architecture Researcher** — Extension system analysis, extensibility interfaces, refactoring strategy
3. **Expert Developer** — Tauri/Rust/React/Tailwind v4 implementation specifics, Monaco APIs, testing

## Executive Summary

Phase 48 covers three requirements: **DIFF-01** (collapsible unchanged regions), **DIFF-04** (word-level diff highlighting), and **DIFF-05** (persistent view mode preference).

**Key decision:** Leverage Monaco's built-in capabilities (`hideUnchangedRegions`, `diffAlgorithm: "advanced"`) rather than building a custom renderer. Refactor the monolithic `DiffBlade.tsx` into composable components with clear extension points for Phases 49-53.

---

## 1. Current Architecture (Codebase Analysis)

### Diff Components
| File | Purpose | Key Details |
|------|---------|-------------|
| `src/core/blades/diff/DiffBlade.tsx` | Main diff viewer (283 lines) | Monaco DiffEditor, inline/side-by-side toggle, markdown preview |
| `src/core/blades/diff/registration.tsx` | Core blade registration | `type: "diff"`, lazy loaded |
| `src/core/blades/diff/types.ts` | `DiffSource` type | staging mode + commit mode |
| `src/core/blades/staging-changes/components/InlineDiffViewer.tsx` | Staging panel preview | Inline-only, scroll position persistence, 150ms debounce |
| `src/core/blades/staging-changes/components/StagingDiffPreview.tsx` | Preview routing | Uses previewRegistry for binary/image/text dispatch |

### Monaco Configuration
| File | Purpose |
|------|---------|
| `src/core/lib/monacoTheme.ts` | `flowforge-dark` theme with Catppuccin Mocha colors |
| `src/core/lib/monacoConfig.ts` | `MONACO_COMMON_OPTIONS` shared across editors |
| `src/core/lib/monacoWorkers.ts` | Worker setup for bundled editor |

### Current Diff Colors (Too Subtle)
```typescript
"diffEditor.insertedTextBackground": "#a6e3a120"  // 12.5% opacity - word-level barely visible
"diffEditor.removedTextBackground": "#f38ba820"    // 12.5% opacity
"diffEditor.insertedLineBackground": "#a6e3a115"   // 8% opacity
"diffEditor.removedLineBackground": "#f38ba815"     // 8% opacity
```

### Known Issues
- **No collapsible regions** — DiffBlade doesn't use `hideUnchangedRegions`
- **No word-level highlighting** — Uses Monaco defaults with too-subtle colors
- **No preference persistence** — View mode (inline/split) resets on unmount
- **Memory leak** — DiffBlade does NOT call `editor.dispose()` on unmount
- **Monolithic component** — All logic in one 283-line file

---

## 2. Implementation Strategy

### DIFF-01: Collapsible Unchanged Regions

**Approach:** Monaco's built-in `hideUnchangedRegions` API (available in 0.55.x)

```typescript
hideUnchangedRegions: {
  enabled: true,
  contextLineCount: 3,     // git diff default, universally expected
  minimumLineCount: 3,     // only collapse if 3+ lines hidden
  revealLineCount: 20,     // reveal 20 lines per click (matches GitHub)
}
```

**Why 3 context lines:** VS Code, GitHub, GitKraken all default to 3. It's the `git diff` default. 5 lines would reduce the benefit (changes every 10-15 lines would never collapse).

**Scroll preservation:** Monaco handles internally — no additional code needed.

**Toolbar toggle:** Add "Collapse Unchanged" / "Show All" button with `UnfoldVertical`/`FoldVertical` Lucide icons.

**Theme additions for collapsed region styling:**
```typescript
"diffEditor.unchangedRegionBackground": "#181825",  // ctp-mantle
"diffEditor.unchangedRegionForeground": "#6c7086",  // ctp-overlay0
"diffEditor.unchangedCodeBackground": "#181825",     // ctp-mantle
```

### DIFF-04: Word-Level Diff Highlighting

**Approach:** Monaco's `diffAlgorithm: "advanced"` already computes word-level diffs. Just needs theme tuning.

**Refined color strategy (layered opacity):**
```typescript
// Word-level: HIGHER opacity for clear boundaries
"diffEditor.insertedTextBackground": "#a6e3a140",   // 25% — green word highlights
"diffEditor.removedTextBackground": "#f38ba840",     // 25% — red word highlights

// Line-level: LOWER opacity as subtle background wash
"diffEditor.insertedLineBackground": "#a6e3a110",   // 6%
"diffEditor.removedLineBackground": "#f38ba810",     // 6%

// Gutter: moderate
"diffEditorGutter.insertedLineBackground": "#a6e3a130",
"diffEditorGutter.removedLineBackground": "#f38ba830",
```

**Design principle:** Line-level is subtle background wash; word-level is prominent highlight. Eye sees which lines changed, then which words changed. Background highlighting (not text color) preserves syntax coloring.

**Additional Monaco options:**
```typescript
diffAlgorithm: "advanced",              // explicit word-level diff
diffWordWrap: "on",                      // prevent horizontal scroll in split
renderIndicators: true,                  // +/- gutter indicators
renderMarginRevertIcon: false,           // disable Monaco revert (conflicts with Phase 50)
useInlineViewWhenSpaceIsLimited: true,   // auto-switch to inline on narrow panels
renderSideBySideInlineBreakpoint: 600,   // threshold in pixels
```

### DIFF-05: Persistent View Mode Preference

**Approach:** New Zustand slice in preferences store + `@tauri-apps/plugin-store`

**New preferences:**
```typescript
interface DiffPreferences {
  viewMode: "inline" | "side-by-side";
  collapseUnchanged: boolean;
  contextLines: number;  // future-proofing
}
```

**Storage pattern:** Same as existing `settings.slice.ts` — immediate persist via `store.set()` + `store.save()`. Spread merge (`{ ...defaults, ...saved }`) handles forward compatibility.

---

## 3. Refactoring Strategy (Extensibility Focus)

### Component Decomposition

Current monolithic `DiffBlade.tsx` becomes:

```
src/core/blades/diff/
  DiffBlade.tsx              # Orchestrator (slimmed down)
  types.ts                   # DiffSource (unchanged)
  registration.tsx           # Blade registration (unchanged)
  components/
    DiffContent.tsx           # Monaco DiffEditor wrapper with lifecycle management
    DiffToolbar.tsx           # View mode toggle, collapse toggle, navigation slot
    DiffMarkdownPreview.tsx   # Extracted markdown preview
    StagingDiffNavigation.tsx # Extracted file navigation
  hooks/
    useDiffQuery.ts           # Shared react-query hook for Tauri diff commands
    useDiffPreferences.ts     # Hook wrapping preferences store slice
```

### DiffContent Component (Monaco Wrapper)

Key responsibilities:
- Proper `editor.dispose()` on unmount (fixes memory leak)
- Memoized options object to prevent Monaco reconfiguration
- Container div with `flex-1 min-h-0 h-full overflow-hidden` (fixes 0px height bug)
- All Phase 48 Monaco options (`hideUnchangedRegions`, `diffAlgorithm`, etc.)

### DiffToolbar Component

Slot-based design for extensibility:
```tsx
interface DiffToolbarProps {
  inline: boolean;
  onToggleInline: () => void;
  collapseUnchanged: boolean;
  onToggleCollapse: () => void;
  isMarkdown?: boolean;
  showPreview?: boolean;
  onTogglePreview?: () => void;
  trailing?: React.ReactNode;  // slot for navigation, future actions
}
```

Uses segmented toggle (same pattern as existing Diff/Preview toggle for markdown) with `role="radiogroup"` for accessibility.

### Shared Query Hook

Eliminates duplication between `DiffBlade.tsx` and `InlineDiffViewer.tsx`:
```typescript
function useDiffQuery(source: DiffSource, contextLines = 3) {
  // staging mode → commands.getFileDiff()
  // commit mode → commands.getCommitFileDiff()
  // staleTime: 60s for commits (immutable), undefined for working tree
}
```

### Extension Points for Future Phases

**Gutter space reservation:** Keep `glyphMargin: true` in DiffContent. Phase 50 adds staging buttons here.

**Hunk data availability:** The Rust backend already returns `DiffHunk` objects with `old_start`, `old_lines`, `new_start`, `new_lines`. Phase 50 can use these directly for `git add -p` operations.

**Context menu integration:** The `contextMenuRegistry` already declares a `"diff-hunk"` location. Phase 50 can register actions there.

**Decoration registry (future):** Architecture researcher proposed `GutterDecorationProvider`, `DiffDecoratorProvider`, `DiffHunkAction`, and `DiffOverlay` interfaces. These are NOT needed for Phase 48 but document the extensibility path for Phases 49-50.

---

## 4. Preferences Persistence Architecture

### New File: `diff.slice.ts`

```
src/core/stores/domain/preferences/
  diff.slice.ts    # NEW — DiffSlice with viewMode, collapseUnchanged, contextLines
  index.ts         # MODIFIED — wire in DiffSlice + initDiffPreferences
```

**Store key:** `"diff-preferences"` (separate from `"settings"` to avoid migration complexity)

**Wire into `initAllPreferences()`:** Called at app startup, before any blade renders.

---

## 5. Rust Backend: No Changes Needed

All Phase 48 features are purely frontend:
- Collapsible regions: Monaco API
- Word-level highlighting: Monaco internal algorithm + theme colors
- Preference persistence: Zustand + Tauri store plugin

The Rust `diff.rs` module already provides everything needed. No Tauri command changes.

---

## 6. Testing Strategy

### Mock Strategy
- Continue existing pattern: `vi.mock("@monaco-editor/react")` with `DiffEditor` stub
- `vi.mock("../../../bindings")` for Tauri commands
- `vi.hoisted()` for mock objects referenced in factory

### Key Tests
1. **DiffToolbar:** Toggle callbacks, label rendering, markdown mode hiding
2. **DiffContent:** Options forwarding, lifecycle cleanup
3. **diff.slice:** Init with defaults, persist view mode, merge partial saved prefs
4. **useDiffPreferences:** Reads from store, writes trigger persistence
5. **useDiffQuery:** Correct query key/fn for staging vs commit mode

### Edge Cases
- Empty file diff (new file): all green additions
- Binary file: placeholder, no Monaco
- Identical files: "No differences" or fully collapsed
- Very long lines: `diffWordWrap: "on"` prevents horizontal scroll
- Narrow panel: auto-switch to inline below 600px

---

## 7. Recommended Plan Breakdown

### Plan 48-01: Refactor DiffBlade + Diff Preferences Slice (Wave 1)
- Extract `DiffContent`, `DiffToolbar`, `StagingDiffNavigation`, `DiffMarkdownPreview`
- Create `diff.slice.ts` + wire into `PreferencesStore`
- Create `useDiffQuery` and `useDiffPreferences` hooks
- Fix Monaco editor disposal memory leak
- Tests for new components, slice, and hooks

### Plan 48-02: Collapsible Regions + Word-Level Highlighting + Theme (Wave 2)
- Enable `hideUnchangedRegions` in DiffContent (wired to preferences)
- Add collapse toggle to DiffToolbar
- Tune `flowforge-dark` theme tokens for word-level visibility
- Add collapsed region theme colors
- Add `diffAlgorithm`, `diffWordWrap`, responsive breakpoint logic
- Apply `hideUnchangedRegions` to `InlineDiffViewer.tsx` too
- Tests for preference persistence and toggle behavior

---

## Sources

- Monaco `hideUnchangedRegions` API (Monaco 0.55.x)
- VS Code v1.81 Release Notes (July 2023) — collapsed unchanged regions
- VS Code, GitHub, GitKraken diff interaction patterns
- Catppuccin Mocha palette reference
- FlowForge codebase analysis (13 key files mapped)
