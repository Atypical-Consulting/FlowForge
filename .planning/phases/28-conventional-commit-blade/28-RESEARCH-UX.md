# Phase 28: Conventional Commit Blade -- UX Research

**Researched:** 2026-02-08
**Domain:** Commit composition UI/UX, dual-mode forms, live preview, progressive disclosure
**Confidence:** HIGH
**Applies to:** CC-01 through CC-09

---

## Executive Summary

Phase 28 elevates FlowForge's existing compact sidebar commit form into a full-width blade workspace while keeping both modes operational. This research examines eight UX dimensions: layout architecture, dual-mode interaction, live preview, amend workflow, scope autocomplete with frequency visualization, templates, post-commit flow, and extensibility.

The central finding is that the blade should follow a **two-column layout** -- form inputs on the left, live preview + metadata on the right -- matching the `SplitPaneLayout` pattern already established by `StagingChangesBlade` and `InitRepoBlade`. The dual-mode coexistence succeeds when the sidebar acts as a "quick commit" shortcut and the blade acts as the "full workspace," with a clear affordance to expand between them. Auto-navigation after commit should use a brief (1.5s) success state with toast notification, not an immediate redirect.

---

## 1. Layout & Information Architecture (CC-01)

### Recommendation: Two-Column Split with Left Form / Right Preview

The blade should use `SplitPaneLayout` with the form on the left (55% default) and the preview + metadata on the right (45% default). This follows the precedent set by:

- **`InitRepoBlade`**: form left, preview right (55/45 split)
- **`StagingChangesBlade`**: file list left, diff preview right (40/60 split)

#### Left Column: Form Inputs (Top to Bottom)

1. **Template selector** (CC-09) -- horizontal chip bar, only shown when no fields are populated
2. **Type selector** (CC-02) -- grid of type buttons with icons (existing `TypeSelector` component)
3. **Scope autocomplete** (CC-02) -- input with dropdown (existing `ScopeAutocomplete` component)
4. **Description** -- single-line input with character progress bar
5. **Body** -- multi-line textarea, taller than sidebar version (8-12 rows vs 4)
6. **Breaking change section** -- checkbox + conditional textarea
7. **Validation feedback** -- inline errors/warnings (existing `ValidationErrors` component)
8. **Action buttons** -- sticky footer with Commit, Commit & Push, Cancel

#### Right Column: Preview & Metadata (Top to Bottom)

1. **Live preview** (CC-03) -- monospace formatted commit message with syntax highlighting
2. **Scope frequency visualization** (CC-08) -- compact bar chart or tag cloud below preview
3. **Amend indicator** (CC-06) -- when amending, show diff between original and current message

#### Rationale

- **Fitts's Law**: Primary actions (form fields) are on the left where the cursor naturally starts. The preview is a read-only reference area that the user glances at but does not interact with.
- **Reading flow**: Left-to-right reading means the user fills in inputs, then glances right to confirm the result -- matching the mental model of "compose then verify."
- **Spatial stability**: The preview never moves or changes position as the user fills in fields. This avoids the disorienting effect of a preview that shifts down as more form fields appear (the current sidebar behavior where the preview is below the form).

#### Wireframe (ASCII)

