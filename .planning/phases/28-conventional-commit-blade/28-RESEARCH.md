# Phase 28 Research: Conventional Commit Blade

## RESEARCH COMPLETE

## Synthesis Summary

Three independent research streams -- UX (layout, interactions, flows), Architecture (state management, XState, blade registration), and Developer (file inventory, refactoring plan, testing) -- converged on a highly consistent design for the Conventional Commit Blade. The blade provides a full-width workspace for composing conventional commits with a two-column SplitPaneLayout (form left, preview right), sharing state with the existing sidebar form via the same Zustand store. The work divides into two phases: (1) refactoring existing code to extract shared hooks and pure utilities, then (2) building the blade and its new components.

All three researchers agree on the core architecture, layout, state sharing strategy, and blade registration pattern. Minor differences exist around template data shape, amend UX details, and post-commit navigation timing, which are resolved below.

---

## Cross-Researcher Consensus

The following decisions have unanimous agreement across all three research documents:

### Layout
- **Two-column SplitPaneLayout** with form on the left (~55%) and preview on the right (~45%), matching `InitRepoBlade` and `StagingChangesBlade` precedent.
- Use `autoSaveId="cc-blade-split"` for persistent user-adjusted split ratio.
- Full-width behavior comes for free from the blade system (`flex-1 min-w-0`). No special infrastructure needed.

### State Management
- **Single `useConventionalStore` (Zustand)** shared between sidebar and blade. Both modes read/write the same store, providing seamless state persistence when switching between them.
- **Extend the existing store** with amend state, push-after-commit preference, template state, and scope frequencies rather than creating new stores.
- `useConventionalCommit` hook remains the primary bridge between store and UI for both modes.

### Blade Registration
- Blade type: `"conventional-commit"` added to `BladePropsMap` with `{ amend?: boolean }` props.
- Registration: `singleton: true`, `wrapInPanel: true`, `showBack: true`, lazy-loaded.
- Add `"conventional-commit"` to `SINGLETON_TYPES` in `navigationMachine.ts` and to `EXPECTED_TYPES` in `registrations/index.ts`.

### Dual-Mode Coexistence (CC-07)
- Sidebar compact form stays as-is for quick commits.
- Explicit "Expand" button (Lucide `Maximize2` icon) in the sidebar to open the blade.
- Only one form active at a time -- sidebar form hides or shows placeholder when blade is open.
- Do NOT auto-open blade when toggling CC mode. The blade is an explicit user action.

### Shared Logic Extraction
- Extract `useCommitExecution` hook from `CommitForm.tsx` (commit + push mutations).
- Extract amend pre-fill logic into a reusable hook or store extension.
- Both sidebar and blade consume the same hooks.

### No New Rust Commands
- CC-04 (commit+push): Frontend orchestration of existing `createCommit` + `pushToRemote`.
- CC-05 (auto-navigate): Pure frontend blade navigation.
- CC-06 (amend): `getLastCommitMessage()` + frontend parsing. No new Rust IPC needed.
- CC-08 (scope frequency): `getScopeSuggestions()` already returns frequency data.
- CC-09 (templates): Frontend-only static data.

### Scope Frequency Visualization (CC-08)
- Horizontal bar chart, pure CSS with Tailwind (no charting library).
- Clickable bars fill the scope input.
- Data from existing `getScopeSuggestions(50)` command.

### Templates (CC-09)
- Static TypeScript definitions shipped with the app. No backend persistence for v1.
- Applied by populating store fields. All fields remain editable after applying a template.

### Existing Components to Reuse As-Is
- `TypeSelector`, `ScopeAutocomplete`, `BreakingChangeSection`, `CharacterProgress`, `ValidationErrors` -- all well-isolated and directly reusable in the blade layout.

### Dirty Form Guard
- Use `useBladeFormGuard` with `description`/`commitType` as dirty signals.
- Integrates with existing `confirmingDiscard` state in the navigation FSM.

---

## Resolved Differences

