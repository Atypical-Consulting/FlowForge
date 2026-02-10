# Phase 39: Conventional Commits Extraction - UX Research

**Researched:** 2026-02-10
**Domain:** UX flows, form patterns, graceful degradation, accessibility, extension UI contribution
**Confidence:** HIGH
**Researcher:** UX & Graceful Degradation Specialist

---

## 1. Executive Summary

Phase 39 extracts the Conventional Commits (CC) subsystem from the FlowForge core into a toggleable built-in extension. The CC subsystem currently lives across **25+ files** spanning blades, components, hooks, stores, utilities, and command registrations. The extraction must preserve the existing CC UX while ensuring that when the extension is disabled, users can still commit via a plain textarea -- the same simple commit form that already exists in `CommitForm.tsx`.

**Key insight:** Unlike Phase 38's content-viewer extraction (where fallback meant showing raw text), the CC extraction's degradation is simpler: the `CommitForm` component already has a dual-mode design with a `useConventional` toggle. When CC is disabled, only the simple textarea path is available. The primary challenge is making the CC toggle checkbox, the CC blade, the CC sidebar form, and the changelog blade all conditional on the extension being active.

**Primary recommendation:** Create `src/extensions/conventional-commits/index.ts` as a built-in extension that registers the CC blade, CC sidebar panel (or replaces the commit form's CC mode), changelog blade, toolbar actions, and commands via ExtensionAPI. The `CommitForm` component becomes the stable core with a hook into the extension system to conditionally render the CC toggle and inline form.

---

## 2. Current CC UX Inventory

### 2.1 Complete File Inventory

**Blades (full-page views):**
| File | Purpose | Lines |
|------|---------|-------|
| `src/blades/conventional-commit/ConventionalCommitBlade.tsx` | Full CC composer blade with split-pane (form + preview) | 363 |
| `src/blades/conventional-commit/registration.ts` | Core blade registration (type: "conventional-commit", singleton) | 17 |
| `src/blades/conventional-commit/index.ts` | Barrel export | 1 |
| `src/blades/conventional-commit/hooks/useBladeFormGuard.ts` | Dirty-form navigation guard (generic, reusable) | 37 |
| `src/blades/changelog/ChangelogBlade.tsx` | Changelog generator blade (from/to ref + preview) | 116 |
| `src/blades/changelog/registration.ts` | Core blade registration (type: "changelog", singleton) | 9 |
| `src/blades/changelog/store.ts` | Changelog state (fromRef, toRef, version, generate) | 81 |
| `src/blades/changelog/components/ChangelogPreview.tsx` | Changelog markdown preview with group breakdown | 121 |
| `src/blades/changelog/index.ts` | Barrel export | 1 |

**Sidebar Components (embedded in commit form area):**
| File | Purpose | Lines |
|------|---------|-------|
| `src/components/commit/CommitForm.tsx` | **THE HUB** -- dual-mode commit form (simple textarea + CC inline) | 226 |
| `src/components/commit/ConventionalCommitForm.tsx` | Inline CC form for sidebar (compact version of blade) | 166 |
| `src/components/commit/TypeSelector.tsx` | 4/6-column grid of CC type buttons with suggestion banner | 84 |
| `src/components/commit/ScopeAutocomplete.tsx` | Scope input with autocomplete dropdown + inferred scope | 205 |
| `src/components/commit/BreakingChangeSection.tsx` | Breaking change checkbox + description textarea | 54 |
| `src/components/commit/CharacterProgress.tsx` | Animated character count progress bar | 52 |
| `src/components/commit/ValidationErrors.tsx` | Error/warning/success validation display | 70 |
| `src/components/commit/CommitPreview.tsx` | Commit message preview (compact + full variants) | 197 |
| `src/components/commit/CommitActionBar.tsx` | Commit/push/amend/cancel action buttons | 108 |
| `src/components/commit/TemplateSelector.tsx` | Quick-start template chip selector | 87 |
| `src/components/commit/ScopeFrequencyChart.tsx` | Scope usage histogram (blade-only) | 123 |
| `src/components/commit/index.ts` | Barrel exports | 6 |
| `src/components/icons/CommitTypeIcon.tsx` | CC type icon with auto-color (used in topology graph too) | 41 |

**Hooks:**
| File | Purpose | Lines |
|------|---------|-------|
| `src/hooks/useConventionalCommit.ts` | CC form state management hook (wraps store) | 183 |
| `src/hooks/useCommitExecution.ts` | Commit/push mutations (shared between simple + CC) | 85 |
| `src/hooks/useAmendPrefill.ts` | Amend mode with CC message parsing | 118 |

**Stores:**
| File | Purpose | Lines |
|------|---------|-------|
| `src/stores/conventional.ts` | CC Zustand store (form state, suggestions, validation, templates) | 242 |

**Utilities:**
| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/conventional-utils.ts` | buildCommitMessage() + parseConventionalMessage() | 113 |
| `src/lib/conventional-utils.test.ts` | Tests for conventional utils | -- |
| `src/lib/commit-type-theme.ts` | CC type icon/color/badge theme map (COMMIT_TYPE_THEME) | 155 |
| `src/lib/commit-templates.ts` | Built-in CC templates (7 templates) | 58 |

**Commands/Toolbar:**
| File | Reference | Purpose |
|------|-----------|---------|
| `src/commands/toolbar-actions.ts:282-293` | `tb:changelog` | Changelog toolbar button |
| `src/commands/repository.ts:50-59` | `generate-changelog` | Changelog command palette entry |

**Type/Navigation References:**
| File | Reference | Purpose |
|------|-----------|---------|
| `src/stores/bladeTypes.ts:30` | `"conventional-commit": { amend?: boolean }` | Blade type definition |
| `src/blades/_discovery.ts:20` | `"conventional-commit"` in EXPECTED_TYPES | Registration check |
| `src/machines/navigation/guards.ts:13` | `"conventional-commit"` in singleton set | Singleton guard |

### 2.2 Dependency Graph

```
CommitForm.tsx (THE HUB - lives in left sidebar panel)
  |-- [CC toggle checkbox] --> shows/hides CC mode
  |-- [CC blade expand btn] --> openBlade("conventional-commit")
  |-- [simple mode] --> textarea + useCommitExecution + useAmendPrefill
  |-- [CC mode] --> <ConventionalCommitForm>
  |                   |-- useConventionalCommit (hook)
  |                   |     |-- useConventionalStore (zustand store)
  |                   |     |     |-- commands.suggestCommitType()   [Rust]
  |                   |     |     |-- commands.getScopeSuggestions() [Rust]
  |                   |     |     |-- commands.inferScopeFromStaged() [Rust]
  |                   |     |     |-- commands.validateConventionalCommit() [Rust]
  |                   |     |     |-- buildCommitMessage() [conventional-utils.ts]
  |                   |     |
  |                   |-- <TypeSelector>        (COMMIT_TYPE_THEME, COMMIT_TYPES)
  |                   |-- <ScopeAutocomplete>   (ScopeSuggestion from Rust)
  |                   |-- <BreakingChangeSection>
  |                   |-- <CharacterProgress>
  |                   |-- <ValidationErrors>    (ValidationResult from Rust)
  |                   |-- <CommitPreview>        (parseConventionalMessage)
  |                   |-- <CommitActionBar>      (shared with blade)
  |
ConventionalCommitBlade.tsx (FULL BLADE - in blade stack)
  |-- All of above PLUS:
  |-- <TemplateSelector>    (BUILTIN_TEMPLATES)
  |-- <ScopeFrequencyChart> (scope histogram)
  |-- <SplitPaneLayout>     (form | preview)
  |-- useBladeFormGuard     (dirty navigation guard)
  |-- useAmendPrefill       (amend mode)
  |
ChangelogBlade.tsx (SEPARATE BLADE)
  |-- useChangelogStore
  |     |-- commands.generateChangelogCmd() [Rust]
  |-- <ChangelogPreview>
  |     |-- <CommitTypeIcon>  (COMMIT_TYPE_THEME)
  |
CommitTypeIcon.tsx (SHARED - used in topology graph + changelog)
  |-- COMMIT_TYPE_THEME
  |-- parseConventionalType() [from layoutUtils.ts]
```

### 2.3 Shared vs. CC-Only Boundaries

**Shared (must remain in core):**
- `useCommitExecution` -- used by simple commit form too
- `useAmendPrefill` -- has both simple and CC modes
- `CommitActionBar` -- used by both simple (via Button) and CC forms
- `CommitTypeIcon` -- used in topology graph (commit badges), not just CC
- `parseConventionalMessage` / `parseConventionalType` -- used in topology graph layout
- `COMMIT_TYPE_THEME` -- used in topology graph commit badges
- `useBladeFormGuard` -- generic hook, not CC-specific

**CC-only (can move to extension):**
- `ConventionalCommitBlade` + registration
- `ConventionalCommitForm`
- `TypeSelector`
- `ScopeAutocomplete`
- `BreakingChangeSection`
- `CharacterProgress`
- `ValidationErrors`
- `CommitPreview` (compact + full variants)
- `TemplateSelector`
- `ScopeFrequencyChart`
- `useConventionalCommit` hook
- `useConventionalStore` (Zustand store)
- `buildCommitMessage` utility
- `BUILTIN_TEMPLATES`
- `ChangelogBlade` + store + components
- Changelog toolbar action + command

**Nuance:** `CommitTypeIcon` and `COMMIT_TYPE_THEME` are used by the topology graph's `CommitBadge`. If the CC extension is disabled, should commit badges in the graph still show type-specific icons? **Recommendation: YES.** These are display-only utilities that interpret existing commit messages -- they don't create CC commits. They should remain in core.

---

## 3. User Interaction Flows

### 3.1 Flow A: Simple Commit (No CC)

```
1. User stages files in left sidebar
2. User sees CommitForm at bottom of sidebar
3. "Conventional Commits" checkbox is UNCHECKED
4. User types message in plain textarea
5. Character counter shows subject line length (0-50 good, 51-72 warning, 73+ error)
6. User clicks "Commit" button (or "Amend Commit" if amend toggled)
7. useCommitExecution fires createCommit mutation
8. Toast: "Committed: <short message>" with "Push now" action
9. Textarea clears, form resets
```

**Source:** `src/components/commit/CommitForm.tsx:127-222`

### 3.2 Flow B: CC Inline Commit (Sidebar)

```
1. User stages files in left sidebar
2. User sees CommitForm at bottom of sidebar
3. User checks "Conventional Commits" checkbox -> useConventional=true
4. CC inline form appears (scrollable, max-h-[60vh]):
   a. TypeSelector: 4-column grid of 11 type buttons
   b. ScopeAutocomplete: text input with autocomplete dropdown
   c. Description: text input with CharacterProgress (72 char max)
   d. Body: textarea (4 rows)
   e. BreakingChangeSection: checkbox + conditional textarea
   f. ValidationErrors: debounced Rust validation feedback
   g. CommitPreview (compact): monospace preview of built message
   h. CommitActionBar: Commit + Cancel buttons
5. User fills form, canCommit becomes true when:
   - commitType is set AND
   - description is non-empty AND
   - validation.isValid AND
   - (if isBreaking, breakingDescription is non-empty)
6. User clicks Commit -> onCommit(currentMessage) -> parent CommitForm handles
7. Form resets via reset()
```

**Source:** `src/components/commit/ConventionalCommitForm.tsx`, `src/components/commit/CommitForm.tsx:103-126`

### 3.3 Flow C: CC Full Blade

```
1. User checks "Conventional Commits" checkbox in sidebar
2. User clicks expand (Maximize2) icon next to toggle
3. openBlade("conventional-commit", {}, "Conventional Commit") called
4. CC blade opens in blade stack with SplitPaneLayout:
   LEFT PANEL (55% default):
     a. TemplateSelector: quick-start chips (when form empty) or active badge
     b. TypeSelector: 6-column grid (wider than sidebar's 4-column)
     c. ScopeAutocomplete
     d. Description + CharacterProgress
     e. Body (8 rows, taller than sidebar's 4)
     f. BreakingChangeSection
     g. ValidationErrors
   RIGHT PANEL (45% default):
     a. CommitPreview (full variant with syntax highlighting + 72-char ruler)
     b. ScopeFrequencyChart (collapsible scope usage histogram)
5. Amend toggle header at top (checkbox + warning banner)
6. CommitActionBar in sticky footer with Commit + Commit & Push buttons
7. Success overlay with check animation + "Stay here" link
8. Auto-navigate back after 1.5s on success (unless "Stay here" clicked)
9. Dirty form guard: navigating away while form has content triggers confirmation
```

**While blade is open:**
- Sidebar CommitForm shows "Editing in blade view" placeholder
- isCCBladeOpen check: `bladeStack.some(b => b.type === "conventional-commit")`

**Source:** `src/blades/conventional-commit/ConventionalCommitBlade.tsx`, `src/components/commit/CommitForm.tsx:104-108`

### 3.4 Flow D: Changelog Generation

```
1. User opens changelog via toolbar button (tb:changelog) or command palette (generate-changelog)
2. ChangelogBlade opens with options form:
   a. From ref (tag/commit, optional)
   b. To ref (defaults to HEAD)
   c. Version label (optional, for header)
3. User clicks "Generate Changelog"
4. Rust command generateChangelogCmd() runs
5. ChangelogPreview shows:
   a. Stats: commit count + group count
   b. Copy to clipboard button
   c. Markdown preview in monospace pre
   d. Group breakdown: CommitTypeIcon grid + detailed commit list per group
6. User can "Generate Another" (reset form) or "Done" (reset + goBack)
```

**Source:** `src/blades/changelog/ChangelogBlade.tsx`, `src/blades/changelog/store.ts`

### 3.5 Flow E: Amend Mode

```
Simple amend:
1. User checks "Amend last commit" checkbox in sidebar
2. useAmendPrefill fetches last commit message
3. If form has content -> confirmation dialog
4. Textarea pre-filled with previous commit message
5. Commit button shows "Amend Commit" with RotateCcw icon
6. On click -> confirmation dialog: "Amend will rewrite the last commit"
7. createCommit(message, amend=true)

CC amend (blade):
1. Blade opened with amend=true prop, or user toggles amend checkbox in blade header
2. useAmendPrefill.prefillConventional() parses last commit into CC fields
3. If last commit was CC format -> individual fields populated (type, scope, desc, body, breaking)
4. If last commit was NOT CC format -> subject goes to description, other fields empty
5. Warning banner: "Amending previous commit: <original subject>"
6. Original message shown in right panel with strikethrough
7. Commit & Push becomes "Amend & Force Push"
```

**Source:** `src/hooks/useAmendPrefill.ts`, `src/blades/conventional-commit/ConventionalCommitBlade.tsx:100-137`

---

## 4. Graceful Degradation Design

### 4.1 Design Principle

When the CC extension is disabled, the commit experience degrades to a **plain textarea** -- which is the existing simple commit form. This is not a "degraded" experience but rather the **foundational commit UX** that existed before CC was added. The key is that the CC toggle, CC inline form, CC blade, and changelog functionality all become unavailable, while the simple commit path remains fully functional.

### 4.2 What Changes When CC Extension is Disabled

| Feature | Extension Active | Extension Disabled |
|---------|-----------------|-------------------|
| CC toggle checkbox in sidebar | Visible | **Hidden** |
| CC expand-to-blade button | Visible (when CC toggled on) | **Hidden** |
| Inline CC form in sidebar | Available (when CC toggled on) | **Hidden** |
| CC full blade | Can be opened | **Cannot be opened; shows fallback if already open** |
| Changelog blade | Can be opened | **Cannot be opened; shows fallback if already open** |
| Changelog toolbar button | Visible | **Hidden** |
| Changelog command | Available in palette | **Hidden from palette** |
| Simple textarea commit form | Always available | **Always available (only option)** |
| Commit execution (commit/push) | Works | **Works (unchanged)** |
| Amend mode (simple) | Works | **Works (unchanged)** |
| Amend mode (CC prefill) | Works | **Unavailable (simple amend still works)** |
| CommitTypeIcon in topology graph | Shows CC type icons | **Still shows CC type icons (core utility)** |
| CC type badges in commit details | Show type colors | **Still show type colors (core utility)** |

### 4.3 CommitForm Degradation (The Critical Path)

The `CommitForm` component at `src/components/commit/CommitForm.tsx` is the primary integration point. Currently it has:

```tsx
// Current: always shows CC toggle
<label className="flex items-center gap-2 text-xs text-ctp-overlay1 cursor-pointer">
  <input type="checkbox" checked={useConventional} onChange={...} />
  Conventional Commits
</label>
```

**After extraction, this becomes conditional:**

```tsx
// After: CC toggle only shown when extension is active
{isCCExtensionActive && (
  <label className="flex items-center gap-2 text-xs text-ctp-overlay1 cursor-pointer">
    <input type="checkbox" checked={useConventional} onChange={...} />
    Conventional Commits
  </label>
)}
```

**Detection mechanism:** The CommitForm needs to know whether the CC extension is active. Two approaches:

**Approach A: Check extension host directly**
```tsx
const isCCActive = useExtensionHost(
  (s) => s.extensions.get("conventional-commits")?.status === "active"
);
```

**Approach B: Check if CC blade type is registered (decoupled)**
```tsx
const isCCRegistered = !!getBladeRegistration("conventional-commit");
// Or via a registrationTick in bladeRegistry for reactivity
```

**Recommendation:** Approach B is more decoupled -- CommitForm doesn't need to know about extension IDs, just whether CC capabilities exist. However, it requires a reactive mechanism to re-render when blades are registered/unregistered. The simplest solution is Approach A since it uses existing reactive state.

### 4.4 Sidebar Layout When CC is Disabled

**Current layout (CC enabled, toggle OFF):**
```
+---------------------------+
| Commit                    |
| [  ] Conventional Commits |
+---------------------------+
| [textarea: Commit msg...] |
|                           |
| [  ] Amend  |  chars: 0/50|
| [        Commit          ]|
+---------------------------+
```

**Layout when CC extension is disabled:**
```
+---------------------------+
| Commit                    |
+---------------------------+
| [textarea: Commit msg...] |
|                           |
| [  ] Amend  |  chars: 0/50|
| [        Commit          ]|
+---------------------------+
```

The only visual difference is the absence of the "Conventional Commits" checkbox row. The rest of the simple commit form is identical. This is a clean, non-jarring degradation.

### 4.5 Already-Open CC Blades When Extension is Disabled

If the user has the CC blade or changelog blade open and then disables the CC extension:

1. Extension deactivation calls `api.cleanup()` which unregisters the blade types
2. The blade instance remains on the navigation stack (XState doesn't know about extensions)
3. `BladeRenderer` attempts to look up the blade type, finds no registration
4. **Current behavior:** Shows "Unknown blade: conventional-commit" in red (from BladeRenderer fallback)

**Recommended behavior (aligns with Phase 38 pattern):**
- Show an informational message: "This feature requires the Conventional Commits extension."
- Provide a button: "Enable in Extension Manager" that opens the extension manager blade
- Do NOT auto-close the blade (user might re-enable the extension)
- If user navigates back, the stale blade is naturally removed from the stack

**Note:** This is the same pattern as Phase 38's viewer blade orphaning. If Phase 38 already improved `BladeRenderer` with a graceful fallback for unregistered extension blades, Phase 39 benefits automatically.

### 4.6 The `useConventional` State Persistence Issue

When the CC extension is disabled, if the user had `useConventional=true` in `CommitForm`, two things must happen:
1. The CC toggle UI is hidden
2. `useConventional` should be forced to `false` so the simple form renders

**Implementation:** CommitForm should have an effect:
```tsx
useEffect(() => {
  if (!isCCExtensionActive && useConventional) {
    setUseConventional(false);
  }
}, [isCCExtensionActive, useConventional]);
```

This ensures that when the extension is disabled mid-session, the form seamlessly falls back to simple mode without user action.

---

## 5. Transition Experience

### 5.1 Extension Enable Transition (disabled -> active)

1. User opens Extension Manager blade
2. User toggles ON the "Conventional Commits" extension
3. `activateExtension("conventional-commits")` runs
4. Extension's `onActivate(api)` registers:
   - CC blade type ("conventional-commit" with `coreOverride: true`)
   - Changelog blade type ("changelog" with `coreOverride: true`)
   - Toolbar action for changelog
   - Command palette entries
   - Sidebar panel contribution (or hook-based CC toggle enablement)
5. Toast: "Conventional Commits enabled"
6. CommitForm re-renders: CC toggle checkbox appears
7. User can now check the toggle to access CC features
8. No blades auto-open -- user must explicitly opt in

**Key UX principle:** Enabling the extension makes the CC toggle available but does NOT force the user into CC mode. The user's workflow is uninterrupted.

### 5.2 Extension Disable Transition (active -> disabled)

1. User opens Extension Manager blade
2. User toggles OFF the "Conventional Commits" extension
3. `deactivateExtension("conventional-commits")` runs
4. Extension's `onDeactivate()` called for custom cleanup
5. `api.cleanup()` unregisters all CC blade types, toolbar actions, commands
6. Toast: "Conventional Commits disabled -- using simple commit form"
7. CommitForm re-renders:
   - CC toggle checkbox disappears
   - If `useConventional` was true, auto-resets to false
   - Simple textarea form is shown
8. Any open CC or changelog blades show graceful fallback message
9. User's staged files are unaffected -- they can commit immediately with simple form

**Key UX principle:** Disabling the extension never blocks the commit workflow. The user can always commit via the simple form.

### 5.3 Mid-Form Toggle Scenario

The most delicate scenario: user is filling out the CC form in the sidebar, then the extension is disabled (either by another window or programmatically).

**What happens:**
1. `useConventional` auto-resets to false (via effect)
2. CC inline form unmounts, simple textarea appears
3. The CC form state in `useConventionalStore` is NOT cleared (store still exists)
4. If the extension is re-enabled, the store state is still present
5. However, the currentMessage is lost because it was only in the hook, not persisted

**Recommendation:** Accept this as an edge case. The user is actively in Extension Manager disabling things, so they expect changes. The simple commit form appears empty, which is the clean starting point.

---

## 6. Form Patterns Deep Dive

### 6.1 CC Form Fields

| Field | Type | Required | Validation | Component |
|-------|------|----------|------------|-----------|
| Type | Select (11 options) | Yes | Must be selected | `TypeSelector` |
| Scope | Text with autocomplete | No | Free text, suggestions from Rust | `ScopeAutocomplete` |
| Description | Text input | Yes | Non-empty, max 72 chars | Native `<input>` + `CharacterProgress` |
| Body | Textarea | No | Free text | Native `<textarea>` |
| Breaking Change | Checkbox + textarea | Conditional | If checked, description required | `BreakingChangeSection` |

### 6.2 Validation Flow

```
User types -> description changes
  -> useConventionalCommit.useEffect triggers
  -> debouncedValidate(currentMessage) [300ms debounce]
  -> useConventionalStore.validateMessage(message)
  -> commands.validateConventionalCommit(message) [Rust IPC]
  -> set({ validation: result, isValidating: false })
  -> ValidationErrors component renders errors/warnings/success
```

**Validation states:**
- **isValidating=true:** "Validating..." pulse animation
- **errors.length > 0:** Red error boxes with message + suggestion
- **warnings.length > 0:** Yellow warning boxes
- **isValid=true, no errors:** Green success: "Valid conventional commit"
- **null (no validation yet):** Nothing rendered

### 6.3 Suggestion System

Three independent suggestion flows, all from Rust backend:

1. **Type Suggestion:** `commands.suggestCommitType()` analyzes staged files. If confidence is "high", auto-selects the type. Otherwise shows a banner: "Suggested: **feat** (medium)" with "Apply" button.

2. **Scope Suggestions:** `commands.getScopeSuggestions(20)` returns top 20 scopes by usage frequency. Displayed as autocomplete dropdown on focus, filtered by typed query.

3. **Inferred Scope:** `commands.inferScopeFromStaged()` analyzes staged file paths. If a scope is inferred, shows banner: "Inferred from files: **auth**" with "Apply" button. Auto-applies if scope field is empty.

### 6.4 Template System

7 built-in templates defined in `src/lib/commit-templates.ts`:
- New Feature, Bug Fix, Breaking Change, Dependency Update, Documentation, Refactor, CI/CD
- Each template pre-fills commitType, optionally scope, description prefix, and breaking change state
- Template chips shown when form is empty, replaced by badge when applied
- Templates are blade-only (not in sidebar compact form)

### 6.5 Commit Message Construction

```typescript
// From conventional-utils.ts
buildCommitMessage({ commitType, scope, description, body, isBreaking, breakingDescription })
// Returns: "type(scope)!: description\n\nbody\n\nBREAKING CHANGE: breakingDescription"
```

The `currentMessage` is computed on every render by `buildCommitMessage()` -- it's not stored. The preview updates live.

---

## 7. Accessibility Analysis

### 7.1 Current Accessibility State

**Good practices already in place:**
- `CommitPreview` uses `aria-live="polite"` for live message preview updates
- All form fields have `<label>` elements (though some are siblings, not wrapping)
- Focus ring styles: `focus:ring-1 focus:ring-ctp-blue` on all inputs
- Keyboard navigation in `ScopeAutocomplete`: ArrowUp/Down for dropdown, Enter to select, Escape to close
- `ShortcutTooltip` on amend toggle provides keyboard shortcut context
- `Button` components are actual `<button>` elements with proper disabled states

**Accessibility gaps:**
| Issue | Severity | Location | Fix |
|-------|----------|----------|-----|
| TypeSelector buttons lack `aria-pressed` state | Medium | `TypeSelector.tsx:63-79` | Add `aria-pressed={isSelected}` |
| TypeSelector has no group label (`role="group"`) | Low | `TypeSelector.tsx:52-82` | Add `role="group" aria-label="Commit type"` |
| ScopeAutocomplete dropdown lacks `role="listbox"` | Medium | `ScopeAutocomplete.tsx:178-202` | Add `role="listbox"` to `<ul>`, `role="option"` to `<li>` |
| ScopeAutocomplete input lacks `aria-expanded` / `aria-activedescendant` | Medium | `ScopeAutocomplete.tsx:161-175` | Add ARIA attrs for combobox pattern |
| CharacterProgress has no accessible label | Low | `CharacterProgress.tsx:32-51` | Add `aria-label="N characters remaining"` |
| ValidationErrors icons are decorative emoji without `aria-hidden` | Low | `ValidationErrors.tsx:33,55` | Add `aria-hidden="true"` or use Lucide icons |
| BreakingChangeSection checkbox has no `id`/`htmlFor` association | Low | `BreakingChangeSection.tsx:18-28` | Uses wrapping label (acceptable) |
| CC toggle in CommitForm has no accessible description of what it does | Low | `CommitForm.tsx:79-86` | Add `aria-describedby` with explanation |
| Template chips have `title` but no `aria-label` when icon is present | Low | `TemplateSelector.tsx:53-67` | Title attribute is accessible |

### 7.2 Accessibility in Degraded State

When CC extension is disabled:
- The simple commit form is already accessible: `<textarea>` with placeholder, `<button>` for commit
- The subject length counter uses Tailwind color classes (color alone conveys meaning) -- **should also have text indication** (already has: "suggested max" / "too long" text)
- Amend toggle has `ShortcutTooltip` with keyboard shortcut
- Screen reader users will notice the CC toggle disappearing -- **no announcement needed** since they didn't invoke the change (it's a settings change, not a page navigation)

### 7.3 Recommendations for Phase 39

1. **When hiding the CC toggle on extension disable**, do NOT use `display:none` with a delayed animation. Use a clean conditional render `{isCCActive && ...}` so the DOM element is either there or not.

2. **The extension-contributed CC sidebar panel** should announce itself to screen readers on first appearance. Use `aria-live="polite"` region or let React's focus management handle it.

3. **Keyboard shortcuts** for the CC blade (if any are registered by the extension) should be unregistered when the extension is disabled. This is automatic via `api.cleanup()` removing registered commands.

---

## 8. Extension UI Contribution Design

### 8.1 How Should the CC Extension Register Its UI?

The CC extension needs to contribute UI in three distinct areas:

**Area 1: Blade Registration**
- Register `conventional-commit` blade type with `coreOverride: true`
- Register `changelog` blade type with `coreOverride: true`
- This follows the exact pattern from Phase 38's content-viewers extension

**Area 2: Sidebar Commit Form Enhancement**
This is the novel challenge. The CC extension needs to conditionally add the CC toggle and inline form to the `CommitForm` component. Three approaches:

**Option A: Extension contributes sidebar panel (recommended)**
- Use `api.contributeSidebarPanel()` to register a CC panel below the staging panel
- The CC panel replaces or augments the commit form
- CommitForm remains a core component that handles simple commits
- CC sidebar panel handles CC-mode commits

**Problem with Option A:** The current architecture has CommitForm embedded directly in `RepositoryView.tsx:220`, not as a registered sidebar panel. Splitting it would require refactoring the layout.

**Option B: Feature flag / capability check in CommitForm (simpler)**
- CommitForm checks whether the CC blade type is registered
- If registered, shows the CC toggle and inline form (lazy-loading the CC components)
- If not registered, shows only the simple form
- The CC extension registers the blade types; CommitForm uses blade registry presence as a capability signal

**Problem with Option B:** CommitForm would still statically import CC components (ConventionalCommitForm, etc). These imports would fail if files are moved to the extension.

**Option C: Slot-based injection (cleanest separation)**
- CommitForm defines a "slot" for extension-contributed UI
- The CC extension registers a sidebar slot contribution via ExtensionAPI
- CommitForm renders the slot content if present, otherwise renders simple form

**Recommendation: Option B with lazy imports.** CommitForm conditionally renders the CC UI using `React.lazy()` and `import()`. The CC components stay in `src/components/commit/` (they're just code, not registrations). The extension's `onActivate` registers the blade types. CommitForm checks for blade registration presence to decide whether to show the CC toggle.

This means:
- CC component files can stay in `src/components/commit/` initially
- CommitForm uses dynamic import: `const CCForm = lazy(() => import('./ConventionalCommitForm'))`
- The CC toggle visibility is gated by `getBladeRegistration("conventional-commit") !== undefined`
- When the extension is disabled, the lazy import never triggers, no CC code loads

**Area 3: Toolbar and Commands**
- Register `tb:changelog` toolbar action via `api.contributeToolbar()`
- Register `generate-changelog` command via `api.registerCommand()`
- These follow the exact pattern from the GitHub extension

### 8.2 Extension onActivate Entry Point

```typescript
// src/extensions/conventional-commits/index.ts
import { lazy } from "react";
import type { ExtensionAPI } from "../ExtensionAPI";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy blade component imports
  const ConventionalCommitBlade = lazy(() =>
    import("../../blades/conventional-commit/ConventionalCommitBlade")
      .then(m => ({ default: m.ConventionalCommitBlade }))
  );
  const ChangelogBlade = lazy(() =>
    import("../../blades/changelog/ChangelogBlade")
      .then(m => ({ default: m.ChangelogBlade }))
  );

  // Register blades with coreOverride to keep existing blade type names
  api.registerBlade({
    type: "conventional-commit",
    title: "Conventional Commit",
    component: ConventionalCommitBlade,
    lazy: true,
    singleton: true,
    coreOverride: true,
  });

  api.registerBlade({
    type: "changelog",
    title: "Generate Changelog",
    component: ChangelogBlade,
    lazy: true,
    singleton: true,
    coreOverride: true,
  });

  // Register toolbar action for changelog
  api.contributeToolbar({
    id: "changelog",
    label: "Changelog",
    icon: FileText,  // from lucide-react
    group: "views",
    priority: 40,
    when: () => !!useRepositoryStore.getState().repoStatus,
    execute: () => openBlade("changelog", {}),
  });

  // Register command palette entries
  api.registerCommand({
    id: "generate-changelog",
    title: "Generate Changelog",
    description: "Generate a changelog from conventional commits",
    category: "Repository",
    icon: FileText,
    action: () => openBlade("changelog", {}),
    enabled: () => !!useRepositoryStore.getState().repoStatus,
  });

  api.registerCommand({
    id: "open-cc-blade",
    title: "Open Conventional Commit Composer",
    category: "Commit",
    action: () => openBlade("conventional-commit", {}),
    enabled: () => !!useRepositoryStore.getState().repoStatus,
  });
}

export function onDeactivate(): void {
  // Cleanup is automatic via api.cleanup()
  // Blade registrations, toolbar actions, and commands are all removed
}
```

### 8.3 CommitForm Integration Point

```typescript
// src/components/commit/CommitForm.tsx -- modified
import { getBladeRegistration } from "../../lib/bladeRegistry";

export function CommitForm() {
  // Check if CC blade is registered (signals CC extension is active)
  const isCCAvailable = !!getBladeRegistration("conventional-commit");

  // Auto-disable CC mode when extension is disabled
  useEffect(() => {
    if (!isCCAvailable && useConventional) {
      setUseConventional(false);
    }
  }, [isCCAvailable]);

  return (
    <div className="border-t border-ctp-surface0 p-3 bg-ctp-crust">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-ctp-subtext1">Commit</span>
        {isCCAvailable && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-ctp-overlay1 cursor-pointer">
              <input type="checkbox" checked={useConventional} onChange={...} />
              Conventional Commits
            </label>
            {/* Expand to blade button */}
          </div>
        )}
      </div>
      {/* Rest unchanged -- CC inline form or simple textarea */}
    </div>
  );
}
```

**Reactivity concern:** `getBladeRegistration()` is a synchronous read from a Map. It won't trigger re-renders. To make CommitForm reactive to blade registration changes, two options:

1. **Use extension host state (simple):**
   ```tsx
   const isCCAvailable = useExtensionHost(
     s => s.extensions.get("conventional-commits")?.status === "active"
   );
   ```

2. **Add registrationTick to bladeRegistry (more decoupled):**
   ```tsx
   const tick = useBladeRegistry(s => s.registrationTick);
   const isCCAvailable = useMemo(() => !!getBladeRegistration("conventional-commit"), [tick]);
   ```

**Recommendation:** Option 1 for simplicity. The coupling to extension ID is acceptable since this is a built-in extension with a stable ID.

---

## 9. What Stays in Core vs. Moves to Extension

### 9.1 Core (Always Available)

| Item | Reason |
|------|--------|
| `CommitForm.tsx` (simple mode) | Foundational commit UX |
| `useCommitExecution.ts` | Used by simple commit |
| `useAmendPrefill.ts` (simple mode) | Used by simple commit |
| `CommitActionBar.tsx` | Used by simple commit's Button |
| `CommitTypeIcon.tsx` | Used by topology graph |
| `COMMIT_TYPE_THEME` | Used by topology graph |
| `parseConventionalMessage()` | Used by topology graph layout |
| `parseConventionalType()` | Used by topology graph layout |
| `useBladeFormGuard.ts` | Generic hook, not CC-specific |
| `createBladeStore.ts` | Generic store factory |

### 9.2 Extension (Removed When Disabled)

| Item | Extraction Method |
|------|-------------------|
| `ConventionalCommitBlade` + registration | Move registration to extension `onActivate`; keep component in place |
| `ChangelogBlade` + registration + store | Move registration to extension `onActivate`; keep component in place |
| `ConventionalCommitForm` | Lazy-loaded from CommitForm; unreachable when extension disabled |
| `TypeSelector` | Imported by CC forms only |
| `ScopeAutocomplete` | Imported by CC forms only |
| `BreakingChangeSection` | Imported by CC forms only |
| `CharacterProgress` | Imported by CC forms only |
| `ValidationErrors` | Imported by CC forms only |
| `CommitPreview` | Imported by CC forms only |
| `TemplateSelector` | Imported by CC blade only |
| `ScopeFrequencyChart` | Imported by CC blade only |
| `useConventionalCommit` hook | Used by CC forms only |
| `useConventionalStore` | Used by CC hook only |
| `buildCommitMessage` | Used by CC store only |
| `BUILTIN_TEMPLATES` | Used by TemplateSelector only |
| `tb:changelog` toolbar action | Contributed by extension |
| `generate-changelog` command | Contributed by extension |

### 9.3 File Location Strategy

**Recommended: Keep files in place, change registration.**

The CC component files (`src/components/commit/*.tsx`, `src/blades/conventional-commit/*.tsx`, `src/blades/changelog/*.tsx`) can remain in their current locations. The extension extraction is about **registration** not **file location**. The extension's `onActivate` registers the blade types; the components are lazy-imported from their existing paths.

This follows the Phase 38 pattern where `ViewerMarkdownBlade` stayed in `src/blades/viewer-markdown/` but its registration moved from `registration.ts` to the content-viewers extension's `onActivate`.

**What changes:**
1. Remove `src/blades/conventional-commit/registration.ts` (side-effect registration)
2. Remove `src/blades/changelog/registration.ts` (side-effect registration)
3. Remove "conventional-commit" and "changelog" from `_discovery.ts` EXPECTED_TYPES
4. Remove `tb:changelog` from `src/commands/toolbar-actions.ts`
5. Remove `generate-changelog` from `src/commands/repository.ts`
6. Add `src/extensions/conventional-commits/index.ts`
7. Register built-in extension in `App.tsx` via `registerBuiltIn()`
8. Modify `CommitForm.tsx` to conditionally render CC toggle

---

## 10. Common Pitfalls

### Pitfall 1: Stale CC Store State After Extension Disable

**What goes wrong:** User fills CC form, disables extension, re-enables extension. The Zustand store may have stale state from the previous session.

**Why it happens:** `useConventionalStore` is a Zustand store created by `createBladeStore()`. It's not tied to the extension lifecycle -- it exists as a module-level singleton.

**How to avoid:** The extension's `onDeactivate` should call `useConventionalStore.getState().reset()` to clear form state. Or accept that stale state is benign (the form just has pre-filled values).

### Pitfall 2: CommitForm Imports CC Components Statically

**What goes wrong:** CommitForm.tsx has `import { ConventionalCommitForm } from "./ConventionalCommitForm"` at the top. If ConventionalCommitForm is moved or deleted, CommitForm breaks even in simple mode.

**Why it happens:** Static imports are resolved at bundle time, not runtime.

**How to avoid:** Change to dynamic import:
```tsx
const ConventionalCommitForm = lazy(() =>
  import("./ConventionalCommitForm").then(m => ({ default: m.ConventionalCommitForm }))
);
```
Wrap in Suspense when rendering. If the import fails (file doesn't exist), the Suspense fallback catches it.

**Better approach:** Keep the component files in place. Only move the registration. Then static imports still work.

### Pitfall 3: useAmendPrefill Has CC-Specific Logic

**What goes wrong:** `useAmendPrefill` has a `prefillConventional` function that parses commit messages into CC parts. If CC components are unavailable, calling prefillConventional does nothing harmful, but it references CC types.

**Why it happens:** The hook serves both simple and CC modes.

**How to avoid:** Keep useAmendPrefill in core. It doesn't render CC UI -- it just parses text. The CC parsing logic (`parseConventionalMessage`) is already shared with the topology graph, so it stays in core.

### Pitfall 4: Changelog Blade Uses CommitTypeIcon

**What goes wrong:** `ChangelogPreview` imports `CommitTypeIcon` from `src/components/icons/CommitTypeIcon.tsx`. If CommitTypeIcon is moved to the extension, the import breaks.

**Why it happens:** CommitTypeIcon is shared between CC features and the topology graph.

**How to avoid:** Keep CommitTypeIcon in core (it's a display utility, not a CC form component).

### Pitfall 5: CC Blade Type Must Keep Its Name

**What goes wrong:** If the CC extension registers the blade as `ext:conventional-commits:conventional-commit`, all existing references to `"conventional-commit"` break (CommitForm.tsx:18, CommitForm.tsx:92, guards.ts:13, bladeTypes.ts:30).

**How to avoid:** Use `coreOverride: true` in the blade registration, exactly like Phase 38's content-viewers. This registers the blade type as `"conventional-commit"` (not namespaced).

### Pitfall 6: Race Between Extension Activation and First Commit

**What goes wrong:** User opens a repo and immediately tries to use CC. The extension hasn't activated yet.

**Why it happens:** Built-in extensions activate asynchronously via `registerBuiltIn()`.

**How to avoid:** `registerBuiltIn()` resolves synchronously for the blade registration part (the `onActivate` runs in the same microtask). By the time React renders, the blade types are registered. This is already handled correctly by Phase 37/38.

---

## 11. Open Questions

### Q1: Should the CC sidebar form be a sidebar panel contribution?

**Current:** CommitForm is hardcoded into RepositoryView.tsx layout.
**Option A:** Keep CommitForm in its current location, with CC toggle gated by extension status.
**Option B:** Extract CommitForm to a sidebar panel registry contribution.

**Recommendation:** Option A for Phase 39. The sidebar panel registry is designed for collapsible panels (like branch list, stash list), not for the always-visible commit form at the bottom. Refactoring the layout is out of scope for this phase.

### Q2: Should we add a new ExtensionAPI method for sidebar commit form enhancement?

**Current:** ExtensionAPI has `contributeSidebarPanel()` but no `contributeCommitForm()` or similar.
**Option A:** Use existing primitives -- blade registration + CommitForm capability check.
**Option B:** Add `api.contributeCommitFormMode()` for richer integration.

**Recommendation:** Option A for Phase 39. The capability check pattern (is CC blade registered?) is sufficient and avoids adding new API surface. A dedicated commit form contribution API can be added later if more extensions want to enhance the commit workflow.

### Q3: Should the conventional.ts Zustand store be split?

**Current:** One large store with form state, blade state (amend, push, template), suggestions, and validation.
**Option A:** Keep as-is -- it's only used by CC components.
**Option B:** Split into core store (form state) and extension store (suggestions, validation).

**Recommendation:** Option A for Phase 39. The entire store is CC-specific. Splitting it adds complexity without benefit since all consumers are CC components that move together.

### Q4: Should we use onWillGit("commit") hook for CC validation?

**Current:** Validation runs in the CC form via debounced calls. The simple commit form has no CC validation.
**Option A:** Extension registers `api.onWillGit("commit", handler)` to validate CC format before commit.
**Option B:** Keep validation in the CC form only, no git hook integration.

**Recommendation:** Option B for Phase 39. The CC validation is a form UX concern, not a git operation concern. Using the git hook would add validation to simple commits too, which contradicts the degradation design (simple mode = no CC rules). A future phase could add an optional "enforce CC format" git hook.

---

## 12. Sources

### Primary (HIGH confidence -- direct code analysis)
- `src/components/commit/CommitForm.tsx` -- dual-mode commit form hub
- `src/components/commit/ConventionalCommitForm.tsx` -- inline CC form
- `src/blades/conventional-commit/ConventionalCommitBlade.tsx` -- full CC blade
- `src/blades/changelog/ChangelogBlade.tsx` -- changelog generator
- `src/stores/conventional.ts` -- CC Zustand store
- `src/hooks/useConventionalCommit.ts` -- CC form state hook
- `src/hooks/useCommitExecution.ts` -- shared commit execution
- `src/hooks/useAmendPrefill.ts` -- amend mode with CC parsing
- `src/lib/conventional-utils.ts` -- message build/parse
- `src/lib/commit-type-theme.ts` -- type icons/colors
- `src/lib/commit-templates.ts` -- built-in templates
- `src/components/commit/*.tsx` -- all CC form components
- `src/extensions/ExtensionAPI.ts` -- extension API with blade registration
- `src/extensions/ExtensionHost.ts` -- extension host with registerBuiltIn
- `src/extensions/content-viewers/index.ts` -- Phase 38 proven pattern
- `src/extensions/github/index.ts` -- GitHub extension pattern
- `src/components/RepositoryView.tsx:220` -- CommitForm mount point
- `src/blades/_discovery.ts` -- blade registration exhaustiveness check
- `src/stores/bladeTypes.ts` -- blade type definitions
- `src/machines/navigation/guards.ts` -- singleton blade guards
- `src/commands/toolbar-actions.ts:282-293` -- changelog toolbar
- `src/commands/repository.ts:50-59` -- changelog command

### Secondary (MEDIUM confidence -- pattern extrapolation)
- `.planning/phases/38-content-viewer-extraction/38-RESEARCH-UX.md` -- Phase 38 UX patterns
- Phase 37/38 architectural decisions on coreOverride, built-in extensions

---

## Metadata

**Confidence breakdown:**
- Current CC UX inventory: HIGH -- exhaustive code analysis of all 25+ files
- Graceful degradation design: HIGH -- based on existing dual-mode CommitForm architecture
- Extension UI contribution: HIGH -- follows proven Phase 38 pattern
- Form patterns and validation: HIGH -- direct analysis of all form components
- Accessibility: MEDIUM -- static code analysis, no runtime testing
- Transition experience: HIGH -- based on existing Extension Manager toggle UX

**Research date:** 2026-02-10
**Valid until:** 2026-03-12 (stable internal architecture)
