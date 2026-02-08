# Phase 28: Conventional Commit Blade -- Developer Research

## 1. Complete File Inventory

### 1.1 Frontend -- Conventional Commit Files

| File | Role | Lines |
|------|------|-------|
| `src/stores/conventional.ts` | Zustand store: form state, validation, suggestions, message builder | 206 |
| `src/hooks/useConventionalCommit.ts` | Hook wrapping the store: debounced validation, filtered scopes, `canCommit` | 184 |
| `src/components/commit/ConventionalCommitForm.tsx` | Full CC form (sidebar-oriented): wires hook to sub-components | 203 |
| `src/components/commit/CommitForm.tsx` | Top-level sidebar commit widget: toggles between simple/CC modes, owns `commitMutation` + `pushMutation` | 273 |
| `src/components/commit/TypeSelector.tsx` | 4-column grid of commit types with suggestion banner | 77 |
| `src/components/commit/ScopeAutocomplete.tsx` | Autocomplete dropdown with keyboard nav, inferred scope banner | 206 |
| `src/components/commit/BreakingChangeSection.tsx` | Checkbox + description textarea for BREAKING CHANGE | 55 |
| `src/components/commit/CharacterProgress.tsx` | Animated progress bar for character count | 53 |
| `src/components/commit/ValidationErrors.tsx` | Renders validation errors/warnings/success | 71 |
| `src/components/commit/CommitHistory.tsx` | Virtualized commit list with infinite scroll + search | 208 |
| `src/components/commit/CommitDetails.tsx` | Single commit detail view (used in split pane, not blade) | 115 |
| `src/components/commit/CommitSearch.tsx` | Search input for commit history | ~30 |
| `src/components/icons/CommitTypeIcon.tsx` | Renders icon for a CC type (from message or explicit type) | 42 |
| `src/lib/commit-type-theme.ts` | Single source of truth: icon, color, badge, emoji, label per type | 155 |
| `src/components/topology/layoutUtils.ts:182-187` | `parseConventionalType()` -- regex parser (duplicated from Rust) | 6 |

### 1.2 Backend -- Rust Files

| File | Role |
|------|------|
| `src-tauri/src/git/conventional.rs` | Core CC logic: parse, validate, infer type, infer scope, extract scope history. 5 IPC commands. ~914 lines with tests |
| `src-tauri/src/git/commit.rs` | `create_commit(message, amend)`, `get_last_commit_message()`. ~214 lines |
| `src-tauri/src/git/remote.rs` | `push_to_remote(remote, channel)`, `pull_from_remote(remote, channel)`, `fetch_from_remote(remote, channel)`. ~450 lines |
| `src-tauri/src/lib.rs` | Command registration hub |

### 1.3 Blade Infrastructure Files

| File | Role |
|------|------|
| `src/stores/bladeTypes.ts` | `BladePropsMap` + `BladeType` union -- type-safe blade registration |
| `src/lib/bladeRegistry.ts` | `registerBlade()`, `getBladeRegistration()` |
| `src/lib/bladeOpener.ts` | `openBlade()` for non-React contexts |
| `src/components/blades/BladePanel.tsx` | Standard blade chrome: title bar + back button |
| `src/components/blades/BladeRenderer.tsx` | Resolves registration, wraps in panel + error boundary + suspense |
| `src/components/blades/BladeContainer.tsx` | Stack renderer with framer-motion transitions |
| `src/hooks/useBladeNavigation.ts` | React hook for blade push/pop/replace |
| `src/hooks/useBladeFormGuard.ts` | Dirty-form protection hook |
| `src/machines/navigation/navigationMachine.ts` | XState FSM for blade navigation |
| `src/machines/navigation/types.ts` | FSM types: events, context, process types |
| `src/components/blades/registrations/index.ts` | Auto-discovery of registration modules |

### 1.4 Where CommitForm Lives in the UI

`CommitForm` is rendered in `src/components/RepositoryView.tsx` at the bottom of the left sidebar panel (line 155), pinned with `shrink-0`. It sits below the scrollable branches/stashes/tags/gitflow/worktrees sections and above the blade container.

---

## 2. Architecture Analysis -- Current State

### 2.1 Data Flow