### 1. Post-Commit Navigation Timing

**UX Research** recommends a 1.5-second in-blade success animation before auto-navigating back, with a "Stay here" cancel link. **Architecture Research** suggests `goBack()` immediately after success. **Developer Research** suggests `goBack()` after success without specifying timing.

**DECIDED: Brief success state (1.5s) then auto-navigate.** The UX recommendation is correct -- users need visual confirmation that their commit succeeded before being redirected. The implementation should:
1. Show an in-blade success state with checkmark animation for 1.5 seconds.
2. Show a toast notification with "Push now" action (if not already pushing).
3. Auto-pop the blade after the delay.
4. Include a "Stay here" link to cancel the timer.
5. Call `store.reset()` to clear form state.

**Rationale:** Immediate navigation feels jarring and gives no confirmation. The 1.5s delay is short enough to not feel slow but long enough for the user to register success.

### 2. Template Data Structure

The three researchers propose slightly different `CommitTemplate` interfaces:
- **UX**: `{ id, label, icon?, type, scope?, descriptionPrefix?, body?, isBreaking?, breakingDescription? }`
- **Architecture**: `{ id, name, description, fields: { commitType, scope?, description, body?, isBreaking?, breakingDescription? } }`
- **Developer**: `{ id, label, description, commitType, scope?, descriptionTemplate, bodyTemplate?, isBreaking? }`

**DECIDED: Use the Architecture pattern with a nested `fields` object.**

```typescript
export interface CommitTemplate {
  id: string;
  label: string;
  description: string;
  icon?: string; // Lucide icon name (from UX)
  fields: {
    commitType: CommitType;
    scope?: string;
    description: string;
    body?: string;
    isBreaking?: boolean;
    breakingDescription?: string;
  };
}
```

**Rationale:** The nested `fields` object cleanly separates metadata (label, description, icon) from the form values that get applied to the store. It makes `applyTemplate` trivially simple: `set({ ...template.fields, activeTemplate: template })`. The `icon` field from UX research is included for the chip/dropdown presentation.

### 3. Template Presentation (Chips vs Dropdown)

**UX** recommends horizontal chip bar that collapses to a dropdown after typing. **Architecture** shows a template selector in the form header area. **Developer** suggests a template dropdown or list in the right panel.

**DECIDED: Horizontal chip bar in the form area (left column), collapsing to dropdown on input.** The UX recommendation is the most refined. Templates are a starting-point action -- they should be prominent when the form is empty and then get out of the way. Placing them in the right panel (Developer suggestion) would reduce discoverability since users focus on the left column while filling in the form.

### 4. Amend Button Placement and UX

**UX** recommends a prominent amend toggle in the blade header with a full-width warning banner. **Architecture** places the amend checkbox in the form footer alongside push preference. **Developer** places the amend toggle in the `CommitActionBar`.

**DECIDED: Amend toggle in the blade header area with a conditional warning banner.**

- A toggle switch in the header/toolbar area (not buried in the footer) makes the destructive amend mode unmistakably visible.
- When active, a full-width warning banner appears below the header: `[!] Amending previous commit: "feat(auth): add login flow"`.
- The Commit button label changes to "Amend Commit" with a `RotateCcw` icon.
- The "Commit & Push" button changes to "Amend & Force Push" with warning styling.

**Rationale:** Amend rewrites history. It must not be a subtle checkbox that users accidentally leave checked.

### 5. Where to Place Scope Frequency Chart

**UX** recommends the right column, below the preview. **Architecture** agrees (right panel, `PreviewFooter` section). **Developer** agrees but also mentions it could go in a collapsible section.

**DECIDED: Right column, below the preview, in a collapsible section.** All three agree on the right column. Making it collapsible (Developer suggestion) is a good addition since it is supplementary information that should not compete with the preview for vertical space.

### 6. `buildCommitMessage` Location

**Architecture** recommends keeping it in the store. **Developer** recommends extracting it to a pure utility function in `src/lib/conventional-utils.ts`.