```
+-----------------------------------------------------------------------+
| [<- Back]  Conventional Commit                      [Amend toggle]    |
+-----------------------------------+-----------------------------------+
|                                   |                                   |
|  [Template chips when empty]      |  PREVIEW                         |
|                                   |  +-----------------------------+  |
|  Type *                           |  | feat(auth): add OAuth2 flow |  |
|  [feat][fix][docs][style]...      |  |                             |  |
|                                   |  | Implement the full OAuth2   |  |
|  Scope (optional)                 |  | authorization code flow     |  |
|  [_auth____________] [v]          |  | with PKCE extension.        |  |
|                                   |  |                             |  |
|  Description *                    |  | BREAKING CHANGE: The old    |  |
|  [_add OAuth2 flow_____] 52/72   |  | session API is removed.     |  |
|                                   |  +-----------------------------+  |
|  Body (optional)                  |                                   |
|  +-----------------------------+  |  SCOPE USAGE                     |
|  | Implement the full OAuth2   |  |  auth ======== 23                |
|  | authorization code flow     |  |  api  =====    15                |
|  | with PKCE extension.        |  |  ui   ====     12                |
|  |                             |  |  core ===       8                |
|  |                             |  |                                   |
|  +-----------------------------+  |                                   |
|                                   |                                   |
|  [ ] Breaking Change              |                                   |
|                                   |                                   |
|  [Validation: Valid]              |                                   |
|                                   |                                   |
+-----------------------------------+-----------------------------------+
|                        [Cancel]  [Commit]  [Commit & Push]            |
+-----------------------------------------------------------------------+
```

### Sticky Action Footer

The action buttons should be in a sticky footer bar at the bottom of the blade, not at the bottom of the scrollable form column. This ensures:

- The primary action (Commit) is always visible regardless of scroll position
- Consistent with desktop app conventions (dialog action bars)
- The Commit & Push button (CC-04) is always accessible

The footer should span the full blade width, not just the form column, with buttons right-aligned. Use a top border and slightly elevated background (`bg-ctp-crust border-t border-ctp-surface0`) matching the existing `CommitForm` bottom bar pattern.

---

## 2. Dual-Mode UX: Sidebar vs Blade (CC-07)

### Recommendation: Progressive Disclosure with "Expand" Affordance

The two modes serve different workflows:

| Dimension | Sidebar (Compact) | Blade (Full) |
|---|---|---|
| **Use case** | Quick commits, small changes | Complex commits, breaking changes, templates |
| **Type selector** | 4-column grid (current) | 6-column grid or horizontal row |
| **Body field** | 4 rows, scrollable | 8-12 rows, generous |
| **Preview** | Below form, max-h-32 | Side-by-side, full height |
| **Scope viz** | Hidden | Shown in right column |
| **Templates** | Hidden | Chip bar at top |
| **Amend** | Checkbox only | Full comparison view |

#### Transition Trigger

Add an "Expand" button (icon: `Maximize2` from Lucide) in the sidebar commit form header. Clicking it:

1. Copies current form state (type, scope, description, body, breaking) from `useConventionalStore` to the blade
2. Pushes the `conventional-commit` blade onto the blade stack via `openBlade()`
3. The sidebar commit form becomes inactive/hidden while the blade is open

This works because both the sidebar and blade share the same `useConventionalStore` Zustand store. No state transfer is needed -- the blade simply reads from and writes to the same store.

#### Returning to Sidebar

When the blade is popped (Back button or Escape):

- Form state persists in `useConventionalStore`
- The sidebar form reappears with the same values
- No data loss

#### Avoiding Confusion

- **Only one form is active at a time.** When the blade is open, the sidebar form is either hidden or shows a "Editing in blade view" placeholder with a link to focus the blade.
- **Visual continuity.** Both modes use the same `TypeSelector`, `ScopeAutocomplete`, and `BreakingChangeSection` components. The blade simply renders them in a wider layout.
- **No duplicate commits.** The Commit button only appears in the active mode.

#### Anti-Pattern to Avoid

Do NOT auto-open the blade when the user toggles "Conventional Commits" in the sidebar. The sidebar toggle should continue to show the inline form. The blade is an explicit, separate action ("Expand to full editor"). Forcing the blade open breaks the quick-commit workflow.

---

## 3. Commit Preview UX (CC-03)

### Recommendation: Real-Time, Syntax-Highlighted, Monospace Preview

The preview should update in real-time (no debounce needed -- it is a pure string concatenation from `buildCommitMessage()`, not an async operation). The current implementation already does this.

#### Enhancements for the Blade Preview

