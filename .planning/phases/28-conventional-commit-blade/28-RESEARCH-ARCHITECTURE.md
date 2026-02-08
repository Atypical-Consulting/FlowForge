# Phase 28: Conventional Commit Blade - Architecture Research

**Researched:** 2026-02-08
**Domain:** Full-width conventional commit blade workspace
**Confidence:** HIGH

---

## Table of Contents

1. [Existing CC Component Analysis](#1-existing-cc-component-analysis)
2. [Blade Registration Architecture](#2-blade-registration-architecture)
3. [Shared Logic Extraction](#3-shared-logic-extraction)
4. [State Management Design](#4-state-management-design)
5. [XState Integration](#5-xstate-integration)
6. [Scope History & Templates](#6-scope-history--templates)
7. [Extensibility Architecture](#7-extensibility-architecture)
8. [Error Handling & Edge Cases](#8-error-handling--edge-cases)

---

## 1. Existing CC Component Analysis

### Current File Inventory

| File | Role | Lines | Reuse Status |
|------|------|-------|-------------|
| `src/stores/conventional.ts` | Zustand store: form state, async actions, buildCommitMessage | 206 | **EXTRACT** shared logic |
| `src/hooks/useConventionalCommit.ts` | React hook: debounced validation, canCommit, filtered scopes | 184 | **REUSE** as-is (both modes) |
| `src/components/commit/ConventionalCommitForm.tsx` | Sidebar CC form: type/scope/desc/body/breaking/preview | 203 | **KEEP** for sidebar mode |
| `src/components/commit/TypeSelector.tsx` | Type grid (4-col) with suggestion banner | 77 | **REUSE** with layout variants |
| `src/components/commit/ScopeAutocomplete.tsx` | Input with dropdown autocomplete | 206 | **REUSE** as-is |
| `src/components/commit/BreakingChangeSection.tsx` | Checkbox + conditional textarea | 55 | **REUSE** as-is |
| `src/components/commit/CharacterProgress.tsx` | Animated progress bar + remaining count | 53 | **REUSE** as-is |
| `src/components/commit/ValidationErrors.tsx` | Error/warning/success status display | 71 | **REUSE** as-is |
| `src/components/commit/CommitForm.tsx` | Container: mode toggle, simple/CC switch, commit/push mutations | 273 | **EXTRACT** commit+push pipeline |
| `src/lib/commit-type-theme.ts` | Icon/color/badge/emoji per type (single source of truth) | 155 | **REUSE** as-is |
| `src-tauri/src/git/conventional.rs` | Rust: parse, validate, infer type/scope, extract history scopes | 913 | **EXTEND** for templates |
| `src-tauri/src/git/commit.rs` | Rust: createCommit (with amend), getLastCommitMessage | 213 | **REUSE** as-is |

### Current Data Flow (Sidebar Mode)

```
RepositoryView
  +-- CommitForm  (sidebar, pinned at bottom of left panel)
        |-- [toggle: simple | conventional]
        |
        +-- ConventionalCommitForm
              |-- useConventionalCommit()  -->  useConventionalStore (Zustand)
              |       |-- fetchTypeSuggestion()     --> commands.suggestCommitType()
              |       |-- fetchScopeSuggestions()    --> commands.getScopeSuggestions()
              |       |-- fetchInferredScope()       --> commands.inferScopeFromStaged()
              |       |-- validateMessage()          --> commands.validateConventionalCommit()
              |       +-- buildCommitMessage()       --> local string builder
              |
              |-- TypeSelector
              |-- ScopeAutocomplete
              |-- BreakingChangeSection
              |-- CharacterProgress
              |-- ValidationErrors
              +-- [Preview <pre>]
              +-- [Commit button]  -->  CommitForm.commitMutation
                                           |-- commands.createCommit(msg, amend)
                                           +-- toast "Push now" action
```

### Key Observations

1. **CommitForm owns the mutation logic** (commitMutation, pushMutation, amend state) -- this is currently coupled to the sidebar. The blade needs identical logic.
2. **ConventionalCommitForm is pure UI** -- it takes `onCommit` callback and delegates execution. This is a clean interface that the blade can also consume.
3. **useConventionalCommit hook** is the main bridge between store and UI. Both sidebar and blade can use this hook unchanged.
4. **useConventionalStore** holds all form state globally. A single instance means sidebar and blade would share state (which is actually desirable for CC-07 coexistence).
5. **Amend logic** lives in CommitForm (not in ConventionalCommitForm). Needs to be extracted for the blade.

---

## 2. Blade Registration Architecture

### How Blades Work

The blade system follows a 4-step registration pattern:

```
1. BladePropsMap        (src/stores/bladeTypes.ts)
   - Central type map: blade-type-key -> required props interface
   - Single source of truth for type safety

2. registerBlade()      (src/lib/bladeRegistry.ts)
   - Runtime registry: Map<BladeType, BladeRegistration>
   - Config: component, defaultTitle, singleton, wrapInPanel, showBack, etc.

3. Registration file    (src/components/blades/registrations/*.ts)
   - Auto-discovered by import.meta.glob in registrations/index.ts
   - Each file's top-level registerBlade() call executes on import

4. Blade component      (src/components/blades/*Blade.tsx)
   - Receives typed props, renders content
   - BladeRenderer wraps in BladePanel (title bar, back button)
```

### Registration Flow Diagram

```
  bladeTypes.ts
  +------------------------------+
  | BladePropsMap {              |
  |   "staging-changes": {}     |
  |   "settings": {}            |   <-- ADD: "conventional-commit": { amend?: boolean }
  |   "init-repo": { path }     |
  |   ...                       |
  | }                           |
  +------------------------------+
             |
             v
  registrations/conventional-commit.ts    <-- NEW FILE
  +------------------------------+
  | registerBlade({              |
  |   type: "conventional-commit"|
  |   defaultTitle: "Commit"     |
  |   component: lazy(() =>      |
  |     import("../CCBlade"))    |
  |   singleton: true            |   <-- Only one CC blade at a time
  |   wrapInPanel: true          |   <-- Gets BladePanel header
  |   showBack: true             |
  | })                           |
  +------------------------------+
             |
             v
  registrations/index.ts
  +------------------------------+
  | import.meta.glob discovers   |
  | conventional-commit.ts       |
  | auto-registers at startup    |
  |                              |
  | EXPECTED_TYPES[] needs       |   <-- ADD "conventional-commit"
  | updating for dev check       |
  +------------------------------+
```

### Full-Width vs Sidebar Distinction

The blade system does NOT have an explicit "full-width" concept. Every active blade gets `className="flex-1 min-w-0"` in BladeContainer:

```tsx
// BladeContainer.tsx line 56
<motion.div
  key={activeBlade.id}
  className="flex-1 min-w-0"   // <-- fills remaining space
>
  <BladeRenderer blade={activeBlade} goBack={...} />
</motion.div>
```

When pushed as a blade, it automatically gets the full remaining width (minus collapsed BladeStrips for parent blades). The CC blade will naturally be "full-width" because it pushes on top of the staging blade, which collapses to a BladeStrip.

**No special infrastructure needed for full-width.** The blade simply uses `wrapInPanel: true` and fills its container. The internal layout can use `SplitPaneLayout` or custom flex layouts.

### Singleton Enforcement

The CC blade should be singleton (only one instance at a time):

```ts
// navigationMachine.ts line 13
const SINGLETON_TYPES = new Set(["settings", "changelog", "gitflow-cheatsheet"]);
```

**Decision:** Add `"conventional-commit"` to SINGLETON_TYPES in the navigation machine AND set `singleton: true` in the registration.

---

## 3. Shared Logic Extraction

### What Must Be Shared

Both the sidebar CommitForm and the blade ConventionalCommitBlade need:

| Logic | Current Location | Extraction Target |
|-------|-----------------|-------------------|
| Form state (type, scope, desc, body, breaking) | `stores/conventional.ts` | **Keep** -- already shared via store |
| buildCommitMessage() | `stores/conventional.ts` | **Keep** -- already in store |
| Validation & suggestions | `stores/conventional.ts` | **Keep** -- already in store |
| commitMutation (createCommit IPC) | `CommitForm.tsx` (local) | **EXTRACT** to `hooks/useCommitMutation.ts` |
| pushMutation (pushToRemote IPC) | `CommitForm.tsx` (local) | **EXTRACT** to `hooks/useCommitMutation.ts` |
| Amend pre-fill logic | `CommitForm.tsx` (local) | **EXTRACT** to `hooks/useAmendCommit.ts` or extend conventional store |
| commit+push pipeline | `CommitForm.tsx` (local) | **EXTRACT** to `hooks/useCommitPipeline.ts` |
| canCommit guard | `useConventionalCommit.ts` | **Keep** -- already in hook |

### Recommended Extraction Architecture

```
src/hooks/
  useConventionalCommit.ts      # EXISTING - form state bridge (keep)
  useCommitExecution.ts         # NEW - commit mutation + push + toast
  useAmendCommit.ts             # NEW - amend state, pre-fill logic
  useCommitPipeline.ts          # NEW - orchestrates commit -> push -> navigate

src/stores/
  conventional.ts               # EXISTING - form state (extend for amend + templates)
```

### useCommitExecution Hook (New)

Extracted from CommitForm.tsx lines 80-118:

```typescript
// src/hooks/useCommitExecution.ts
export function useCommitExecution() {
  const queryClient = useQueryClient();

  const pushMutation = useMutation({
    mutationFn: () => {
      const channel = new Channel<SyncProgress>();
      return commands.pushToRemote("origin", channel);
    },
    onSuccess: () => {
      toast.success("Pushed to origin");
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
    },
    onError: (error) => {
      toast.error(`Push failed: ${String(error)}`, {
        label: "Retry",
        onClick: () => pushMutation.mutate(),
      });
    },
  });

  const commitMutation = useMutation({
    mutationFn: ({ message, amend }: { message: string; amend: boolean }) =>
      commands.createCommit(message, amend),
    onSuccess: (_data, { message }) => {
      queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
      queryClient.invalidateQueries({ queryKey: ["repositoryStatus"] });

      const short = message.length > 50 ? `${message.slice(0, 50)}...` : message;
      toast.success(`Committed: ${short}`, {
        label: "Push now",
        onClick: () => pushMutation.mutate(),
      });
    },
    onError: (error) => {
      toast.error(`Commit failed: ${String(error)}`);
    },
  });

  return { commitMutation, pushMutation };
}
```

### useCommitPipeline Hook (New - CC-04)

Orchestrates commit + optional push + navigation:

```typescript
// src/hooks/useCommitPipeline.ts
export function useCommitPipeline(options?: {
  pushAfterCommit?: boolean;
  navigateAfterCommit?: boolean;
}) {
  const { commitMutation, pushMutation } = useCommitExecution();
  const { goBack, resetStack } = useBladeNavigation();

  async function execute(message: string, amend: boolean) {
    const result = await commitMutation.mutateAsync({ message, amend });

    if (options?.pushAfterCommit) {
      await pushMutation.mutateAsync();
    }

    if (options?.navigateAfterCommit) {
      // CC-05: auto-navigate back to staging
      goBack();
    }

    return result;
  }

  return {
    execute,
    isCommitting: commitMutation.isPending,
    isPushing: pushMutation.isPending,
    isExecuting: commitMutation.isPending || pushMutation.isPending,
    commitError: commitMutation.error,
    pushError: pushMutation.error,
  };
}
```

---

## 4. State Management Design

### Store Architecture Decision

**Recommendation: Extend the existing `useConventionalStore`** rather than creating a new store.

Rationale:
- CC-07 requires sidebar and blade to coexist. Shared store means state persists when switching between modes.
- The store already holds all form fields. Adding amend/template state is additive.
- The `useConventionalCommit` hook already abstracts the store; both modes use the same hook.

### Extended Store Shape

```typescript
interface ConventionalState {
  // === EXISTING (keep all) ===
  commitType: CommitType | "";
  scope: string;
  description: string;
  body: string;
  isBreaking: boolean;
  breakingDescription: string;
  typeSuggestion: TypeSuggestion | null;
  scopeSuggestions: ScopeSuggestion[];
  inferredScope: string | null;
  validation: ValidationResult | null;
  isValidating: boolean;

  // === NEW for Phase 28 ===

  // CC-06: Amend state
  isAmend: boolean;
  setIsAmend: (amend: boolean) => void;
  prefillFromLastCommit: () => Promise<void>;

  // CC-04: Push-after-commit preference
  pushAfterCommit: boolean;
  setPushAfterCommit: (push: boolean) => void;

  // CC-09: Template state
  activeTemplate: CommitTemplate | null;
  setActiveTemplate: (template: CommitTemplate | null) => void;
  applyTemplate: (template: CommitTemplate) => void;

  // CC-08: Scope frequency data (enhanced)
  scopeFrequencies: ScopeFrequency[];
  fetchScopeFrequencies: () => Promise<void>;

  // === EXISTING actions (keep all) ===
  setCommitType: (type: CommitType | "") => void;
  setScope: (scope: string) => void;
  // ... etc
}
```

### Amend State Flow (CC-06)

```
User clicks "Amend" checkbox in CC blade
  |
  v
store.setIsAmend(true)
  |
  v
store.prefillFromLastCommit()
  |-- commands.getLastCommitMessage()
  |-- Parse the returned fullMessage:
  |     - Extract type from "type(scope): desc"
  |     - Extract scope
  |     - Extract description
  |     - Extract body
  |     - Detect BREAKING CHANGE footer
  |-- Set all fields in store
  v
UI reactively updates all form fields
```

Implementation detail for parsing the last commit message into CC fields:

```typescript
prefillFromLastCommit: async () => {
  const result = await commands.getLastCommitMessage();
  if (result.status !== "ok") return;

  const msg = result.data;
  // Attempt CC parse via backend
  const validation = await commands.validateConventionalCommit(msg.fullMessage);

  if (validation.isValid) {
    // Parse locally (message already validated)
    const match = msg.subject.match(
      /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/
    );
    if (match) {
      set({
        commitType: match[1] as CommitType,
        scope: match[2] || "",
        isBreaking: !!match[3],
        description: match[4],
        body: msg.body || "",
      });
    }
  } else {
    // Non-CC commit -- put entire message in description
    set({ description: msg.subject, body: msg.body || "" });
  }
},
```

### Commit + Push Pipeline State (CC-04)

The `pushAfterCommit` boolean lives in the store so it persists across blade open/close. The actual execution is in the `useCommitPipeline` hook (see Section 3).

```
User toggles "Commit & Push" in blade
  |
  v
store.setPushAfterCommit(true)
  |
User clicks primary action button
  |
  v
useCommitPipeline.execute(message, amend)
  |-- commitMutation.mutateAsync(...)
  |     |-- SUCCESS: invalidate queries, show toast
  |     +-- FAILURE: show error, stop pipeline
  |
  |-- if (pushAfterCommit):
  |     pushMutation.mutateAsync(...)
  |       |-- SUCCESS: toast "Pushed to origin"
  |       +-- FAILURE: toast error with retry (commit already succeeded)
  |
  +-- if (navigateAfterCommit):
        goBack()  // CC-05: return to staging
```

---

## 5. XState Integration

### Navigation Machine Events

The CC blade uses standard blade navigation events. No new XState events needed.

```
Opening the CC blade:
  actorRef.send({
    type: "PUSH_BLADE",
    bladeType: "conventional-commit",
    title: "Conventional Commit",
    props: { amend: false }
  })

Closing (back button or post-commit):
  actorRef.send({ type: "POP_BLADE" })
```

### How to Open the CC Blade

Multiple entry points:

1. **From sidebar:** Add "Expand" button next to "Conventional Commits" toggle
2. **From command palette:** Register a command `open-conventional-commit`
3. **Keyboard shortcut:** e.g. `mod+shift+c`

```typescript
// Using bladeOpener for non-React contexts
import { openBlade } from "../lib/bladeOpener";
openBlade("conventional-commit", { amend: false });

// Using hook inside React components
const { openBlade } = useBladeNavigation();
openBlade("conventional-commit", { amend: false });
```

### Post-Commit Auto-Navigation (CC-05)

After successful commit (and optional push), the blade calls `goBack()` via the navigation hook:

```typescript
// Inside ConventionalCommitBlade.tsx
const { goBack } = useBladeNavigation();
const pipeline = useCommitPipeline({
  pushAfterCommit: store.pushAfterCommit,
  navigateAfterCommit: true,  // CC-05
});

const handleCommit = async () => {
  try {
    await pipeline.execute(currentMessage, store.isAmend);
    // goBack() already called inside pipeline if navigateAfterCommit=true
    store.reset();
  } catch (err) {
    // Error already handled by pipeline (toast shown)
    // Do NOT navigate -- keep blade open so user can fix/retry
  }
};
```

**Important:** If commit succeeds but push fails, the blade should still navigate back (commit is complete). The push error shows as a persistent toast with "Retry" action.

### Dirty Form Guard Integration (CC Blade)

The CC blade uses `useBladeFormGuard` to prevent accidental navigation away from unsaved form state:

```typescript
function ConventionalCommitBlade({ amend }: { amend?: boolean }) {
  const blade = useSelector(actorRef, selectActiveBlade);
  const { markDirty, markClean } = useBladeFormGuard(blade.id);
  const { description, commitType } = useConventionalCommit();

  // Mark dirty when user has typed anything
  useEffect(() => {
    if (description.trim() || commitType) {
      markDirty();
    } else {
      markClean();
    }
  }, [description, commitType, markDirty, markClean]);

  // markClean is auto-called on unmount by useBladeFormGuard
}
```

This integrates with the existing `confirmingDiscard` state in the FSM and the `NavigationGuardDialog` component.

### Singleton Guard

Add to the navigation machine:

```typescript
// navigationMachine.ts line 13
const SINGLETON_TYPES = new Set([
  "settings",
  "changelog",
  "gitflow-cheatsheet",
  "conventional-commit",   // <-- ADD
]);
```

---

## 6. Scope History & Templates

### Scope Frequency Tracking (CC-08)

**Data source:** The existing `get_scope_suggestions` Tauri command already returns `ScopeSuggestion { scope, usageCount }` sorted by frequency. This is extracted from the last 500 commits via `extract_scopes_from_history()` in `conventional.rs`.

**Current behavior:**
- Called on mount via `fetchScopeSuggestions()` in the store
- Returns scopes with `usage_count >= 2` (filters likely typos)
- Limited to `limit` results (default 20)

**What's needed for CC-08 visualization:**
1. Expose the full frequency data (not just top-N for autocomplete)
2. Add a visual component that renders scope usage as a chart or tag cloud

**Architecture:**

```
Backend (EXISTING -- adequate):
  get_scope_suggestions(limit: Option<u32>)  --> Vec<ScopeSuggestion>
  - Already returns { scope, usage_count } sorted by frequency
  - Pass higher limit (e.g., 50) for visualization

Frontend (NEW):
  src/components/commit/ScopeFrequencyChart.tsx
  - Takes scopeSuggestions[] as prop
  - Renders horizontal bar chart or weighted tag cloud
  - Catppuccin colors, proportional widths
  - Clickable: clicking a scope fills the scope field

Store extension:
  scopeFrequencies: ScopeFrequency[]   // same type as ScopeSuggestion
  fetchScopeFrequencies: () => Promise<void>
  // Calls getScopeSuggestions(50) for broader dataset
```

**Visualization options:**

Option A -- Horizontal bar chart (recommended):
```
auth      ████████████████████  24
api       ██████████████        18
ui        ████████████          15
git       ████████              10
config    ██████                 7
```

Option B -- Weighted tag cloud:
```
  auth  api  ui  git  config  tests  build
  (size proportional to usage)
```

**Recommendation:** Option A (bar chart) is more scannable in a sidebar/panel context. Can be placed in a collapsible section of the CC blade.

### Template Management (CC-09)

**Architecture decision:** Templates are static, shipped with the app, and defined in TypeScript. No backend persistence needed for v1. User-created templates can come later.

**Template data model:**

```typescript
// src/lib/commitTemplates.ts
export interface CommitTemplate {
  id: string;
  name: string;
  description: string;
  fields: {
    commitType: CommitType;
    scope?: string;
    description: string;
    body?: string;
    isBreaking?: boolean;
    breakingDescription?: string;
  };
}

export const BUILTIN_TEMPLATES: CommitTemplate[] = [
  {
    id: "feature-add",
    name: "New Feature",
    description: "Adding a new user-facing feature",
    fields: {
      commitType: "feat",
      description: "",
      body: "## What\n\n## Why\n\n## How\n",
    },
  },
  {
    id: "bugfix",
    name: "Bug Fix",
    description: "Fixing a reported bug",
    fields: {
      commitType: "fix",
      description: "",
      body: "## Problem\n\n## Root Cause\n\n## Fix\n",
    },
  },
  {
    id: "breaking-change",
    name: "Breaking Change",
    description: "Introducing a breaking API change",
    fields: {
      commitType: "feat",
      description: "",
      isBreaking: true,
      body: "## Migration Guide\n\n",
      breakingDescription: "",
    },
  },
  {
    id: "dependency-update",
    name: "Dependency Update",
    description: "Updating project dependencies",
    fields: {
      commitType: "chore",
      scope: "deps",
      description: "update dependencies",
      body: "## Updated\n\n## Breaking\n\n",
    },
  },
  {
    id: "release",
    name: "Release",
    description: "Version release commit",
    fields: {
      commitType: "chore",
      scope: "release",
      description: "",
    },
  },
];
```

**Applying a template:**

```typescript
// In the store
applyTemplate: (template: CommitTemplate) => {
  set({
    commitType: template.fields.commitType,
    scope: template.fields.scope ?? "",
    description: template.fields.description,
    body: template.fields.body ?? "",
    isBreaking: template.fields.isBreaking ?? false,
    breakingDescription: template.fields.breakingDescription ?? "",
    activeTemplate: template,
  });
},
```

**UI component:**

```typescript
// src/components/commit/TemplateSelector.tsx
// Dropdown or card grid showing available templates
// Clicking one calls store.applyTemplate(template)
// Shows template name + description
// Active template highlighted
```

---

## 7. Extensibility Architecture

### Component Tree Design

The CC blade uses a slot-based composition pattern that allows future features to plug in without restructuring:

```
ConventionalCommitBlade
+--------------------------------------------------------------------+
|  BladePanel (header: "Conventional Commit", back button)           |
|  +----------------------------------------------------------------+|
|  | SplitPaneLayout (autoSaveId="cc-blade-split")                  ||
|  |                                                                ||
|  | PRIMARY (form side, ~55%)         DETAIL (preview side, ~45%)  ||
|  | +----------------------------+   +---------------------------+ ||
|  | | <FormHeader>               |   | <PreviewHeader>           | ||
|  | |  Template selector (CC-09) |   |  Format: plain | rendered | ||
|  | | </FormHeader>              |   | </PreviewHeader>          | ||
|  | |                            |   |                           | ||
|  | | <FormBody>                 |   | <PreviewBody>             | ||
|  | |  TypeSelector              |   |  Monospace formatted      | ||
|  | |  ScopeAutocomplete         |   |  commit message (CC-03)   | ||
|  | |  Description input         |   |  with syntax highlighting | ||
|  | |  CharacterProgress         |   |                           | ||
|  | |  Body textarea             |   | </PreviewBody>            | ||
|  | |  BreakingChangeSection     |   |                           | ||
|  | |  ValidationErrors          |   | <PreviewFooter>           | ||
|  | | </FormBody>                |   |  Scope frequency (CC-08)  | ||
|  | |                            |   | </PreviewFooter>          | ||
|  | | <FormFooter>               |   |                           | ||
|  | |  [x] Push after commit     |   | [FUTURE: AI suggestions]  | ||
|  | |  [x] Amend (CC-06)        |   | [FUTURE: side-by-side]    | ||
|  | |  [Commit] [Commit & Push]  |   +---------------------------+ ||
|  | | </FormFooter>              |                                 ||
|  | +----------------------------+                                 ||
|  +----------------------------------------------------------------+|
+--------------------------------------------------------------------+
```

### Plugin Points for Future Features

| Extension Point | Location | How to Add |
|----------------|----------|------------|
| AI suggestions panel | PreviewBody or new tab | Add tab in preview area; fetch from AI service |
| Side-by-side diff | New tab or split view | Add toggle to switch preview between "message" and "diff" modes |
| Co-author input | FormBody (after body textarea) | Add Co-authored-by footer field component |
| Emoji prefix toggle | FormHeader | Toggle that prepends emoji from commit-type-theme |
| GPG signing indicator | FormFooter status | Read git config, show lock icon |
| Template editor | Modal or settings tab | CRUD interface for CommitTemplate objects |
| Scope statistics detail | PreviewFooter expandable | Expand ScopeFrequencyChart into full analysis |

### Composition Pattern

Each section is a discrete component with well-defined props:

```typescript
// Form-side components (PRIMARY panel)
<CCFormHeader
  templates={BUILTIN_TEMPLATES}
  activeTemplate={store.activeTemplate}
  onApplyTemplate={store.applyTemplate}
/>

<CCFormBody>
  <TypeSelector ... />
  <ScopeAutocomplete ... />
  <DescriptionInput ... />
  <BodyEditor ... />
  <BreakingChangeSection ... />
  <ValidationErrors ... />
  {/* FUTURE: slot for additional form fields */}
  {children}
</CCFormBody>

<CCFormFooter
  canCommit={canCommit}
  isAmend={store.isAmend}
  pushAfterCommit={store.pushAfterCommit}
  onAmendChange={store.setIsAmend}
  onPushChange={store.setPushAfterCommit}
  onCommit={handleCommit}
  isExecuting={pipeline.isExecuting}
/>

// Preview-side components (DETAIL panel)
<CCPreviewHeader
  mode={previewMode}
  onModeChange={setPreviewMode}
/>

<CCPreviewBody
  message={currentMessage}
  mode={previewMode}
/>

<CCPreviewFooter>
  <ScopeFrequencyChart
    scopes={store.scopeFrequencies}
    onScopeClick={(scope) => store.setScope(scope)}
  />
</CCPreviewFooter>
```

### File Organization

```
src/components/commit/
  ConventionalCommitForm.tsx         # EXISTING (sidebar compact mode)
  CommitForm.tsx                     # EXISTING (sidebar container)
  TypeSelector.tsx                   # EXISTING (reused by blade)
  ScopeAutocomplete.tsx              # EXISTING (reused by blade)
  BreakingChangeSection.tsx          # EXISTING (reused by blade)
  CharacterProgress.tsx              # EXISTING (reused by blade)
  ValidationErrors.tsx               # EXISTING (reused by blade)
  CommitSearch.tsx                   # EXISTING
  CommitDetails.tsx                  # EXISTING
  CommitHistory.tsx                  # EXISTING
  index.ts                           # EXISTING (update exports)
  TemplateSelector.tsx               # NEW (CC-09)
  ScopeFrequencyChart.tsx            # NEW (CC-08)
  CommitPreview.tsx                  # NEW (CC-03, monospace preview)

src/components/blades/
  ConventionalCommitBlade.tsx        # NEW (blade shell)
  registrations/
    conventional-commit.ts           # NEW (registration)

src/hooks/
  useConventionalCommit.ts           # EXISTING (keep)
  useCommitExecution.ts              # NEW (extracted mutations)
  useCommitPipeline.ts               # NEW (commit+push+navigate)
  useAmendCommit.ts                  # NEW (amend prefill logic)

src/stores/
  conventional.ts                    # EXISTING (extend)

src/lib/
  commitTemplates.ts                 # NEW (CC-09 template definitions)
  commit-type-theme.ts               # EXISTING (keep)
```

---

## 8. Error Handling & Edge Cases

### Error Categories

| Error | Source | Handling |
|-------|--------|----------|
| No staged changes | `commands.createCommit` -> `NoStagedChanges` | Disable commit button; show message. If blade opened without staged files, show empty state with "Stage files first" CTA |
| Missing git config (name/email) | `commands.createCommit` -> `SignatureError` | Show error toast with link to Settings blade |
| Commit message validation fail | `commands.validateConventionalCommit` | Real-time inline errors via `ValidationErrors` component |
| Commit mutation error | Network/IPC failure | Toast with error message; keep blade open for retry |
| Push auth failure | `commands.pushToRemote` -> `GitError` | Toast with "Retry" action; commit already succeeded, so navigate back but show persistent push error |
| Push network failure | No remote connection | Same as auth failure -- commit succeeded, push is best-effort |
| Amend with no HEAD | `commands.getLastCommitMessage` -> `EmptyRepository` | Disable amend checkbox; tooltip "No commits to amend" |
| Merge conflict during commit | git2 error | Toast with detailed message; user needs to resolve conflicts first |
| Store desync (sidebar edits while blade open) | Shared Zustand store | Non-issue -- both read from same store. Changes in sidebar instantly reflect in blade and vice versa |
| Blade navigation while committing | User clicks back during async commit | Dirty guard dialog triggers. If user discards, cancel pending mutation. If commit already in flight, let it complete (fire-and-forget) |

### Error Flow Diagram

```
User clicks [Commit & Push]
  |
  v
pipeline.execute(message, amend)
  |
  +-- Stage 1: Commit
  |     |
  |     +-- SUCCESS --> continue to Stage 2
  |     |
  |     +-- FAILURE
  |           |-- NoStagedChanges  --> toast.warning("No staged changes")
  |           |-- SignatureError   --> toast.error("Configure git user")
  |           |                        + action: "Open Settings"
  |           |-- Other            --> toast.error("Commit failed: {msg}")
  |           +-- STOP (don't push, don't navigate)
  |
  +-- Stage 2: Push (if pushAfterCommit)
  |     |
  |     +-- SUCCESS --> toast.success("Pushed to origin")
  |     |
  |     +-- FAILURE
  |           |-- Auth error      --> toast.error("Push failed: auth")
  |           |                        + action: "Retry"
  |           |-- Network error   --> toast.error("Push failed: network")
  |           |                        + action: "Retry"
  |           +-- CONTINUE (commit succeeded, push is optional)
  |
  +-- Stage 3: Navigate (CC-05)
        |
        +-- goBack() --> returns to staging blade
        +-- store.reset() --> clear form fields
```

### Graceful Degradation

1. **Backend IPC failures:** All Tauri commands return `Result<T, GitError>`. The store already handles errors with try/catch. The blade should show a non-blocking error state (toast) rather than crashing.

2. **Partial pipeline success:** If commit succeeds but push fails, the commit is NOT rolled back. The user is notified that push failed and given a retry action. The staging area correctly shows the commit was made (no more staged changes).

3. **Concurrent operations:** The `commitMutation.isPending` flag disables the submit button, preventing double-commits. The push button similarly guards against concurrent pushes.

4. **Form state persistence:** Because the store is global (Zustand), if the blade is closed and reopened, the form state persists. The `reset()` function should be called:
   - After successful commit
   - When user explicitly cancels
   - NOT on blade unmount (allows reopening with state intact)

### Edge Case: Amend Parsing Failure

When the last commit is not a conventional commit (e.g., "WIP" or "merge commit"), the amend prefill should gracefully degrade:

```
Last commit: "Merge branch 'feature/x' into main"
  |
  v
validateConventionalCommit() --> isValid: false
  |
  v
Fallback: put entire subject as description, body as body
  commitType remains ""
  User must manually select a type
  Validation errors shown inline
```

---

## Appendix: Complete Architecture Diagram

```
+---------------------------+      +---------------------------+
|   RepositoryView          |      |   Command Palette         |
|   +-- Left Sidebar        |      |   +-- "Open CC Blade"     |
|   |   +-- CommitForm      |      +---------------------------+
|   |       |-- simple mode |                    |
|   |       +-- CC mode     |                    |  openBlade("conventional-commit", {})
|   |           (compact)   |                    |
|   +-- BladeContainer      |<-------------------+
|       +-- [BladeStrip]*   |
|       +-- ActiveBlade     |
|           |               |
|           v               |
| +--ConventionalCommitBlade--+    (when CC blade is active)
| |                            |
| | useConventionalCommit()    |--- useConventionalStore (Zustand)
| | useCommitPipeline()        |       |
| | useBladeFormGuard()        |       |-- form state
| |                            |       |-- suggestions
| | SplitPaneLayout            |       |-- validation
| | +-- Form Panel             |       |-- amend state
| | |   TypeSelector           |       |-- push preference
| | |   ScopeAutocomplete      |       +-- template state
| | |   Description            |
| | |   Body                   |
| | |   BreakingChangeSection  |    Tauri IPC
| | |   ValidationErrors       |    +-- commands.createCommit()
| | |   TemplateSelector       |    +-- commands.pushToRemote()
| | |   [Commit & Push]        |    +-- commands.validateConventionalCommit()
| | +-- Preview Panel          |    +-- commands.suggestCommitType()
| |     CommitPreview          |    +-- commands.getScopeSuggestions()
| |     ScopeFrequencyChart    |    +-- commands.inferScopeFromStaged()
| +----------------------------+    +-- commands.getLastCommitMessage()
|                              |
+------------------------------+

XState Navigation FSM
+------------------------------+
| navigating                   |
|   PUSH_BLADE (CC) -->        |
|     [isNotSingleton?]        |
|     [isUnderMaxDepth?]       |
|     --> pushBlade             |
|                              |
|   POP_BLADE -->              |
|     [isTopBladeDirty?]       |
|     --> confirmingDiscard    |  (if dirty form)
|     --> popBlade             |  (if clean)
+------------------------------+
```

---

## Summary of Recommendations

| Area | Recommendation |
|------|---------------|
| Blade type | Add `"conventional-commit"` to `BladePropsMap` with `{ amend?: boolean }` props |
| Registration | Singleton, `wrapInPanel: true`, lazy-loaded |
| State | Extend existing `useConventionalStore`; do NOT create a separate store |
| Shared logic | Extract `useCommitExecution`, `useCommitPipeline`, `useAmendCommit` hooks |
| Layout | `SplitPaneLayout` with form (55%) and preview (45%) |
| Full-width | No special handling needed -- blade system already fills available width |
| Navigation | Standard PUSH_BLADE/POP_BLADE events; add to SINGLETON_TYPES |
| Dirty guard | Use `useBladeFormGuard` with description/commitType as dirty signals |
| Post-commit | `goBack()` after successful commit; persist push errors as toasts |
| Templates | Static TypeScript definitions shipped with app; `CommitTemplate` interface |
| Scope viz | Horizontal bar chart from existing `getScopeSuggestions(50)` data |
| Error handling | Two-stage pipeline (commit -> push); push failure does not block navigation |
| Sidebar coexistence | Same store, same hook; sidebar and blade show identical state |