**DECIDED: Extract to pure utility function, keep a delegating wrapper in the store.** The Developer recommendation is correct -- pure functions are easier to unit test and can be used independently (e.g., in the blade preview, in tests, in template preview). The store keeps a thin `buildMessage()` method that calls the pure function with current state.

### 7. Blade Props Shape

**UX** proposes `{ amend?: boolean }`. **Developer** proposes `{ amendOid?: string }`.

**DECIDED: `{ amend?: boolean }`.** For Phase 28, the blade always amends the most recent commit (HEAD). Amending arbitrary commits by OID is a future feature. Keeping the prop simple avoids premature complexity.

---

## Requirement Coverage

### CC-01: Full-width blade workspace

**Status: Fully covered by all three researchers.**

- The blade pushes onto the blade stack via `PUSH_BLADE` and naturally fills the remaining viewport width.
- Internal layout uses `SplitPaneLayout` with form (55%) and preview (45%).
- Blade registration: `singleton: true`, `wrapInPanel: true`, `showBack: true`, lazy-loaded.
- Entry points: (1) "Expand" button in sidebar CC form, (2) command palette, (3) keyboard shortcut `Cmd+Shift+C`.

**Key files:**
- New: `src/components/blades/ConventionalCommitBlade.tsx`
- New: `src/components/blades/registrations/conventional-commit.ts`
- Modify: `src/stores/bladeTypes.ts` (add to `BladePropsMap`)
- Modify: `src/components/blades/registrations/index.ts` (add to `EXPECTED_TYPES`)
- Modify: `src/machines/navigation/navigationMachine.ts` (add to `SINGLETON_TYPES`)

### CC-02: Type selector, scope, description in wider layout

**Status: Fully covered.**

- Reuse existing `TypeSelector`, `ScopeAutocomplete`, `BreakingChangeSection`, `CharacterProgress`, `ValidationErrors` components.
- `TypeSelector` gets an optional `columns` prop (default 4 for sidebar, 6 for blade).
- `ScopeAutocomplete` dropdown can be wider in the blade to show more context (scope name + usage count + last used timestamp).
- Description input uses the existing single-line input with `CharacterProgress`.
- Body textarea is taller in the blade (8-12 rows vs 4 in sidebar).

**Key files:**
- Modify: `src/components/commit/TypeSelector.tsx` (add `columns` prop variant)
- Reuse: All other CC sub-components as-is

### CC-03: Full commit message preview

**Status: Fully covered.**

- New `CommitPreview` component with `variant: "compact" | "full"`.
- Full variant: monospace font, `whitespace-pre-wrap`, syntax highlighting by segment (type color from `COMMIT_TYPE_THEME`, scope in teal, breaking in red).
- Line-length ruler at column 72 (subtle vertical line).
- Character count for subject line.
- Copy-to-clipboard button in preview header.
- `min-h-[300px] flex-1` sizing (no `max-h-32` constraint from sidebar).
- Real-time updates (no debounce -- pure string concatenation from `buildCommitMessage()`).
- `aria-live="polite"` for screen reader announcements.

**Key files:**
- New: `src/components/commit/CommitPreview.tsx`

### CC-04: Commit and push in single workflow

**Status: Fully covered.**

- New `useCommitExecution` hook extracted from `CommitForm.tsx`, providing `commit()`, `commitAndPush()`, and `push()` methods.
- New `useCommitPipeline` hook (or integrated into `useCommitExecution`) orchestrates: commit -> push -> navigate.
- Two-stage pipeline: if commit fails, stop entirely. If push fails, commit still stands -- show persistent toast with "Retry" action.
- "Commit & Push" button in the action bar. Changes to "Amend & Force Push" in amend mode.
- `pushAfterCommit` boolean stored in `useConventionalStore` for persistence.

**Key files:**
- New: `src/hooks/useCommitExecution.ts`
- Modify: `src/components/commit/CommitForm.tsx` (consume new hook, remove local mutations)