```
┌───────────────────────────────────────────────────────────────────┐
│ RepositoryView.tsx                                                 │
│  ├── Sidebar (ResizablePanel 20%)                                 │
│  │   ├── Branches/Stashes/Tags/Gitflow/Worktrees (scrollable)    │
│  │   └── CommitForm (shrink-0, pinned bottom)                     │
│  │       ├── Simple mode: local state (message, amend)            │
│  │       │   └── commitMutation → commands.createCommit()         │
│  │       └── CC mode: ConventionalCommitForm                      │
│  │           └── useConventionalCommit() hook                     │
│  │               └── useConventionalStore (Zustand)               │
│  │                   ├── commands.suggestCommitType()              │
│  │                   ├── commands.getScopeSuggestions()            │
│  │                   ├── commands.inferScopeFromStaged()           │
│  │                   └── commands.validateConventionalCommit()     │
│  └── BladeContainer (ResizablePanel 80%)                          │
│      └── XState FSM → blade stack → BladeRenderer                 │
└───────────────────────────────────────────────────────────────────┘
```

### 2.2 Tight Coupling and Code Smells

#### Problem 1: Commit execution logic is trapped in `CommitForm.tsx`

The `commitMutation` and `pushMutation` (lines 80-119 of CommitForm.tsx) are defined locally in the sidebar component. The new blade will need the same commit+push+amend logic but cannot reuse it because it is:
- Embedded in a React component (not extractable)
- Tightly coupled to local state (`message`, `amend`, `setMessage`)
- Tightly coupled to sidebar-specific toast patterns

**Impact on CC-04 (commit+push workflow) and CC-05 (auto-navigate after commit):** Cannot reuse.

#### Problem 2: `ConventionalCommitForm` is monolithic for sidebar layout

The `ConventionalCommitForm` component (203 lines) directly calls `useConventionalCommit()` and renders all sub-components in a single vertical `space-y-4` form. A blade layout needs:
- A wider 2-column or grid layout (CC-02)
- A generous monospace preview (CC-03) -- currently `max-h-32` and crammed at bottom
- Room for templates (CC-09) and scope visualization (CC-08)

The form cannot be reused for the blade without major refactoring or duplication.

#### Problem 3: `buildCommitMessage()` lives in the store

`buildCommitMessage()` is a method on the Zustand store (`conventional.ts:158-188`). This is good for shared state, but makes it hard to unit-test in isolation and creates a hidden dependency.

#### Problem 4: Duplicate conventional type parsing

`parseConventionalType()` in `layoutUtils.ts:182-187` is a regex parser:
```ts
export function parseConventionalType(message: string): string | null {
  const match = message.match(
    /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+?\))?(!)?:/,
  );
  return match ? match[1] : null;
}
```
This duplicates the Rust parser. Used by `CommitTypeIcon.tsx` and `CommitBadge.tsx`.

#### Problem 5: Amend logic has no shared abstraction

Amend pre-fill logic is in `CommitForm.tsx` (lines 29-62) using local state + `window.confirm()`. The blade will need the same amend flow (CC-06) but cannot reuse this code.

#### Problem 6: No commit+push combined workflow

Currently, push is a separate action offered as a toast action after commit (line 112: `label: "Push now"`). There is no atomic commit-then-push flow. The blade needs this (CC-04).

---

## 3. Refactoring Plan -- Before Building the Blade

### 3.1 Extract `useCommitExecution` Hook

**What:** A new hook that encapsulates commit + push + amend mutation logic, decoupled from any UI.

**Location:** `src/hooks/useCommitExecution.ts`

**Interface:**
```ts
interface UseCommitExecutionOptions {
  onCommitSuccess?: (info: CommitInfo, message: string) => void;
  onPushSuccess?: () => void;
  onError?: (error: string) => void;
}

interface UseCommitExecutionReturn {
  commit: (message: string, amend: boolean) => Promise<void>;
  commitAndPush: (message: string, amend: boolean) => Promise<void>;
  push: () => Promise<void>;
  isCommitting: boolean;
  isPushing: boolean;
  commitError: string | null;
  pushError: string | null;
}
```

**Why:** Both `CommitForm` (sidebar) and the new CC blade can use the same hook. The hook handles:
- `useMutation` for commit
- `useMutation` for push
- Sequential commit-then-push flow
- Query invalidation (`stagingStatus`, `commitHistory`, `repositoryStatus`)
- Error handling

**Refactoring step:** Extract mutations from `CommitForm.tsx` lines 80-119 into this hook, then have `CommitForm` consume it.