1. **Syntax highlighting by segment.** Color-code the commit message parts:
   - Type: use the `COMMIT_TYPE_THEME` color for the selected type (e.g., `text-ctp-green` for `feat`)
   - Scope (in parentheses): `text-ctp-teal`
   - Breaking indicator (`!`): `text-ctp-red` with bold
   - Description: `text-ctp-text` (default)
   - Body: `text-ctp-subtext1` (slightly dimmer)
   - `BREAKING CHANGE:` footer label: `text-ctp-red` bold
   - Footer value: `text-ctp-subtext1`

2. **Line length ruler.** Show a subtle vertical line at column 72 in the preview area. This helps users see when the subject line or body lines exceed recommended length. Use a 1px `border-right` on a positioned element or a CSS `background-image` gradient.

3. **Character count per line.** Show the character count for the first line (subject) prominently. The existing `CharacterProgress` component handles this, but in the blade preview, the count should appear as an overlay at the right edge of the first line.

4. **Generous sizing.** The preview area should be at least 300px tall or fill the available height (whichever is larger). Use `min-h-[300px] flex-1` to allow it to grow. Remove the `max-h-32` constraint that the sidebar version uses.

5. **Copy button.** Add a small copy-to-clipboard button in the preview header. Some users compose in the blade and then paste into a terminal.

#### Formatting Cues

Use a monospace font (`font-mono`) and preserve whitespace (`whitespace-pre-wrap`). Render the header line, blank line separator, body, blank line separator, and footers exactly as they will appear in the git log.

Show placeholder text when the preview is empty: "Start typing to see your commit message preview..." in `text-ctp-overlay0 italic`.

---

## 4. Amend Workflow (CC-06)

### Recommendation: Prominent Visual Mode Switch with Comparison

Amending is a destructive operation (rewrites history). The UX must make it unmistakably clear that the user is amending, not creating a new commit.

#### Visual Indicators

1. **Mode banner.** When amend is active, show a full-width warning banner at the top of the form:
   ```
   [!] Amending previous commit: "feat(auth): add login flow"
   ```
   Use `bg-ctp-peach/15 border border-ctp-peach/30 text-ctp-peach` -- the same orange/peach tone used for breaking changes, signaling caution.

2. **Button label change.** The Commit button changes to "Amend Commit" with a `RotateCcw` icon (already implemented in `CommitForm.tsx`). The "Commit & Push" button should change to "Amend & Force Push" with a warning color to indicate the force push required after amend.

3. **Original message reference.** In the blade's right column, show the original commit message above the live preview:
   ```
   ORIGINAL MESSAGE
   feat(auth): add login flow

   AMENDED MESSAGE (preview)
   feat(auth): add OAuth2 login flow
   ```
   Use a diff-like visual: original in dimmed text, changed parts highlighted.

4. **Confirmation dialog.** On submit, show a confirmation: "This will rewrite the last commit. This cannot be undone on a shared branch. Continue?" The existing `CommitForm` already uses `window.confirm()` for this; the blade should use a styled in-blade dialog or modal for better UX.

#### Pre-filling Fields

When amend is toggled on:

1. Fetch the last commit message via `commands.getLastCommitMessage()` (already implemented)
2. Parse it into conventional commit parts (type, scope, description, body, breaking)
3. Fill each form field individually, not just the raw message. This is the key improvement over the current sidebar implementation which puts the full message into a single textarea.
4. If the user has already typed content, prompt before overwriting (current behavior -- keep it)

#### Parsing Strategy

Use the backend `commands.validateConventionalCommit()` to parse the previous message. If the previous commit was not a conventional commit, populate only the description field with the full message and leave type/scope empty with a hint: "The previous commit was not in conventional format. Select a type to convert it."

---

## 5. Scope Autocomplete & Frequency Visualization (CC-02, CC-08)

### Recommendation: Inline Autocomplete + Sidebar Frequency Chart

#### Autocomplete (CC-02)

The existing `ScopeAutocomplete` component is well-designed with keyboard navigation, filtered suggestions, and inferred scope banners. For the blade version:

1. **Wider dropdown.** In the blade layout, the autocomplete dropdown can be wider and show more context per suggestion:
   ```
   auth      23 uses    last: 2 days ago
   api       15 uses    last: 1 week ago
   ui        12 uses    last: today
   ```
   Add a "last used" relative timestamp to help users pick between similar scopes.

2. **Fuzzy matching.** The current implementation uses `includes()` for filtering. Consider upgrading to fuzzy matching (e.g., typing "au" matches "auth" and "oauth") for better discoverability.

3. **New scope indicator.** If the user types a scope that does not exist in history, show a subtle "(new)" badge next to the input to confirm it is intentionally new, not a typo.

#### Frequency Visualization (CC-08)

Place the scope frequency chart in the right column, below the preview. Design options:

**Option A: Horizontal Bar Chart (Recommended)**

```
Scope Usage (last 100 commits)
auth  ============  23
api   ========      15
ui    =======       12
core  =====          8
db    ===             5
```

- Simple, scannable, fits naturally in a narrow column
- Use Catppuccin accent colors for the bars (cycle through `ctp-blue`, `ctp-green`, `ctp-teal`, `ctp-lavender`, etc.)
- Show top 8-10 scopes only; add "Show all" toggle if there are more
- Pure CSS implementation (no charting library needed): use `div` with `width: ${percentage}%` and Tailwind background classes

**Option B: Tag Cloud (Not Recommended)**

Tag clouds look visually interesting but are harder to read precisely. Users cannot compare frequencies accurately when size is the only differentiator. Avoid this.

**Option C: Inline in Autocomplete (Compromise)**

If the right column is too crowded, show usage counts inline in the autocomplete dropdown only (already partially done: `{s.usageCount} uses`). Skip the standalone chart. This is acceptable for v1 but less discoverable.

#### Interaction

Clicking a bar in the frequency chart should fill the scope input with that scope value. This creates a shortcut for selecting common scopes without using the autocomplete dropdown.

---

## 6. Templates (CC-09)

### Recommendation: Horizontal Chip Bar with Progressive Disclosure

#### Presentation

Show templates as horizontal chips at the top of the form, visible when the form is empty or near-empty. When the user starts filling in fields, the chips collapse to a single "Templates" dropdown button to save space.

```
Empty state:
[Release] [Hotfix] [Breaking Change] [Dependency Update] [Refactor] [More v]

After typing:
[Templates v]  Type * ...
```

#### Template Data Structure

```typescript
interface CommitTemplate {
  id: string;
  label: string;
  icon?: string;           // Lucide icon name
  type: CommitType;
  scope?: string;
  descriptionPrefix?: string;  // e.g., "release v" for version commits
  body?: string;
  isBreaking?: boolean;
  breakingDescription?: string;
}
```

#### Pre-Defined Templates

| Template | Type | Scope | Description Prefix | Breaking |
|---|---|---|---|---|
| Release | `chore` | `release` | `release v` | No |
| Hotfix | `fix` | -- | -- | No |
| Breaking Change | `feat` | -- | -- | Yes (checkbox pre-checked) |
| Dependency Update | `chore` | `deps` | `update ` | No |
| Refactor | `refactor` | -- | -- | No |
| Initial Commit | `chore` | -- | `initial commit` | No |
| Documentation | `docs` | -- | -- | No |
| CI/CD Change | `ci` | -- | -- | No |

#### Behavior

1. Clicking a template chip fills in the relevant fields and focuses the first empty required field (usually description).
2. The template is a starting point, not a constraint. All fields remain editable after applying a template.
3. Show a subtle "Template: Release" badge near the form title when a template is active. Editing any field beyond what the template pre-filled removes the badge.
4. "More" button opens a dropdown with all templates plus a "Manage Templates" link (future: user-defined templates).

#### Power User Consideration

Power users who know the conventional commit format well will not use templates. The chip bar must not add vertical space or visual noise when the user is in "fast typing mode." Collapse the chips as soon as any field is populated. The keyboard shortcut `Ctrl+T` or `Cmd+T` could toggle template visibility for quick access.

---