### CC-05: Auto-navigate back after commit

**Status: Fully covered.**

- After successful commit (and optional push), show 1.5s success animation in the blade.
- Then auto-pop the blade via `goBack()` from `useBladeNavigation`.
- Reset form state via `store.reset()`.
- "Stay here" link cancels the auto-navigation timer.
- If commit succeeds but push fails, still navigate back (commit is complete); push error persists as toast.

**Key files:**
- `src/components/blades/ConventionalCommitBlade.tsx` (success state + timer logic)

### CC-06: Amend previous commit with pre-filled fields

**Status: Fully covered.**

- Toggle in blade header/toolbar area (not buried in footer).
- When toggled on: fetch last commit via `commands.getLastCommitMessage()`, parse into CC parts (type, scope, description, body, breaking).
- Parsing strategy: use `commands.validateConventionalCommit()` to check if last commit is CC-formatted. If yes, parse via regex. If no, put entire subject as description, leave type empty, show hint.
- Warning banner when amend is active: `[!] Amending previous commit: "..."` in peach/orange tones.
- Button label changes: "Commit" -> "Amend Commit", "Commit & Push" -> "Amend & Force Push".
- Confirmation dialog before amend submit.
- In blade right column: show original message above amended preview for comparison.

**Key files:**
- New: `src/hooks/useAmendPrefill.ts` (or extend store with `prefillFromLastCommit`)
- Modify: `src/stores/conventional.ts` (add amend state fields)

### CC-07: Sidebar and blade coexistence

**Status: Fully covered.**

- Both modes share `useConventionalStore` -- no state transfer needed.
- Sidebar form hides or shows "Editing in blade view" placeholder when blade is open.
- When blade is popped, sidebar form reappears with the same values.
- "Expand" button in sidebar opens the blade; Escape/Back returns to sidebar.
- Only one form's Commit button is active at a time.
- No auto-open of blade when toggling CC mode in sidebar.

**Key files:**
- Modify: `src/components/commit/CommitForm.tsx` (add "Expand" button, detect blade open state)

### CC-08: Scope frequency visualization

**Status: Fully covered.**

- New `ScopeFrequencyChart` component.
- Horizontal bar chart, pure CSS with Tailwind (no charting library).
- Data from `getScopeSuggestions(50)` -- existing command with higher limit.
- Catppuccin accent colors for bars, cycling through palette.
- Top 8-10 scopes shown; "Show all" toggle for more.
- Clickable: clicking a bar fills the scope input.
- Placed in right column, below preview, in a collapsible section.

**Key files:**
- New: `src/components/commit/ScopeFrequencyChart.tsx`
- Modify: `src/stores/conventional.ts` (add `scopeFrequencies` + `fetchScopeFrequencies`)

### CC-09: Pre-defined commit templates

**Status: Fully covered.**

- New `CommitTemplate` interface and `BUILTIN_TEMPLATES` constant.
- 6-8 built-in templates: New Feature, Bug Fix, Breaking Change, Dependency Update, Release, Initial Commit, Documentation, CI/CD.
- Horizontal chip bar at top of form, collapsing to dropdown when user starts typing.
- Clicking a template fills store fields and focuses the first empty required field.
- "Template: X" badge shown when template is active; badge removed on manual edits beyond template fields.
- User-customizable templates deferred to a future phase.

**Key files:**
- New: `src/lib/commit-templates.ts`
- New: `src/components/commit/TemplateSelector.tsx`
- Modify: `src/stores/conventional.ts` (add `activeTemplate` + `applyTemplate`)

---

## Extensibility Architecture

All three researchers emphasize extensibility. The synthesized approach combines the UX slot-based layout with the Architecture composition pattern and the Developer primitive extraction strategy.

### Slot-Based Component Architecture

The blade uses named regions (slots) that future features can plug into without restructuring:

```
+-----------------------------------------------------------------------+
| HEADER: blade title, back button, amend toggle                         |
+-----------------------------------------------------------------------+
| TOOLBAR: template chips / tab bar (future CC-F02)                      |
+-----------------------------------+-----------------------------------+
| LEFT (form)                       | RIGHT (preview + metadata)         |
|                                   |                                   |
| FORM_BEFORE_TYPE                  | RIGHT_TOP (preview)               |
| (future: AI suggestions CC-F01)  |                                   |
|                                   | RIGHT_MIDDLE (scope frequency)    |
| FORM_FIELDS                       |                                   |
| (type, scope, desc, body, break)  | RIGHT_BOTTOM (future)             |
|                                   |                                   |
| FORM_AFTER_BODY                   |                                   |
| (future: co-authors, trailers)    |                                   |
+-----------------------------------+-----------------------------------+
| FOOTER: action buttons (commit, commit+push, cancel)                   |
+-----------------------------------------------------------------------+
```

### Future Feature Mapping

| Future Feature | Slot | Effort |
|---|---|---|
| CC-F01: AI Suggestions | FORM_BEFORE_TYPE or RIGHT panel tab | Add banner/panel; fetch from AI service |
| CC-F02: Side-by-Side Tabs | TOOLBAR | Tab bar switching preview between "message" / "staged files" / "diff" |
| Co-authors | FORM_AFTER_BODY | Multi-select input for `Co-authored-by:` trailers |
| Custom footers | FORM_AFTER_BODY | Key-value inputs for arbitrary git trailers |
| Diff summary | RIGHT_BOTTOM | Compact list of changed files with stats |
| Commit signing | FOOTER | GPG/SSH signing toggle next to Commit button |
| Template editor | Settings or modal | CRUD interface for `CommitTemplate` objects |
| Emoji prefix | HEADER | Toggle that prepends emoji from `commit-type-theme` |

### State Management Extensibility

- Core form state stays in `useConventionalStore`.
- Future features add their own stores (e.g., `useCommitAIStore`, `useCommitTrailersStore`).
- The blade orchestrator composes data from multiple stores when building the final message.
- Each store is independently testable.

### Component Composition Pattern

Each section is a discrete component with well-defined props. The blade orchestrator composes them:

```typescript
function ConventionalCommitBlade({ amend }: { amend?: boolean }) {
  return (
    <BladePanel title="Conventional Commit">
      <AmendBanner />                       {/* conditional */}
      <TemplateChipBar />                   {/* TOOLBAR */}
      <SplitPaneLayout
        autoSaveId="cc-blade-split"
        primary={<CommitBladeForm />}       {/* LEFT */}
        detail={<CommitBladePreview />}     {/* RIGHT */}
      />
      <CommitBladeFooter />                 {/* FOOTER */}
    </BladePanel>
  );
}
```

This means adding a future feature is as simple as inserting a new component into the appropriate slot, without touching the other sections.

---

## Refactoring Plan (Pre-Blade Work)

Before building the blade, the following refactoring must happen to avoid code duplication and ensure both sidebar and blade share the same logic.

### Refactoring Step 1: Extract Pure Utilities

**Create `src/lib/conventional-utils.ts`:**
- `buildCommitMessage(parts: ConventionalMessageParts): string` -- extracted from `conventional.ts:158-188`
- `parseConventionalMessage(message: string): ConventionalMessageParts | null` -- replaces the duplicated regex in `layoutUtils.ts:182-187`

**Impact:**
- `src/stores/conventional.ts` delegates `buildCommitMessage` to the pure function
- `src/components/topology/layoutUtils.ts` imports `parseConventionalMessage` instead of its local `parseConventionalType`
- `src/components/icons/CommitTypeIcon.tsx` uses the shared parser

### Refactoring Step 2: Extract Commit Execution Hook

**Create `src/hooks/useCommitExecution.ts`:**
- Extracted from `CommitForm.tsx` lines 80-119
- Provides `commit()`, `commitAndPush()`, `push()` methods
- Handles React Query invalidation (`stagingStatus`, `commitHistory`, `repositoryStatus`)
- Handles toast notifications (success with "Push now" action, error with retry)