### 3.2 Extract `useAmendPrefill` Hook

**What:** A hook that manages amend-mode state and pre-fills the last commit message.

**Location:** `src/hooks/useAmendPrefill.ts`

**Interface:**
```ts
interface UseAmendPrefillReturn {
  amend: boolean;
  lastMessage: LastCommitMessage | null;
  toggleAmend: () => Promise<void>;
  setAmend: (amend: boolean) => Promise<void>;
  resetAmend: () => void;
}
```

**Why:** Used by both sidebar `CommitForm` and the blade for CC-06 (amend previous commit with fields pre-filled). Currently this logic is scattered in `CommitForm.tsx` lines 29-73.

### 3.3 Extract Pure Functions from Store

**What:** Move `buildCommitMessage()` to a pure utility function.

**Location:** `src/lib/conventional-utils.ts`

```ts
export interface ConventionalMessageParts {
  commitType: string;
  scope: string;
  description: string;
  body: string;
  isBreaking: boolean;
  breakingDescription: string;
}

export function buildCommitMessage(parts: ConventionalMessageParts): string;
export function parseConventionalMessage(message: string): ConventionalMessageParts | null;
```

**Why:**
- Unit-testable without Zustand
- Can be used by the blade's preview rendering (CC-03)
- `parseConventionalMessage()` replaces the duplicated regex in `layoutUtils.ts`
- Can be used for amend pre-fill: parse last commit message into CC parts

### 3.4 Create Layout-Agnostic CC Primitives

Rather than having `ConventionalCommitForm` render a fixed layout, extract the UI into composable primitives that both layouts (sidebar compact + blade wide) can use:

| Primitive | File | Props |
|-----------|------|-------|
| `TypeSelector` | Already exists | Keep as-is, already well-isolated |
| `ScopeAutocomplete` | Already exists | Keep as-is |
| `BreakingChangeSection` | Already exists | Keep as-is |
| `CharacterProgress` | Already exists | Keep as-is |
| `ValidationErrors` | Already exists | Keep as-is |
| `CommitPreview` | **New** | `message: string, variant: "compact" | "full"` |
| `CommitActionBar` | **New** | `canCommit, isCommitting, onCommit, onCommitAndPush, amend, onToggleAmend` |

**Key insight:** The existing sub-components (`TypeSelector`, `ScopeAutocomplete`, etc.) are already well-extracted. The missing pieces are the **preview** and **action bar** as standalone components. Currently, the preview is inline in `ConventionalCommitForm` (lines 153-168) and the action buttons are inline too (lines 171-199).

### 3.5 Refactor `ConventionalCommitForm` to Composition

After extracting primitives, `ConventionalCommitForm` becomes a thin layout shell:

```tsx
// Sidebar layout (compact)
function ConventionalCommitFormCompact({ ... }) {
  return (
    <form className="space-y-4">
      <TypeSelector ... />
      <ScopeAutocomplete ... />
      <DescriptionInput ... />
      <BodyTextarea ... />
      <BreakingChangeSection ... />
      <ValidationErrors ... />
      <CommitPreview message={...} variant="compact" />
      <CommitActionBar ... />
    </form>
  );
}
```

The blade can then compose the SAME primitives in a wider layout:

```tsx
// Blade layout (full-width, 2-column)
function ConventionalCommitBlade() {
  return (
    <div className="grid grid-cols-[1fr_1fr] gap-6 h-full p-6">
      <div className="space-y-4">
        <TypeSelector ... />
        <ScopeAutocomplete ... />
        <DescriptionInput ... />
        <BodyTextarea ... />
        <BreakingChangeSection ... />
      </div>
      <div className="flex flex-col gap-4">
        <CommitPreview message={...} variant="full" />
        <ScopeFrequencyChart ... /> {/* CC-08 */}
        <TemplateSelector ... />    {/* CC-09 */}
        <ValidationErrors ... />
        <CommitActionBar ... />
      </div>
    </div>
  );
}
```

---

## 4. Tauri/Rust Backend Analysis

### 4.1 Existing IPC Commands