## 7. Post-Commit Flow (CC-05)

### Recommendation: Brief Success State + Toast + Delayed Navigation

Do NOT immediately redirect after commit. Users need confirmation that their action succeeded before being whisked away.

#### Flow

1. **Commit succeeds.**
2. **In-blade success state (1.5 seconds).** Replace the form content with a success animation:
   ```
   [checkmark icon with scale-up animation]
   Committed: feat(auth): add OAuth2 flow
   [Navigating back to staging...]
   ```
   Use `motion.div` with `scale` and `opacity` animation. The success state uses `text-ctp-green` and a `CheckCircle` icon.

3. **Toast notification appears.** A toast with the commit summary and a "Push now" action button (already implemented in `CommitForm.tsx`). The toast persists for 5 seconds (default for success toasts).

4. **Auto-navigate back.** After 1.5 seconds, pop the blade via `actorRef.send({ type: "POP_BLADE" })` to return to the staging view.

5. **Reset form state.** Call `reset()` on `useConventionalStore` to clear all fields.

#### Commit & Push Flow (CC-04)

When the user clicks "Commit & Push":

1. Commit succeeds -> show success state: "Committed: ..."
2. Immediately start push -> update success state: "Pushing to origin..."
3. Push succeeds -> update: "Committed and pushed successfully"
4. After 1.5 seconds from push completion, auto-navigate back
5. If push fails, show error in the success area with a "Retry Push" button. Do NOT auto-navigate -- the user needs to address the error.

#### Cancel Navigation

Include a small "Stay here" link in the success state that cancels the auto-navigation timer. Some users may want to immediately compose another commit.

#### Edge Case: Amend + Push

When amending and pushing, the push must be a force push. The success state should clearly indicate: "Amended and force-pushed to origin." The confirmation dialog before amend+push should warn about force pushing to shared branches.

---

## 8. Extensibility Architecture (CC-F01, CC-F02)

### Recommendation: Slot-Based Layout with Named Regions

Design the blade layout with named "slots" that future features can plug into without restructuring:

```
+-----------------------------------------------------------------------+
| HEADER_SLOT: blade title, back button, mode toggles                   |
+-----------------------------------------------------------------------+
| TOOLBAR_SLOT: template chips, tab bar (future CC-F02)                 |
+-----------------------------------+-----------------------------------+
| LEFT_SLOT                         | RIGHT_SLOT                        |
| (form inputs)                     | (preview, metadata)               |
|                                   |                                   |
| FORM_BEFORE_TYPE_SLOT             | RIGHT_TOP_SLOT (preview)          |
| (AI suggestions CC-F01)           |                                   |
|                                   | RIGHT_MIDDLE_SLOT (scope viz)     |
| FORM_FIELDS (type, scope, etc.)   |                                   |
|                                   | RIGHT_BOTTOM_SLOT (future)        |
| FORM_AFTER_BODY_SLOT              |                                   |
| (future: co-authors, trailers)    |                                   |
+-----------------------------------+-----------------------------------+
| FOOTER_SLOT: action buttons                                           |
+-----------------------------------------------------------------------+
```

#### Component Architecture

```typescript
// ConventionalCommitBlade.tsx -- orchestrator
function ConventionalCommitBlade() {
  return (
    <BladePanel title="Conventional Commit">
      <CommitBladeToolbar />          {/* TOOLBAR_SLOT */}
      <SplitPaneLayout
        primary={<CommitBladeForm />}  {/* LEFT_SLOT */}
        detail={<CommitBladePreview />} {/* RIGHT_SLOT */}
      />
      <CommitBladeFooter />            {/* FOOTER_SLOT */}
    </BladePanel>
  );
}

// CommitBladeForm.tsx -- left column
function CommitBladeForm() {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      {/* FORM_BEFORE_TYPE_SLOT -- future: AI suggestion banner */}
      <TypeSelector ... />
      <ScopeAutocomplete ... />
      <DescriptionInput ... />
      <BodyTextarea ... />
      <BreakingChangeSection ... />
      {/* FORM_AFTER_BODY_SLOT -- future: co-authors, custom footers */}
      <ValidationErrors ... />
    </div>
  );
}

// CommitBladePreview.tsx -- right column
function CommitBladePreview() {
  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* RIGHT_TOP_SLOT */}
      <MessagePreview ... />
      {/* RIGHT_MIDDLE_SLOT */}
      <ScopeFrequencyChart ... />
      {/* RIGHT_BOTTOM_SLOT -- future: diff summary, affected files */}
    </div>
  );
}
```