**Impact:**
- `src/components/commit/CommitForm.tsx` consumes `useCommitExecution` instead of inline mutations
- The new blade also consumes `useCommitExecution`

### Refactoring Step 3: Extract Amend Prefill Logic

**Create `src/hooks/useAmendPrefill.ts`:**
- Extracted from `CommitForm.tsx` lines 29-73
- Provides `toggleAmend()`, `prefillFromLastCommit()`, amend state
- Uses `parseConventionalMessage()` for structured pre-fill

**Impact:**
- `CommitForm.tsx` consumes `useAmendPrefill` instead of inline logic
- The new blade also consumes `useAmendPrefill`

### Refactoring Step 4: Extract UI Primitives

**Create `src/components/commit/CommitPreview.tsx`:**
- Extracted from `ConventionalCommitForm.tsx` lines 153-168 (inline preview)
- Two variants: `"compact"` (sidebar: `max-h-32`) and `"full"` (blade: `min-h-[300px] flex-1`)

**Create `src/components/commit/CommitActionBar.tsx`:**
- Extracted from `ConventionalCommitForm.tsx` lines 171-199 (inline action buttons)
- Props: `canCommit`, `isCommitting`, `onCommit`, `onCommitAndPush`, `amend`, `onToggleAmend`

**Impact:**
- `ConventionalCommitForm.tsx` uses the new primitives (visual regression test: sidebar looks identical)

### Refactoring Step 5: Extend Store

**Modify `src/stores/conventional.ts`:**
- Add: `isAmend`, `setIsAmend`, `prefillFromLastCommit`
- Add: `pushAfterCommit`, `setPushAfterCommit`
- Add: `activeTemplate`, `setActiveTemplate`, `applyTemplate`
- Add: `scopeFrequencies`, `fetchScopeFrequencies`

### Verification Gate

After all refactoring steps, the existing sidebar commit workflow must work identically. Run:
- All existing tests pass
- Manual verification: simple commit, CC commit, amend commit, push from sidebar

---

## Recommended Implementation Order

### Task 1: Extract Pure Utilities and Shared Hooks (Refactoring)

**Goal:** Decouple commit execution, amend logic, and message building from the sidebar component.

**Files to create:**
- `src/lib/conventional-utils.ts`
- `src/lib/conventional-utils.test.ts`
- `src/hooks/useCommitExecution.ts`
- `src/hooks/useCommitExecution.test.ts`
- `src/hooks/useAmendPrefill.ts`

**Files to modify:**
- `src/stores/conventional.ts` (delegate buildMessage, add amend/push/template state)
- `src/components/commit/CommitForm.tsx` (consume new hooks)
- `src/components/topology/layoutUtils.ts` (remove duplicate parser)

**Verification:** Existing sidebar commit flow works identically. All existing tests pass.

### Task 2: Extract UI Primitives (CommitPreview, CommitActionBar)

**Goal:** Create layout-agnostic components that both sidebar and blade can use.

**Files to create:**
- `src/components/commit/CommitPreview.tsx`
- `src/components/commit/CommitPreview.test.tsx`
- `src/components/commit/CommitActionBar.tsx`
- `src/components/commit/CommitActionBar.test.tsx`

**Files to modify:**
- `src/components/commit/ConventionalCommitForm.tsx` (use new primitives)
- `src/components/commit/TypeSelector.tsx` (add optional `columns` prop)

**Verification:** Sidebar CC form looks and works identically after extraction.

### Task 3: Blade Shell and Registration (CC-01, CC-02)

**Goal:** Create the blade infrastructure and render the form + preview in a two-column layout.

**Files to create:**
- `src/components/blades/ConventionalCommitBlade.tsx`
- `src/components/blades/registrations/conventional-commit.ts`

**Files to modify:**
- `src/stores/bladeTypes.ts` (add `"conventional-commit"` to `BladePropsMap`)
- `src/components/blades/registrations/index.ts` (add to `EXPECTED_TYPES`)
- `src/machines/navigation/navigationMachine.ts` (add to `SINGLETON_TYPES`)