| Command | Signature | Used For |
|---------|-----------|----------|
| `create_commit` | `(message: String, amend: bool) -> CommitInfo` | Commit creation |
| `get_last_commit_message` | `() -> LastCommitMessage` | Amend pre-fill |
| `push_to_remote` | `(remote: String, Channel<SyncProgress>) -> SyncResult` | Push with progress |
| `validate_conventional_commit` | `(message: String) -> ValidationResult` | Real-time validation |
| `suggest_commit_type` | `() -> TypeSuggestion` | AI-like type inference |
| `get_scope_suggestions` | `(limit: Option<u32>) -> Vec<ScopeSuggestion>` | Scope autocomplete |
| `infer_scope_from_staged` | `() -> Option<String>` | Auto-fill scope |

### 4.2 Does Phase 28 Need New Rust Commands?

#### Commit+Push (CC-04): NO new Rust command needed

The commit+push workflow should be orchestrated on the frontend as two sequential calls:
1. `commands.createCommit(message, amend)` -- wait for success
2. `commands.pushToRemote("origin", channel)` -- then push

A single combined Rust command would be brittle (what if push fails after commit?) and doesn't add value. The `useCommitExecution` hook handles the orchestration.

#### Amend Pre-fill for CC (CC-06): NO new Rust command needed

`get_last_commit_message()` already returns `{ subject, body, fullMessage }`. The frontend can parse this into CC parts using the `parseConventionalMessage()` utility function (proposed in 3.3). The Rust-side `parse_conventional_commit()` function could be exposed as an IPC command for richer parsing, but the frontend regex is sufficient for pre-fill.

**Optional enhancement:** Expose `parse_conventional_commit` as an IPC command for richer amend parsing (returns `ParsedCommit` with type, scope, description, body, breaking, footers). This would be more robust than frontend regex for edge cases.

```rust
#[tauri::command]
#[specta::specta]
pub async fn parse_conventional_commit_message(message: String) -> Result<ParsedCommit, ValidationError> {
    parse_conventional_commit(&message)
}
```

Priority: LOW. Frontend parsing is sufficient for Phase 28 MVP.

#### Scope Frequency Visualization (CC-08): EXISTING command is sufficient

`get_scope_suggestions(limit)` already returns `Vec<ScopeSuggestion>` with `{ scope, usageCount }`, sorted by frequency. This is exactly what a bar/pie chart needs. No new command required.

**Performance note:** The current implementation walks up to 500 commits. For repos with thousands of commits, this should be cached. The frontend can cache via React Query with a stale time.

#### Templates (CC-09): NO Rust command needed

Templates are static data (predefined patterns like "Initial commit", "Release v{version}", etc.) that live entirely on the frontend. No backend support required.

### 4.3 Summary of Rust Changes

| Requirement | New Rust Command? | Details |
|-------------|-------------------|---------|
| CC-04 (commit+push) | No | Frontend orchestration of existing commands |
| CC-05 (auto-navigate) | No | Pure frontend blade navigation |
| CC-06 (amend pre-fill) | No (optional) | `get_last_commit_message()` + frontend parse. Optionally expose `parse_conventional_commit_message` for richer parsing |
| CC-08 (scope frequency) | No | `get_scope_suggestions()` already returns frequency data |
| CC-09 (templates) | No | Frontend-only static data |

---

## 5. Blade Registration Design

### 5.1 New Blade Type

Add to `BladePropsMap` in `src/stores/bladeTypes.ts`:

```ts
"conventional-commit": {
  /** Optional: pre-fill with amend data */
  amendOid?: string;
};
```

### 5.2 Registration File

`src/components/blades/registrations/conventional-commit.ts`:

```ts
import { registerBlade } from "../../../lib/bladeRegistry";
import { ConventionalCommitBlade } from "../ConventionalCommitBlade";

registerBlade<{ amendOid?: string }>({
  type: "conventional-commit",
  defaultTitle: "Conventional Commit",
  component: ConventionalCommitBlade,
  singleton: true, // only one CC blade at a time
  wrapInPanel: true,
  showBack: true,
});
```

### 5.3 Expected Types Update

Update `registrations/index.ts` EXPECTED_TYPES array:

```ts
const EXPECTED_TYPES: string[] = [
  // ... existing types ...
  "conventional-commit",
];
```

### 5.4 Navigation Integration (CC-05, CC-07)

The blade should be opened from:
1. **Command palette:** Register a "Conventional Commit (Blade)" command in `src/commands/sync.ts`
2. **Sidebar toggle:** Add a "Open in blade" button to the existing `CommitForm` CC mode
3. **Keyboard shortcut:** e.g., `mod+shift+c`