#### Future Feature Mapping

| Future Feature | Slot | Integration |
|---|---|---|
| **CC-F01: AI Suggestions** | `FORM_BEFORE_TYPE_SLOT` | Banner above type selector: "AI suggests: feat(auth): add OAuth2 flow" with Accept/Dismiss |
| **CC-F02: Side-by-Side Tabs** | `TOOLBAR_SLOT` | Tab bar: [Compose] [Staged Files] [Diff Summary] |
| **Co-authors** | `FORM_AFTER_BODY_SLOT` | Multi-select input for `Co-authored-by:` trailers |
| **Custom footers** | `FORM_AFTER_BODY_SLOT` | Key-value inputs for arbitrary footers |
| **Diff summary** | `RIGHT_BOTTOM_SLOT` | Compact list of changed files with stats |
| **Commit signing** | `FOOTER_SLOT` | GPG/SSH signing toggle next to Commit button |

#### State Management Extensibility

The existing `useConventionalStore` covers core fields. Future features should add their own stores (e.g., `useCommitAIStore`, `useCommitTrailersStore`) rather than expanding the conventional store. The blade orchestrator composes data from multiple stores when building the final message.

---

## Cross-Cutting Concerns

### Keyboard Shortcuts

| Action | Shortcut | Context |
|---|---|---|
| Open blade from sidebar | `Ctrl+Shift+C` / `Cmd+Shift+C` | When sidebar commit form is focused |
| Commit | `Ctrl+Enter` / `Cmd+Enter` | When blade is focused |
| Commit & Push | `Ctrl+Shift+Enter` / `Cmd+Shift+Enter` | When blade is focused |
| Toggle amend | `Ctrl+Shift+M` / `Cmd+Shift+M` | When blade is focused (matches existing) |
| Focus type selector | `Alt+T` | Within blade |
| Focus scope | `Alt+S` | Within blade |
| Focus description | `Alt+D` | Within blade |
| Close blade | `Escape` | When blade is focused (existing behavior) |

### Accessibility

1. **ARIA labels.** Each form section needs `aria-label` or `aria-labelledby`. The preview area should have `aria-label="Commit message preview"` and `aria-live="polite"` so screen readers announce changes.
2. **Focus management.** When the blade opens, focus the first interactive element (type selector if empty, or description if type is pre-filled). When the blade closes, restore focus to the sidebar expand button.
3. **Color-blind safety.** Do not rely solely on color to convey information. The type selector uses icons + text + color. The breaking change uses both the `!` symbol and red color. Validation uses icons (`X`, `!`, checkmark) alongside colors.
4. **Keyboard navigation.** The type selector grid should support arrow keys (already does via individual buttons). The preview area should be navigable for copy/select purposes.

### Dirty State & Navigation Guards

When the user has typed content in the blade form and tries to navigate away (Back button, Escape, clicking a BladeStrip), show a confirmation: "You have unsaved commit content. Discard changes?"

Implementation: Use the navigation machine's `MARK_DIRTY` / `MARK_CLEAN` events. Mark the blade dirty when any form field has content, clean when all fields are empty or after a successful commit.

### Responsive Behavior

At narrow blade widths (< 600px), collapse the two-column layout to a single column with the preview above the form (similar to the current sidebar layout but wider). Use a media query or `ResizeObserver` on the blade container to detect available width.

---

## Blade Registration

The new blade type should be registered as:

```typescript
// In BladePropsMap (bladeTypes.ts)
"conventional-commit": { amend?: boolean };

// In blade registration
registerBlade({
  type: "conventional-commit",
  defaultTitle: "Conventional Commit",
  component: lazy(() => import("./ConventionalCommitBlade")),
  lazy: true,
  wrapInPanel: true,
  showBack: true,
  singleton: true,  // Only one commit blade at a time
});
```

The `singleton: true` flag prevents multiple commit blades from stacking (which would be confusing). The optional `amend` prop allows opening the blade in amend mode directly from other contexts (e.g., right-clicking a commit in the topology view).

---

## Summary of Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Layout | Two-column SplitPaneLayout | Matches `InitRepoBlade`/`StagingChangesBlade` precedent |
| Preview position | Right column, always visible | Avoids preview shifting as form grows |
| Dual-mode trigger | Explicit "Expand" button in sidebar | Progressive disclosure; does not break quick-commit flow |
| State sharing | Single `useConventionalStore` | Both modes read/write same Zustand store |
| Preview updates | Real-time, no debounce | Pure string concatenation, zero async |
| Amend indicator | Full-width warning banner + button label change | Amend is destructive; must be unmistakable |
| Scope visualization | Horizontal bar chart in right column | Scannable, no charting library, click to select |
| Templates | Horizontal chips, collapse on input | Progressive disclosure for power users |
| Post-commit navigation | 1.5s success state -> toast -> auto-pop | Users need confirmation before redirect |
| Extensibility | Named slot regions in component tree | Future features plug into slots without restructuring |

---

## Sources

### Primary (HIGH confidence -- codebase analysis)
- `src/components/commit/ConventionalCommitForm.tsx` -- existing compact form structure
- `src/components/commit/CommitForm.tsx` -- sidebar commit form with amend logic
- `src/hooks/useConventionalCommit.ts` -- shared hook for form state
- `src/stores/conventional.ts` -- Zustand store, single source of truth
- `src/components/blades/InitRepoBlade.tsx` -- two-column blade precedent
- `src/components/blades/StagingChangesBlade.tsx` -- SplitPaneLayout usage
- `src/components/blades/BladePanel.tsx` -- blade shell with title bar
- `src/components/blades/BladeContainer.tsx` -- blade stack rendering with framer-motion
- `src/stores/bladeTypes.ts` -- blade type registry pattern
- `src/lib/bladeRegistry.ts` -- blade registration API
- `src/machines/navigation/types.ts` -- XState navigation events (PUSH_BLADE, POP_BLADE)
- `src/stores/toast.ts` -- toast notification system with action buttons
- `src/lib/commit-type-theme.ts` -- per-type color/icon theming
- `.planning/phases/06-conventional-commits/06-RESEARCH.md` -- Phase 6 research

### Secondary (MEDIUM confidence -- UX research)
- [Progressive Disclosure -- Primer Design System](https://primer.style/ui-patterns/progressive-disclosure/)
- [Progressive Disclosure in UX Design -- LogRocket](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/)
- [Live Preview Design Pattern -- UI-Patterns.com](https://ui-patterns.com/patterns/LivePreview)
- [Toast Notification Best Practices -- LogRocket](https://blog.logrocket.com/ux-design/toast-notifications/)
- [Success Message UX -- Pencil & Paper](https://www.pencilandpaper.io/articles/success-ux)
- [Notification Pattern -- Carbon Design System](https://carbondesignsystem.com/patterns/notification-pattern/)
- [Commit Composer in GitLens 17.4 -- GitKraken](https://www.gitkraken.com/blog/best-tool-for-clean-git-commits-in-vs-code-gitlens-17-4-commit-composer)
- [GitKraken Desktop Commit Interface](https://help.gitkraken.com/gitkraken-desktop/commits/)
- [Conventional Commits Specification v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)

### Codebase Pitfalls Reference
- `.planning/research/PITFALLS-blade-expansion.md` -- P1 (blade state), P5 (focus management), P13 (Escape conflicts)