**Verification:** Blade opens from command palette, renders form + preview in two-column layout, basic commit works.

### Task 4: Sidebar Integration and Coexistence (CC-07)

**Goal:** Add "Expand" button to sidebar, handle mutual exclusion between sidebar and blade forms.

**Files to modify:**
- `src/components/commit/CommitForm.tsx` (add Expand button, detect blade open state)
- Register keyboard shortcut (`Cmd+Shift+C`) and command palette entry

**Verification:** Expand button opens blade. Sidebar shows placeholder while blade is open. State persists when switching modes.

### Task 5: Commit+Push Pipeline and Auto-Navigate (CC-04, CC-05)

**Goal:** Wire the commit+push workflow in the blade with post-commit success animation and auto-navigation.

**Files to modify:**
- `src/components/blades/ConventionalCommitBlade.tsx` (wire pipeline, success state, auto-navigate timer)
- `src/components/commit/CommitActionBar.tsx` (Commit & Push button)

**Verification:** Commit+push executes sequentially. Success animation shows for 1.5s. Blade auto-pops to staging. Push failure shows toast with retry.

### Task 6: Amend Mode (CC-06)

**Goal:** Full amend workflow with pre-filled fields, warning banner, and confirmation.

**Files to modify:**
- `src/components/blades/ConventionalCommitBlade.tsx` (amend toggle, warning banner, original message display)
- `src/hooks/useAmendPrefill.ts` (parse last CC message into fields)
- `src/components/commit/CommitActionBar.tsx` (label changes for amend mode)

**Verification:** Toggling amend pre-fills type/scope/description/body. Warning banner visible. Button labels change. Confirmation dialog on submit.

### Task 7: Commit Preview Enhancement (CC-03)

**Goal:** Syntax highlighting, line ruler, copy button for the full preview variant.

**Files to modify:**
- `src/components/commit/CommitPreview.tsx` (syntax highlighting per segment, column-72 ruler, copy button)

**Verification:** Preview highlights type/scope/breaking in correct Catppuccin colors. Ruler visible at column 72. Copy button works.

### Task 8: Scope Frequency Chart and Templates (CC-08, CC-09)

**Goal:** Build the scope visualization and template system.

**Files to create:**
- `src/components/commit/ScopeFrequencyChart.tsx`
- `src/lib/commit-templates.ts`
- `src/components/commit/TemplateSelector.tsx`

**Verification:** Chart renders proportional bars with correct colors. Clicking a bar fills scope. Template chips visible when form is empty. Template application populates fields.

### Task 9: Blade Tests

**Goal:** Comprehensive test coverage for the blade and new components.

**Files to create:**
- `src/components/blades/ConventionalCommitBlade.test.tsx`
- `src/components/commit/ScopeFrequencyChart.test.tsx`

**Verification:** All tests pass. Coverage for: blade renders, form interaction, commit flow, amend flow, template application, scope chart rendering.

---

## Key Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Refactoring breaks existing sidebar commit flow** | HIGH | Task 1 and Task 2 are pure refactoring with verification gates. Run all existing tests + manual verification before proceeding. |
| **Shared Zustand store causes unintended side effects** | MEDIUM | The store is already shared -- both modes reading/writing the same state is the desired behavior. `reset()` is called only after successful commit, not on blade unmount. |
| **Double-commit if both sidebar and blade are active** | MEDIUM | Only one form's Commit button is active at a time. When blade is open, sidebar hides its submit controls. |
| **Amend parsing fails on non-CC commits** | LOW | Graceful degradation: put entire subject as description, leave type empty, show hint to user. Already documented in all three research docs. |
| **Push failure after successful commit** | LOW | Two-stage pipeline: commit success stands regardless of push outcome. Push error shown as persistent toast with retry. No rollback needed. |
| **Performance of scope history query on large repos** | LOW | Cache via React Query with `staleTime: 60_000`. The backend already limits to 500 commits. |
| **`bindings.ts` TS2440 pre-existing error** | LOW | Known issue (auto-generated Tauri bindings). Ignore in type checks per project memory. |
| **BladeStrip visual regression when CC blade is pushed** | LOW | Standard blade behavior -- parent blades collapse to strips. No custom work needed. |