After successful commit, auto-navigate back:
```ts
const { goBack, goToRoot } = useBladeNavigation();

// After commit success:
goBack(); // or goToRoot() to return to staging
```

---

## 6. Component Architecture for the Blade

### 6.1 Component Tree

```
ConventionalCommitBlade
├── SplitPaneLayout (autoSaveId="cc-blade-split")
│   ├── primary (left panel - form)
│   │   ├── TypeSelectorGrid (wider: grid-cols-6 or grid-cols-4)
│   │   ├── ScopeAutocomplete (with frequency badge)
│   │   ├── DescriptionInput (with CharacterProgress)
│   │   ├── BodyTextarea (taller, monospace)
│   │   ├── BreakingChangeSection
│   │   └── CommitActionBar
│   │       ├── [Commit] button
│   │       ├── [Commit & Push] button (CC-04)
│   │       ├── Amend toggle (CC-06)
│   │       └── Template dropdown (CC-09)
│   └── detail (right panel - preview + insights)
│       ├── CommitPreview (variant="full", monospace, CC-03)
│       ├── ValidationErrors
│       ├── ScopeFrequencyChart (CC-08)
│       └── TemplateList (CC-09)
```

### 6.2 Coexistence with Sidebar (CC-07)

Both modes share:
- `useConventionalStore` (Zustand state)
- `useConventionalCommit` hook
- `useCommitExecution` hook (new)
- All sub-components (TypeSelector, ScopeAutocomplete, etc.)

The sidebar compact form stays as-is. The blade provides a richer experience. If a user edits in the sidebar, then opens the blade, the Zustand store state persists. If they commit via the blade, the store resets and they navigate back.

### 6.3 Blade Form Guard Integration

The CC blade should use `useBladeFormGuard`:

```ts
const blade = useSelector(actorRef, selectBladeStack).find(b => b.type === "conventional-commit");
const { markDirty, markClean } = useBladeFormGuard(blade?.id ?? "");

// Mark dirty when user starts typing
useEffect(() => {
  if (description || commitType) markDirty();
  else markClean();
}, [description, commitType]);
```

---

## 7. Tailwind v4 Layout Patterns

### 7.1 Full-Width Blade Grid

```tsx
<div className="h-full grid grid-cols-[1fr_1fr] gap-0">
  {/* Left: Form */}
  <div className="h-full overflow-y-auto p-6 space-y-5 border-r border-ctp-surface0">
    ...form fields...
  </div>
  {/* Right: Preview + Insights */}
  <div className="h-full overflow-y-auto p-6 space-y-5">
    ...preview, chart, templates...
  </div>
</div>
```

Or use `SplitPaneLayout` (already used by StagingChangesBlade and InitRepoBlade) for a resizable split.

### 7.2 Monospace Preview (CC-03)

```tsx
<pre className={cn(
  "flex-1 min-h-[200px] p-4 font-mono text-sm leading-relaxed",
  "bg-ctp-mantle border border-ctp-surface0 rounded-lg",
  "text-ctp-subtext1 whitespace-pre-wrap break-words",
  "overflow-y-auto",
)}>
  {currentMessage || "Preview will appear here..."}
</pre>
```

### 7.3 Type Selector in Wide Layout

In the sidebar, the type grid uses `grid-cols-4`. In the blade, it can use `grid-cols-6` or `grid-cols-11` (all types in one row):

```tsx
// TypeSelector could accept a `columns` prop
<div className={cn(
  "grid gap-2",
  variant === "compact" ? "grid-cols-4" : "grid-cols-6",
)}>
```

### 7.4 Scope Frequency Chart (CC-08)

A simple horizontal bar chart using Tailwind:

```tsx
{scopeSuggestions.map(s => (
  <div key={s.scope} className="flex items-center gap-2">
    <span className="text-xs text-ctp-subtext0 w-20 truncate">{s.scope}</span>
    <div className="flex-1 h-3 bg-ctp-surface0 rounded-full overflow-hidden">
      <div
        className="h-full bg-ctp-blue rounded-full"
        style={{ width: `${(s.usageCount / maxCount) * 100}%` }}
      />
    </div>
    <span className="text-xs text-ctp-overlay0 w-8 text-right">{s.usageCount}</span>
  </div>
))}
```

No external chart library needed. This is pure CSS with Tailwind.

### 7.5 Framer-Motion Transitions

The blade system already handles transitions via `bladeTransitionVariants` in `src/lib/animations.ts`. The CC blade gets the standard push/pop animations for free by being a registered blade. No custom animation work needed.

---

## 8. Templates Design (CC-09)

### 8.1 Template Data Structure

```ts
interface CommitTemplate {
  id: string;
  label: string;
  description: string;
  commitType: CommitType;
  scope?: string;
  descriptionTemplate: string;
  bodyTemplate?: string;
  isBreaking?: boolean;
}
```

### 8.2 Predefined Templates

```ts
const COMMIT_TEMPLATES: CommitTemplate[] = [
  {
    id: "initial-commit",
    label: "Initial Commit",
    description: "First commit in a new repository",
    commitType: "feat",
    descriptionTemplate: "initial commit",
  },
  {
    id: "release",
    label: "Release",
    description: "Version release",
    commitType: "chore",
    scope: "release",
    descriptionTemplate: "v{version}",
  },
  {
    id: "dep-update",
    label: "Dependency Update",
    description: "Update project dependencies",
    commitType: "chore",
    scope: "deps",
    descriptionTemplate: "update dependencies",
  },
  {
    id: "breaking-api",
    label: "Breaking API Change",
    description: "API-breaking change with migration notes",
    commitType: "feat",
    descriptionTemplate: "change {what}",
    bodyTemplate: "Migration:\n- {step1}\n- {step2}",
    isBreaking: true,
  },
  {
    id: "bugfix-issue",
    label: "Bug Fix (Issue)",
    description: "Fix linked to an issue",
    commitType: "fix",
    descriptionTemplate: "{description}",
    bodyTemplate: "Fixes #{issueNumber}",
  },
];
```

### 8.3 Template Application

When user selects a template, populate the store fields:
```ts
function applyTemplate(template: CommitTemplate) {
  setCommitType(template.commitType);
  if (template.scope) setScope(template.scope);
  setDescription(template.descriptionTemplate);
  if (template.bodyTemplate) setBody(template.bodyTemplate);
  if (template.isBreaking) setIsBreaking(true);
}
```

Placeholders like `{version}` remain for user to fill in.

---

## 9. Testing Strategy

### 9.1 Unit Tests

| Test Target | File | What to Test |
|-------------|------|--------------|
| `buildCommitMessage()` | `src/lib/conventional-utils.test.ts` | All message formatting cases: type-only, with scope, breaking, body, footer |
| `parseConventionalMessage()` | `src/lib/conventional-utils.test.ts` | Round-trip: build -> parse -> build |
| `useCommitExecution` | `src/hooks/useCommitExecution.test.ts` | commit, commitAndPush, error handling, query invalidation |
| `useAmendPrefill` | `src/hooks/useAmendPrefill.test.ts` | Toggle, pre-fill, confirmation flow |
| Templates | `src/lib/commit-templates.test.ts` | Template application populates correct fields |

### 9.2 Component Tests

| Test Target | File | What to Test |
|-------------|------|--------------|
| `ConventionalCommitBlade` | `src/components/blades/ConventionalCommitBlade.test.tsx` | Renders without crash, form fields visible, commit button disabled when invalid |
| `CommitPreview` | `src/components/commit/CommitPreview.test.tsx` | Correct formatting in compact/full variants |
| `CommitActionBar` | `src/components/commit/CommitActionBar.test.tsx` | Button states, commit & push flow |
| `ScopeFrequencyChart` | `src/components/commit/ScopeFrequencyChart.test.tsx` | Renders bars proportionally |

### 9.3 Mock Strategy

Based on project patterns (from `ChangelogBlade.test.tsx`):