---

## New File Summary

### New Files (12)

| File | Type | Purpose |
|---|---|---|
| `src/lib/conventional-utils.ts` | Utility | Pure functions: `buildCommitMessage`, `parseConventionalMessage` |
| `src/lib/conventional-utils.test.ts` | Test | Unit tests for pure utility functions |
| `src/lib/commit-templates.ts` | Data | `CommitTemplate` interface + `BUILTIN_TEMPLATES` constant |
| `src/hooks/useCommitExecution.ts` | Hook | Commit + push mutation logic (extracted from `CommitForm.tsx`) |
| `src/hooks/useCommitExecution.test.ts` | Test | Unit tests for commit execution hook |
| `src/hooks/useAmendPrefill.ts` | Hook | Amend mode state + pre-fill management |
| `src/components/commit/CommitPreview.tsx` | Component | Monospace preview with compact/full variants + syntax highlighting |
| `src/components/commit/CommitActionBar.tsx` | Component | Commit/push/amend action buttons |
| `src/components/commit/ScopeFrequencyChart.tsx` | Component | Horizontal bar chart for scope usage |
| `src/components/commit/TemplateSelector.tsx` | Component | Template chip bar / dropdown |
| `src/components/blades/ConventionalCommitBlade.tsx` | Blade | Full-width CC workspace (blade shell) |
| `src/components/blades/registrations/conventional-commit.ts` | Registration | Blade registration with singleton enforcement |

### Modified Files (8)

| File | Change |
|---|---|
| `src/stores/bladeTypes.ts` | Add `"conventional-commit"` to `BladePropsMap` |
| `src/stores/conventional.ts` | Delegate `buildCommitMessage` to pure utility; add amend/push/template/frequency state |
| `src/components/commit/CommitForm.tsx` | Consume `useCommitExecution` + `useAmendPrefill`; add "Expand to blade" button |
| `src/components/commit/ConventionalCommitForm.tsx` | Use extracted `CommitPreview` and `CommitActionBar` primitives |
| `src/components/commit/TypeSelector.tsx` | Add optional `columns` prop for wider blade layout |
| `src/components/blades/registrations/index.ts` | Add `"conventional-commit"` to `EXPECTED_TYPES` |
| `src/machines/navigation/navigationMachine.ts` | Add `"conventional-commit"` to `SINGLETON_TYPES` |
| `src/components/topology/layoutUtils.ts` | Replace local `parseConventionalType` with import from `conventional-utils.ts` |

### Test Files (4 additional)

| File |
|---|
| `src/components/commit/CommitPreview.test.tsx` |
| `src/components/commit/CommitActionBar.test.tsx` |
| `src/components/blades/ConventionalCommitBlade.test.tsx` |
| `src/components/commit/ScopeFrequencyChart.test.tsx` |

---

## References

- **28-RESEARCH-UX.md** -- UX patterns, layout architecture, dual-mode interaction, live preview design, amend workflow UX, scope visualization options, template presentation, post-commit flow, keyboard shortcuts, accessibility, extensibility slots
- **28-RESEARCH-ARCHITECTURE.md** -- Existing component analysis, blade registration architecture, shared logic extraction, state management design, XState integration, scope history and template data models, extensibility component tree, error handling and edge cases
- **28-RESEARCH-DEVELOPER.md** -- Complete file inventory (frontend + backend + blade infrastructure), tight coupling analysis, refactoring plan, Tauri/Rust backend analysis, blade registration design, component architecture, Tailwind v4 layout patterns, template design, testing strategy with mock patterns, performance considerations, implementation task breakdown