```ts
const mockCommands = vi.hoisted(() => ({
  createCommit: vi.fn().mockResolvedValue({
    status: "ok",
    data: { oid: "abc1234", shortOid: "abc1234", message: "test" },
  }),
  pushToRemote: vi.fn().mockResolvedValue({
    status: "ok",
    data: { success: true, message: "Pushed", commitsTransferred: 1 },
  }),
  getStagingStatus: vi.fn().mockResolvedValue({
    status: "ok",
    data: { staged: [{ path: "test.ts", status: "Modified" }], unstaged: [], untracked: [] },
  }),
  suggestCommitType: vi.fn().mockResolvedValue({
    status: "ok",
    data: { suggestedType: "feat", confidence: "high", reason: "test" },
  }),
  getScopeSuggestions: vi.fn().mockResolvedValue({
    status: "ok",
    data: [{ scope: "ui", usageCount: 10 }],
  }),
  inferScopeFromStaged: vi.fn().mockResolvedValue({
    status: "ok",
    data: "commit",
  }),
  validateConventionalCommit: vi.fn().mockReturnValue({
    isValid: true,
    errors: [],
    warnings: [],
  }),
  getLastCommitMessage: vi.fn().mockResolvedValue({
    status: "ok",
    data: { subject: "feat: test", body: null, fullMessage: "feat: test" },
  }),
}));

vi.mock("../../bindings", () => ({ commands: mockCommands }));
```

### 9.4 Rust Tests

The existing `src-tauri/src/git/conventional.rs` has 13 unit tests covering parsing, validation, type inference, and scope extraction. No new Rust tests needed for Phase 28 unless the optional `parse_conventional_commit_message` IPC command is added.

---

## 10. Performance Considerations

### 10.1 Scope History Query (CC-08)

**Current behavior:** `get_scope_suggestions()` walks 500 commits each time. This is fast for most repos (<100ms) but could be slow for very large repos.

**Recommendation:**
- Cache via React Query with `staleTime: 60_000` (1 minute) -- already the default pattern
- The query key `["scopeSuggestions"]` should be stable
- Invalidate on commit success (new commit may add a scope)

### 10.2 Template Loading (CC-09)

Templates are hardcoded constants. Zero loading cost. Could be extended later to load custom templates from `.flowforge/templates.json` but not needed for Phase 28.

### 10.3 Preview Rendering (CC-03)

`buildCommitMessage()` is a pure synchronous function. No performance concern even with real-time rendering on every keystroke. The debounced validation (300ms) already handles the expensive IPC call.

### 10.4 Lazy Loading the Blade

The blade should use lazy loading like other non-essential blades:

```ts
// In registration file
const ConventionalCommitBlade = lazy(() => import("../ConventionalCommitBlade"));

registerBlade({
  // ...
  component: ConventionalCommitBlade,
  lazy: true,
});
```

The `BladeRenderer` already wraps lazy components in `<Suspense>` with `<BladeLoadingFallback>`.

### 10.5 Zustand Store Memory

The `useConventionalStore` holds form state that persists across blade open/close. This is intentional (CC-07 coexistence), but the `reset()` method should be called after successful commit to free memory.

---

## 11. Implementation Order (Suggested Task Breakdown)

### Task 1: Extract Shared Logic (Refactoring)
**Files to create/modify:**
- Create `src/lib/conventional-utils.ts` (pure functions: build, parse)
- Create `src/hooks/useCommitExecution.ts` (commit + push mutations)
- Create `src/hooks/useAmendPrefill.ts` (amend state management)
- Modify `src/components/commit/CommitForm.tsx` to consume new hooks
- Modify `src/stores/conventional.ts` to delegate to pure functions
- Remove `parseConventionalType` from `src/components/topology/layoutUtils.ts` and import from `conventional-utils.ts`

**Verification:** Existing sidebar commit flow works identically after refactoring.

### Task 2: Extract UI Primitives
**Files to create:**
- Create `src/components/commit/CommitPreview.tsx` (compact + full variants)
- Create `src/components/commit/CommitActionBar.tsx` (commit, commit+push, amend toggle)
- Modify `src/components/commit/ConventionalCommitForm.tsx` to use new primitives

**Verification:** Sidebar CC form looks and works identically.

### Task 3: Create the Blade Shell
**Files to create/modify:**
- Add `"conventional-commit"` to `BladePropsMap` in `src/stores/bladeTypes.ts`
- Create `src/components/blades/ConventionalCommitBlade.tsx`
- Create `src/components/blades/registrations/conventional-commit.ts`
- Update `registrations/index.ts` EXPECTED_TYPES
- Register command in `src/commands/sync.ts`

**Verification:** Blade opens from command palette, renders form + preview, commit works.

### Task 4: Commit+Push and Auto-Navigate (CC-04, CC-05)
**Files to modify:**
- `src/components/blades/ConventionalCommitBlade.tsx` -- wire `commitAndPush` and auto-navigate
- `src/components/commit/CommitActionBar.tsx` -- add "Commit & Push" button

**Verification:** Commit+push executes sequentially. After success, blade pops back to staging.

### Task 5: Amend Mode (CC-06)
**Files to modify:**
- `src/components/blades/ConventionalCommitBlade.tsx` -- wire amend
- `src/hooks/useAmendPrefill.ts` -- parse last message into CC fields

**Verification:** Toggling amend pre-fills type/scope/description/body from last commit.

### Task 6: Scope Frequency Chart + Templates (CC-08, CC-09)
**Files to create:**
- Create `src/components/commit/ScopeFrequencyChart.tsx`
- Create `src/lib/commit-templates.ts` (template definitions)
- Create `src/components/commit/TemplateSelector.tsx`

**Verification:** Chart renders scope bars. Template selection fills form fields.

### Task 7: Tests
**Files to create:**
- `src/lib/conventional-utils.test.ts`
- `src/hooks/useCommitExecution.test.ts`
- `src/components/blades/ConventionalCommitBlade.test.tsx`
- `src/components/commit/CommitPreview.test.tsx`
- `src/components/commit/CommitActionBar.test.tsx`

---

## 12. Open Questions and Decisions

### Q1: Should the blade use `SplitPaneLayout` or a static grid?

**Recommendation:** Use `SplitPaneLayout` with `autoSaveId="cc-blade-split"`. This follows the pattern set by `StagingChangesBlade` and `InitRepoBlade`, gives users control over the split ratio, and persists across sessions.

### Q2: Should the sidebar CommitForm have a button to open the CC blade?

**Recommendation:** Yes. Add a small "expand" icon button next to the "Conventional Commits" checkbox that opens the blade via `openBlade("conventional-commit", {})`. This provides discoverability for CC-07.

### Q3: Should we add a Rust `commit_and_push` combined command?

**Recommendation:** No. Frontend orchestration is cleaner. If push fails after commit, the commit still stands and the user gets a clear error. A combined Rust command would need complex rollback logic.

### Q4: Should templates be user-customizable?

**Recommendation:** Not in Phase 28. Start with hardcoded templates. A future phase could load from `.flowforge/templates.json` or a settings page.

### Q5: Should the blade be opened automatically when the user toggles CC mode?

**Recommendation:** No. The sidebar CC mode should remain for quick commits. The blade is for users who want the full workspace experience. Keep them independent per CC-07.

---

## 13. File Creation Summary

### New Files (11)

| File | Type | Purpose |
|------|------|---------|
| `src/lib/conventional-utils.ts` | Utility | Pure functions: buildCommitMessage, parseConventionalMessage |
| `src/lib/commit-templates.ts` | Data | Predefined commit templates |
| `src/hooks/useCommitExecution.ts` | Hook | Commit + push mutation logic |
| `src/hooks/useAmendPrefill.ts` | Hook | Amend mode + pre-fill management |
| `src/components/commit/CommitPreview.tsx` | Component | Monospace preview (compact/full) |
| `src/components/commit/CommitActionBar.tsx` | Component | Commit/push/amend buttons |
| `src/components/commit/ScopeFrequencyChart.tsx` | Component | Horizontal bar chart |
| `src/components/commit/TemplateSelector.tsx` | Component | Template dropdown/list |
| `src/components/blades/ConventionalCommitBlade.tsx` | Blade | Full-width CC workspace |
| `src/components/blades/registrations/conventional-commit.ts` | Registration | Blade registration |

### Modified Files (6)

| File | Change |
|------|--------|
| `src/stores/bladeTypes.ts` | Add `"conventional-commit"` to `BladePropsMap` |
| `src/stores/conventional.ts` | Delegate `buildCommitMessage` to pure utility |
| `src/components/commit/CommitForm.tsx` | Use `useCommitExecution`, add "open blade" button |
| `src/components/commit/ConventionalCommitForm.tsx` | Use extracted `CommitPreview` and `CommitActionBar` |
| `src/components/blades/registrations/index.ts` | Add to EXPECTED_TYPES |
| `src/commands/sync.ts` | Register "open CC blade" command |

### Test Files (5)

| File |
|------|
| `src/lib/conventional-utils.test.ts` |
| `src/hooks/useCommitExecution.test.ts` |
| `src/components/blades/ConventionalCommitBlade.test.tsx` |
| `src/components/commit/CommitPreview.test.tsx` |
| `src/components/commit/CommitActionBar.test.tsx` |
