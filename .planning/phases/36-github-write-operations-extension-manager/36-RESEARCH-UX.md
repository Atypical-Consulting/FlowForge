# Phase 36: GitHub Write Operations & Extension Manager - UX Research

**Researched:** 2026-02-10
**Domain:** UX patterns for GitHub write operations (merge PR, create PR) and extension manager blade
**Perspective:** UX specialist (focused on interaction patterns, wireframes, accessibility, and extensibility from a design lens)
**Confidence:** HIGH

## Summary

Phase 36 introduces write operations to the GitHub integration (merge PR with strategy selector, create PR from current branch) and a full extension manager blade for installing, enabling/disabling, and uninstalling extensions. This research examines how leading tools (GitHub.com, GitHub Desktop, GitKraken, VS Code, Obsidian, JetBrains) handle these interaction patterns and maps them to FlowForge's existing UI primitives.

The codebase already has strong patterns to build on: the `Dialog`/`DialogContent`/`DialogHeader`/`DialogFooter` system with framer-motion animations and focus management, the `Button` component with `variant="destructive"` for dangerous actions, the `Input`/`Textarea` form components, the `SettingsField` layout pattern, and the `MergeDialog`/`FinishFlowDialog` precedents for confirmation flows. The existing `PullRequestDetailBlade` from Phase 35 provides the natural location for merge actions, and the `ExtensionHost` Zustand store with its `ExtensionInfo` type provides all the data needed for the extension manager blade.

The key UX challenge is not building new primitives but composing existing ones into new flows: (1) a merge confirmation dialog with strategy selection, (2) a create-PR blade as a form, (3) an extension manager blade with list + detail sections, and (4) an extension install flow with manifest review. Each flow must follow established patterns to feel native within FlowForge.

**Primary recommendation:** Use the existing `Dialog` component for the merge confirmation (not a new blade), build "Create PR" as a new blade with the `ConventionalCommitBlade` form pattern as precedent, and build the Extension Manager as a new core blade using the `SettingsBlade` section-based layout as precedent.

## UX Patterns from Competitive Analysis

### Pattern 1: PR Merge Strategy Selector

**Source:** GitHub.com, GitHub Desktop, GitKraken, Tower
**Confidence:** HIGH (multiple sources agree)

Every major Git tool uses a split-button or dropdown pattern for merge strategy selection:

| Tool | Pattern | Default Strategy | Strategies Available |
|------|---------|-----------------|---------------------|
| GitHub.com | Green split button + dropdown chevron | Last used (per-repo setting) | Merge commit, Squash, Rebase |
| GitHub Desktop | Merge button + dropdown | Merge commit | Merge commit, Squash, Rebase |
| GitKraken | Merge button in PR view | Merge commit | Merge commit, Squash, Rebase |
| Tower | Dropdown select in merge dialog | Merge commit | Merge commit, Squash, Rebase, Fast-forward |

**GitHub.com's split-button pattern** is the most established: a primary action button ("Merge pull request") with a small dropdown chevron that reveals the three strategy options. The last-used strategy is remembered per repository. This pattern works because the most common action (merge) is one click, while changing strategy is two clicks.

**Recommendation for FlowForge:** Do NOT use a split button (the split-button pattern requires hover states and click-target precision that can be frustrating on desktop). Instead, use a **radio group within the merge confirmation dialog**. This is cleaner for a dialog-based flow and gives equal visual weight to all three options. The selected strategy should be persisted per-repository using the existing settings store.

**Wireframe: Merge Confirmation Dialog**

```
+--------------------------------------------------+
|  [GitMerge icon]  Merge Pull Request        [X]  |
+--------------------------------------------------+
|                                                   |
|  Merge #42 "feat: add dark mode" into main?       |
|                                                   |
|  [branch-name] -> [main]                          |
|                                                   |
|  ---- Merge Strategy ----                         |
|                                                   |
|  (o) Merge commit                                 |
|      All commits preserved with a merge commit    |
|                                                   |
|  ( ) Squash and merge                             |
|      All commits squashed into a single commit    |
|                                                   |
|  ( ) Rebase and merge                             |
|      Commits rebased onto base branch linearly    |
|                                                   |
|  [Optional: commit message input when Squash      |
|   or Merge commit is selected]                    |
|                                                   |
|         [Cancel]     [Merge Pull Request]         |
+--------------------------------------------------+
```

### Pattern 2: Merge Confirmation - Destructive Action UX

**Source:** NN/g, UX Movement, Carbon Design System, existing FlowForge dialogs
**Confidence:** HIGH

Merging a PR is a semi-destructive action -- it modifies the target branch and cannot easily be undone. Best practices for destructive confirmations:

1. **Use descriptive button labels** -- "Merge Pull Request" not "OK" or "Yes". This matches the existing `NavigationGuardDialog` which uses "Discard Changes" instead of "Yes".
2. **Default focus on the safe option** -- Focus "Cancel" first, not "Merge". The `NavigationGuardDialog` already does this with `autoFocus` on the "Stay" button.
3. **Show what will happen** -- Display source branch, target branch, and PR title in the dialog body so the user can verify.
4. **Color-code the action button** -- Use `bg-ctp-green` for merge (constructive action) rather than `bg-ctp-red`. Merge is not destructive; it is additive. Reserve red for truly destructive actions (delete branch, force push).
5. **Show blocking conditions** -- If CI checks are failing or the branch has conflicts, show a warning banner ABOVE the merge button with an explanation of why merging might be risky. Do NOT disable the button entirely (the user may have good reasons to override).

**Recommendation:** Use the existing `Dialog`/`DialogContent`/`DialogFooter` component. Add a warning section for failing checks or conflicts using `AlertTriangle` icon with `text-ctp-yellow`. The merge button should be `bg-ctp-green` to match the semantics of GitHub's green merge button.

**Pre-merge checks wireframe:**

```
+--------------------------------------------------+
|  [AlertTriangle] Warning                          |
|  2 of 5 status checks are failing.               |
|  Branch has merge conflicts.                      |
+--------------------------------------------------+
```

When conflicts exist, show an `AlertTriangle` banner and DISABLE the merge button with text "Cannot merge -- conflicts exist." When only checks are failing (but no conflicts), show the warning but keep the button enabled.

### Pattern 3: Create PR Form Blade

**Source:** GitHub.com, GitHub Desktop, GitKraken Desktop 11.1, Bitbucket
**Confidence:** HIGH

All tools pre-fill the PR creation form from branch and commit data:

| Field | Auto-fill Source | Editable? |
|-------|-----------------|-----------|
| Title | Single commit: commit message subject. Multiple commits: branch name cleaned up (e.g., `feature/add-dark-mode` -> "Add dark mode") | Yes |
| Body | Single commit: commit body. Multiple commits: bulleted list of commit messages | Yes |
| Base branch | Repository default branch (usually `main` or `develop`) | Yes (dropdown) |
| Head branch | Current branch | No (informational) |
| Draft | Checkbox, default unchecked | Yes |

**Branch name -> title conversion rules:**
- Strip prefix: `feature/`, `fix/`, `chore/`, `hotfix/`, `release/`
- Replace `-` and `_` with spaces
- Capitalize first letter
- Example: `feature/add-dark-mode-support` -> "Add dark mode support"

**Wireframe: Create PR Blade**

```
+--------------------------------------------------+
|  [<-] Create Pull Request                         |
+--------------------------------------------------+
|                                                   |
|  From: [feature/add-dark-mode] -> Base: [main v]  |
|                                                   |
|  Title:                                           |
|  [Add dark mode support____________________]      |
|                                                   |
|  Description:                                     |
|  +----------------------------------------------+ |
|  | - feat: add dark theme toggle                 | |
|  | - fix: theme persistence on reload            | |
|  | - chore: update tailwind config               | |
|  +----------------------------------------------+ |
|  |                                        6 lines| |
|  +----------------------------------------------+ |
|  [Preview]  (toggles markdown preview)            |
|                                                   |
|  [x] Draft pull request                           |
|                                                   |
|  ---- Labels ---- (optional)                      |
|  [ Select labels... v ]                           |
|                                                   |
|         [Cancel]    [Create Pull Request]          |
+--------------------------------------------------+
```

**Recommendation:** Build "Create PR" as a new blade (`ext:github:create-pr`), NOT a dialog. The form has enough fields to justify a full blade, and it follows the `ConventionalCommitBlade` precedent (multi-field form with preview). Use `wrapInPanel: true, showBack: true` so the back button returns to the PR list. Pre-fill title and body from the Rust backend (a new Tauri command that reads current branch name and commit log). Provide a markdown preview toggle for the description body using the existing `MarkdownRenderer`.

**Base branch selection:** Use a simple `<select>` dropdown populated from the repository's branch list (already available from `useBranchStore`). Default to the repo's default branch (available from GitHub API or detect from `HEAD` -> remote tracking).

### Pattern 4: Extension Manager Blade - List with Actions

**Source:** VS Code Extensions view, JetBrains Plugins, Obsidian Community Plugins
**Confidence:** HIGH

Extension manager UIs across all tools follow a consistent pattern:

| Tool | Layout | Per-extension Actions | Filter/Search |
|------|--------|----------------------|---------------|
| VS Code | Vertical list, icon + name + version + author + description | Enable/Disable, Uninstall, Settings gear menu | Search bar + category filter tabs (Installed, Recommended, etc.) |
| JetBrains | Vertical list, icon + name + version + author + description | Enable/Disable checkbox, Uninstall | Search + Installed/Marketplace tabs |
| Obsidian | Vertical list, name + author + description + download count | Enable/Disable toggle, Uninstall, Options | Search + filter by installed/enabled |

**Common elements across all three:**
1. Each extension shows: name, version, short description, status indicator (enabled/disabled/error)
2. Enable/disable is the primary interaction -- usually a toggle switch
3. Uninstall requires confirmation
4. The list shows what each extension contributes (VS Code shows "Contributes: Commands, Languages, Themes")
5. Search filters the installed list by name/description

**Recommendation for FlowForge:** Build the Extension Manager as a scrollable list blade with two sections: "Installed Extensions" (always visible, shows both built-in and external) and an "Install Extension" section at the bottom or behind an "Install" button.

**Wireframe: Extension Manager Blade**

```
+--------------------------------------------------+
|  [<-] Extension Manager                           |
+--------------------------------------------------+
|  [Search extensions..._______________] [+ Install] |
+--------------------------------------------------+
|                                                   |
|  INSTALLED (3)                                    |
|                                                   |
|  +----------------------------------------------+ |
|  | [GitHub icon]  GitHub Integration   v1.0.0    | |
|  | Built-in  |  Active                           | |
|  | Blades: 6  Commands: 4  Toolbar: 3            | |
|  |                        [Disable v] [Uninstall]| |
|  +----------------------------------------------+ |
|  | [Puzzle icon]  My Custom Ext        v0.2.1    | |
|  | External  |  Active                           | |
|  | Blades: 2  Commands: 1  Toolbar: 0            | |
|  | Permissions: network, git-operations           | |
|  |                        [Disable v] [Uninstall]| |
|  +----------------------------------------------+ |
|  | [AlertTriangle]  Broken Extension   v1.3.0    | |
|  | External  |  Error                            | |
|  | Error: Incompatible API version               | |
|  |                                   [Uninstall] | |
|  +----------------------------------------------+ |
|                                                   |
+--------------------------------------------------+
```

**Key design decisions:**
- **Built-in extensions** show "Built-in" badge and have no "Uninstall" button (only "Disable")
- **External extensions** show both "Disable" and "Uninstall"
- **Error state extensions** show the error message inline with `text-ctp-red`
- **Contribution summary** shows counts of blades, commands, and toolbar items each extension contributes (data available from `ExtensionContributes` in the manifest)
- **Permissions** are shown as colored pills for external extensions (using `LabelPill` pattern)

### Pattern 5: Extension Install Flow

**Source:** VS Code (marketplace install), Obsidian (community plugins), Chrome Extensions (manifest review)
**Confidence:** HIGH

The install flow for extensions from a URL follows these steps in competitive products:

| Step | VS Code | Obsidian | Chrome |
|------|---------|---------|--------|
| 1. Input | Search marketplace | Browse community list | Chrome Web Store URL |
| 2. Fetch | Auto-download from marketplace | Click Install | Auto-download VSIX/CRX |
| 3. Review | Shows extension details + permissions warning | Shows toggle warning | Shows permissions prompt |
| 4. Confirm | Click Install | Click Enable | Click Add Extension |
| 5. Activate | Auto-activate, may require reload | Auto-activate | Auto-activate |

**FlowForge's model is URL-based**, similar to installing a VS Code extension from VSIX or Obsidian's BRAT plugin for beta testing. The user enters a GitHub repository URL or local path, the app fetches and validates the manifest, displays it for review, and the user confirms.

**Wireframe: Extension Install Flow (Dialog-based, multi-step)**

```
Step 1: Enter URL
+--------------------------------------------------+
|  Install Extension                           [X]  |
+--------------------------------------------------+
|                                                   |
|  Extension Source:                                |
|  [https://github.com/user/ext-repo_____]         |
|                                                   |
|  or drag & drop a .flowforge extension folder     |
|                                                   |
|              [Cancel]     [Fetch Manifest]         |
+--------------------------------------------------+

Step 2: Review Manifest (shown after fetch succeeds)
+--------------------------------------------------+
|  Install Extension                           [X]  |
+--------------------------------------------------+
|                                                   |
|  [Puzzle icon]                                    |
|  My Extension Name          v1.0.0                |
|  by extension-author                              |
|                                                   |
|  "Adds GitLab merge request support"              |
|                                                   |
|  ---- Contributions ----                          |
|  Blades: mr-list, mr-detail                       |
|  Commands: open-merge-requests                    |
|  Toolbar: open-mrs                                |
|                                                   |
|  ---- Permissions ----                            |
|  [shield] network         Access external APIs    |
|  [shield] git-operations  Read/write git data     |
|                                                   |
|  [!] This extension requests the following        |
|      permissions. Only install extensions you      |
|      trust.                                       |
|                                                   |
|           [Cancel]     [Install & Activate]        |
+--------------------------------------------------+

Step 3: Installing (brief loading state)
+--------------------------------------------------+
|  Install Extension                           [X]  |
+--------------------------------------------------+
|                                                   |
|  [Spinner] Installing "My Extension Name"...      |
|                                                   |
+--------------------------------------------------+

Step 4: Success / Error
+--------------------------------------------------+
|  Install Extension                           [X]  |
+--------------------------------------------------+
|                                                   |
|  [Check icon, green]                              |
|  "My Extension Name" installed successfully!       |
|                                                   |
|  The extension has been activated and its          |
|  contributions are now available.                  |
|                                                   |
|                                      [Done]        |
+--------------------------------------------------+
```

**Recommendation:** Use a dialog (not a blade) for the install flow. It is a focused, short-lived interaction that should overlay the extension manager. Use the existing `Dialog` component with step-based state management (`useState<"input" | "review" | "installing" | "success" | "error">`). The manifest review step is critical for trust -- show permissions prominently with shield icons and a warning callout.

**Validation failure wireframe:**

```
+--------------------------------------------------+
|  Install Extension                           [X]  |
+--------------------------------------------------+
|                                                   |
|  [X icon, red]                                    |
|  Manifest validation failed                        |
|                                                   |
|  * Missing required field: "apiVersion"            |
|  * Invalid permission: "execute-arbitrary-code"    |
|                                                   |
|              [Cancel]     [Try Again]              |
+--------------------------------------------------+
```

### Pattern 6: Enable/Disable Toggle UX

**Source:** VS Code, JetBrains, Obsidian, iOS Settings
**Confidence:** HIGH

All extension managers use a toggle switch for enable/disable. Key UX considerations:

1. **Immediate effect** -- toggling should take effect immediately (no "Apply" button needed). VS Code, Obsidian, and JetBrains all apply immediately.
2. **Visual feedback** -- the toggle should clearly show on/off state. Use the existing Tailwind toggle pattern: `bg-ctp-green` when enabled, `bg-ctp-surface1` when disabled.
3. **Loading state** -- show a brief spinner on the toggle during activation/deactivation (the `ExtensionHost` operations are async).
4. **Toast notification** -- show a success/error toast after toggle completes: "Extension 'X' disabled" / "Extension 'X' enabled."
5. **Built-in protection** -- built-in extensions (like GitHub) should have the toggle available but show a warning dialog before disabling: "Disabling this built-in extension will remove its toolbar actions, commands, and blades."

**Recommendation:** Use a custom toggle component (the project does not currently have one). Build a simple `Toggle` component using the CVA pattern from `button.tsx`:

```tsx
// Toggle visual states:
// ON:  bg-ctp-green with white circle right
// OFF: bg-ctp-surface1 with overlay circle left
// Loading: replace circle with Loader2 spinner
```

### Pattern 7: Uninstall Confirmation

**Source:** VS Code, Obsidian, macOS app deletion
**Confidence:** HIGH

Uninstalling an extension is a destructive action. All tools show a confirmation:

- VS Code: Simple "Are you sure?" dialog
- Obsidian: "Are you sure?" with extension name
- macOS: "Are you sure you want to delete X?" with explicit "Delete" button

**Recommendation:** Use the existing `Dialog` component with `variant="destructive"` button styling:

```
+--------------------------------------------------+
|  Uninstall Extension                         [X]  |
+--------------------------------------------------+
|                                                   |
|  Remove "My Extension Name" and all its data?      |
|                                                   |
|  This will remove:                                |
|  - 2 blades (mr-list, mr-detail)                  |
|  - 1 command (open-merge-requests)                 |
|  - 1 toolbar action (open-mrs)                     |
|                                                   |
|  This action cannot be undone.                     |
|                                                   |
|           [Cancel]     [Uninstall]                 |
+--------------------------------------------------+
```

The "Uninstall" button uses `bg-ctp-red` (destructive variant). Focus defaults to "Cancel".

## Extensibility-First Design Considerations

### Core vs Extension Visual Identity

**Source:** VS Code, JetBrains
**Confidence:** HIGH

**Key insight:** Extension-contributed UI should NOT look different from core UI. Users care about functionality, not provenance. VS Code, JetBrains, and Obsidian all make extension-contributed UI indistinguishable from built-in features during normal use.

**Where to show provenance:**
1. **Extension Manager blade** -- shows which blades, commands, and toolbar items each extension contributes
2. **Command palette** -- commands are already grouped by category (the extension's `category` field)
3. **Settings > Extensions** -- if extension-specific settings are needed later

**Where NOT to show provenance:**
1. Toolbar buttons -- extension toolbar items should use the same `ToolbarButton` component as core items (already the case)
2. Blade chrome -- extension blades should use the same `BladePanel` wrapping as core blades (already the case with `wrapInPanel: true`)
3. In-blade content -- no "Extension" badges or watermarks

**Recommendation:** Do NOT add visual indicators that distinguish extension content from core content during normal usage. The extension manager blade is the appropriate place to see what each extension contributes.

### Theme Compliance for Extension UI

**Source:** VS Code theme API, Obsidian CSS variables
**Confidence:** MEDIUM (forward-looking concern)

Currently all extensions are built-in and use `--ctp-*` tokens directly. When external extensions arrive, they need to use the same tokens to maintain visual consistency. The extension API should provide guidance (documentation, not enforcement) that extension components must use `--ctp-*` CSS custom properties rather than hardcoded colors.

**Recommendation for Phase 36:** No enforcement mechanism needed yet. Document in the extension manifest schema that extensions should use `--ctp-*` tokens. If an extension uses hardcoded colors, it will look wrong but not break anything.

### Blade Consistency for Extension-Contributed Views

Extensions register blades via `api.registerBlade()` with `wrapInPanel: true` and `showBack: true`. This ensures:
- Same header chrome (title, back button, trailing actions)
- Same animation (slide-in from right, managed by `BladeContainer`)
- Same collapse behavior (strip preview in `BladeStrip`)

**Recommendation:** No changes needed. The existing `BladeRegistration` system already enforces visual consistency. The only thing to verify is that extension blades that DON'T opt into `wrapInPanel` still render correctly within the blade stack container.

## Component Architecture for Phase 36

### New UI Components Needed

| Component | Location | Pattern Source | Purpose |
|-----------|----------|---------------|---------|
| `MergePRDialog` | `src/extensions/github/components/` | `MergeDialog.tsx` + `Dialog` | Merge confirmation with strategy selector |
| `CreatePRBlade` | `src/extensions/github/blades/` | `ConventionalCommitBlade` | PR creation form |
| `ExtensionManagerBlade` | `src/blades/extension-manager/` | `SettingsBlade` | List & manage extensions |
| `ExtensionCard` | `src/blades/extension-manager/components/` | New (simple card) | Single extension display in manager |
| `InstallExtensionDialog` | `src/blades/extension-manager/components/` | `Dialog` | Multi-step install flow |
| `Toggle` | `src/components/ui/` | CVA pattern from `button.tsx` | Enable/disable toggle switch |
| `PermissionBadge` | `src/blades/extension-manager/components/` | `LabelPill` | Permission display pill |
| `MergeStrategySelector` | `src/extensions/github/components/` | Radio group | Strategy radio buttons |

### Extension Manager: Core vs Extension Blade?

**Decision point:** Should the Extension Manager be a core blade or an extension-contributed blade?

**Recommendation:** Core blade. The Extension Manager manages ALL extensions, including itself. It should NOT be an extension because:
1. It needs to function even when extensions fail to load
2. It accesses `useExtensionHost` store directly
3. It is part of the app's infrastructure, not optional functionality

Register it in `BladePropsMap` as a core blade type `"extension-manager"` with `Record<string, never>` props. Add a toolbar action in the `app` group (near the settings gear) or a command palette entry.

### Where Merge Action Lives in the UI

**Decision point:** Where does the user initiate a PR merge?

**Option A:** Button in the PR detail blade header (trailing section)
**Option B:** Button in the PR detail blade body (alongside PR metadata)
**Option C:** Command palette only

**Recommendation:** Option A -- Add a "Merge" button in the PR detail blade's trailing section (using `renderTrailing` in the blade registration). This follows the pattern of VS Code's merge button at the top of the PR view and GitHub.com's merge button at the bottom of the conversation. The trailing section is visible without scrolling and provides a clear call to action.

The button should be:
- Visible only when PR state is "open" and not draft
- Show "Merge" with a `GitMerge` icon
- Clicking opens the `MergePRDialog`

**Wireframe: PR Detail Blade with Merge Action**

```
+--------------------------------------------------+
|  [<-] Pull Request #42          [Merge] [GitHub]  |
+--------------------------------------------------+
|  feat: add dark mode support                      |
|  [Open] #42  @author  3 days ago                  |
|  feature/dark-mode -> main                        |
|  ... (existing PR detail content from Phase 35)   |
+--------------------------------------------------+
```

### Where Create PR Action Lives in the UI

**Decision point:** How does the user initiate creating a new PR?

**Recommendation:** Two entry points:
1. **Toolbar button** -- New toolbar action "Create PR" in `views` group, visible when authenticated + GitHub remote detected + current branch is not the default branch. Uses `+` or `GitPullRequestCreate` icon.
2. **Command palette** -- "GitHub: Create Pull Request" command.

Both open the `CreatePRBlade` which fetches current branch name and commits from the backend.

## Accessibility Considerations

### Merge Dialog Accessibility

1. **Dialog role:** Use `role="dialog"` and `aria-modal="true"` (already handled by `DialogContent`)
2. **Radio group:** Use `role="radiogroup"` with `role="radio"` on each strategy option, `aria-checked` state
3. **Focus trap:** Handled by `DialogContent`'s existing focus management
4. **Escape to close:** Handled by existing `DialogContent` keydown handler
5. **Button labels:** "Merge Pull Request" (not "Merge" -- more descriptive)
6. **Warning announcement:** Use `aria-live="polite"` on the warning section for failing checks

### Extension Manager Accessibility

1. **Toggle label:** Each toggle must have an `aria-label` like "Enable My Extension Name" / "Disable My Extension Name"
2. **Status announcement:** After toggling, announce via `aria-live="polite"`: "Extension 'X' has been disabled"
3. **Extension list:** Use `role="list"` with `role="listitem"` for each extension card
4. **Search:** `aria-label="Search installed extensions"` on the search input

### Create PR Form Accessibility

1. **Form labels:** All inputs must have associated `<label>` elements (use `htmlFor` pattern from `SettingsField`)
2. **Required fields:** Mark Title as required with `aria-required="true"`
3. **Character count:** If title has a limit, announce remaining characters (pattern from `CharacterProgress` in commit form)
4. **Error states:** Display validation errors with `aria-describedby` linking to error messages

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation dialog | Custom overlay | `Dialog`/`DialogContent`/`DialogFooter` | Has animation, focus trap, Escape handler, backdrop click |
| Form layout | Custom field wrappers | `SettingsField` pattern | Consistent label + description + input layout |
| Destructive button | Custom red button | `Button` with `variant="destructive"` | Consistent hover, focus, disabled states |
| Loading button | Custom spinner button | `Button` with `loading` prop | Spinner + disabled + text swap built in |
| Toast notifications | Custom alert | `toast.success()` / `toast.error()` | Consistent positioning, auto-dismiss, action support |
| Markdown preview | Custom renderer | `MarkdownRenderer` (existing) | GFM, code highlighting, image handling |
| Branch selection | Custom autocomplete | Simple `<select>` from `useBranchStore` | Branches are already loaded; dropdown is sufficient |
| Extension data | Custom state | `useExtensionHost` store | All extension info already tracked here |

**Key insight:** Phase 36's UX is entirely composable from existing primitives. The only new reusable component needed is a `Toggle` switch.

## Common Pitfalls

### Pitfall 1: Merge Without Refresh

**What goes wrong:** User merges PR, blade still shows "Open" status
**Why it happens:** TanStack Query cache is stale after the mutation
**How to avoid:** After a successful merge, invalidate the PR detail query (`["ext:github", "pullRequest", owner, repo, number]`) AND the PR list query (`["ext:github", "pullRequests", ...]`). Use `useMutation` with `onSuccess` callback that calls `queryClient.invalidateQueries()`.
**Warning signs:** PR detail shows "Open" after merge, list still shows the PR in "Open" tab

### Pitfall 2: Create PR with Empty Title

**What goes wrong:** User clears the auto-filled title and tries to submit
**Why it happens:** Title is pre-filled but editable; the user might accidentally clear it
**How to avoid:** Validate that title is non-empty before enabling the submit button. Show inline validation error below the title field: "Title is required." Match the existing `ValidationErrors` pattern from `ConventionalCommitBlade`.
**Warning signs:** API error 422 returned from GitHub

### Pitfall 3: Merge Strategy Not Available

**What goes wrong:** User selects "Rebase" but the repo only allows "Squash"
**Why it happens:** Repository settings restrict which merge methods are allowed
**How to avoid:** Fetch repo settings (or detect from error) and disable unavailable strategies in the radio group. Show a tooltip: "This merge method is not enabled for this repository." If detection is too expensive (extra API call), handle the 405 error gracefully with a clear message.
**Warning signs:** 405 Method Not Allowed from GitHub API

### Pitfall 4: Extension Toggle Without Feedback

**What goes wrong:** User toggles an extension off, nothing visibly happens
**Why it happens:** Deactivation is fast, no visual confirmation
**How to avoid:** Show a toast notification after toggle: "Extension 'GitHub Integration' disabled." Update the toggle state immediately (optimistic) with rollback on error.
**Warning signs:** User confusion about whether the toggle worked

### Pitfall 5: Install Dialog Stuck on Loading

**What goes wrong:** Manifest fetch takes forever, user has no way to cancel
**Why it happens:** Network request to fetch manifest from URL hangs
**How to avoid:** Add a 15-second timeout on the manifest fetch. Show a cancel button during the loading state. Show elapsed time: "Fetching manifest... (5s)". On timeout, show error: "Request timed out. Check the URL and try again."
**Warning signs:** Spinning indicator with no progress or cancel option

### Pitfall 6: Lost Form State on Accidental Navigation

**What goes wrong:** User is filling out the Create PR form and accidentally clicks Back
**Why it happens:** No dirty-form guard on the blade
**How to avoid:** Use the `useBladeFormGuard` hook (already exists, used by `ConventionalCommitBlade`). Mark the blade as dirty when the user edits any field. The `NavigationGuardDialog` will prompt before discarding.
**Warning signs:** User loses their PR description after accidental back navigation

### Pitfall 7: Built-In Extension Uninstall Attempted

**What goes wrong:** User tries to uninstall the GitHub built-in extension
**Why it happens:** No guard against uninstalling built-in extensions
**How to avoid:** Do NOT show an "Uninstall" button for extensions where `builtIn === true` in the `ExtensionInfo`. Only show "Disable". The Extension Manager card should display "Built-in" badge for these extensions.
**Warning signs:** Error or crash when trying to uninstall a built-in

## Code Examples (Aligned to Existing Codebase Patterns)

### Merge Strategy Radio Group

```tsx
// Pattern based on existing radio usage in ScopeSelector.tsx
// Source: existing codebase pattern

type MergeStrategy = "merge" | "squash" | "rebase";

const MERGE_STRATEGIES: { value: MergeStrategy; label: string; description: string }[] = [
  { value: "merge", label: "Merge commit", description: "All commits preserved with a merge commit" },
  { value: "squash", label: "Squash and merge", description: "All commits squashed into a single commit" },
  { value: "rebase", label: "Rebase and merge", description: "Commits rebased onto base branch linearly" },
];

function MergeStrategySelector({
  value,
  onChange,
  disabledStrategies = [],
}: {
  value: MergeStrategy;
  onChange: (strategy: MergeStrategy) => void;
  disabledStrategies?: MergeStrategy[];
}) {
  return (
    <div role="radiogroup" aria-label="Merge strategy" className="space-y-2">
      {MERGE_STRATEGIES.map((strategy) => {
        const isDisabled = disabledStrategies.includes(strategy.value);
        return (
          <label
            key={strategy.value}
            className={cn(
              "flex items-start gap-3 p-2.5 rounded-md border cursor-pointer transition-colors",
              value === strategy.value
                ? "border-ctp-blue/50 bg-ctp-blue/10"
                : "border-ctp-surface1 bg-ctp-surface0 hover:bg-ctp-surface1",
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <input
              type="radio"
              name="merge-strategy"
              value={strategy.value}
              checked={value === strategy.value}
              onChange={() => !isDisabled && onChange(strategy.value)}
              disabled={isDisabled}
              className="mt-0.5 accent-ctp-blue"
              aria-checked={value === strategy.value}
            />
            <div>
              <p className="text-sm font-medium text-ctp-text">{strategy.label}</p>
              <p className="text-xs text-ctp-overlay0 mt-0.5">{strategy.description}</p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
```

### Merge PR Dialog Composition

```tsx
// Pattern based on NavigationGuardDialog + MergeDialog
// Source: existing codebase patterns

function MergePRDialog({
  open,
  onClose,
  pr,
  owner,
  repo,
}: {
  open: boolean;
  onClose: () => void;
  pr: PullRequestDetail;
  owner: string;
  repo: string;
}) {
  const [strategy, setStrategy] = useState<MergeStrategy>("merge");
  const [commitMessage, setCommitMessage] = useState("");

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const result = await commands.githubMergePullRequest(
        owner, repo, pr.number, strategy, commitMessage || undefined
      );
      if (result.status === "error") throw new Error(extractErrorMessage(result.error));
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ext:github", "pullRequest", owner, repo, pr.number] });
      queryClient.invalidateQueries({ queryKey: ["ext:github", "pullRequests", owner, repo] });
      toast.success(`Pull request #${pr.number} merged successfully`);
      onClose();
    },
    onError: (err) => {
      toast.error(`Merge failed: ${err.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-ctp-green" />
            <DialogTitle>Merge Pull Request</DialogTitle>
          </div>
        </DialogHeader>

        <p className="text-sm text-ctp-subtext0 mb-3">
          Merge <span className="font-medium text-ctp-text">#{pr.number} {pr.title}</span> into{" "}
          <code className="bg-ctp-surface0 px-1 rounded text-ctp-subtext1">{pr.baseRef}</code>
        </p>

        <MergeStrategySelector value={strategy} onChange={setStrategy} />

        {(strategy === "merge" || strategy === "squash") && (
          <div className="mt-3">
            <label className="block text-xs text-ctp-overlay0 mb-1">
              Commit message (optional)
            </label>
            <Textarea
              inputSize="sm"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder={`Merge pull request #${pr.number}`}
              rows={2}
            />
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose} autoFocus>
            Cancel
          </Button>
          <Button
            className="bg-ctp-green text-ctp-base hover:bg-ctp-green/90"
            loading={mergeMutation.isPending}
            loadingText="Merging..."
            onClick={() => mergeMutation.mutate()}
          >
            Merge Pull Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Extension Card Component

```tsx
// Pattern based on SettingsField + extension info display
// Source: existing codebase patterns

function ExtensionCard({ ext }: { ext: ExtensionInfo }) {
  const { activateExtension, deactivateExtension } = useExtensionHost();
  const [isToggling, setIsToggling] = useState(false);

  const contributes = ext.manifest.contributes;
  const bladeCount = contributes?.blades?.length ?? 0;
  const commandCount = contributes?.commands?.length ?? 0;
  const toolbarCount = contributes?.toolbar?.length ?? 0;

  const isActive = ext.status === "active";
  const isError = ext.status === "error";

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      if (isActive) {
        await deactivateExtension(ext.id);
        toast.info(`Extension "${ext.name}" disabled`);
      } else {
        await activateExtension(ext.id);
        toast.success(`Extension "${ext.name}" enabled`);
      }
    } catch (e) {
      toast.error(`Failed to ${isActive ? "disable" : "enable"} "${ext.name}"`);
    }
    setIsToggling(false);
  };

  return (
    <div className={cn(
      "p-4 rounded-lg border transition-colors",
      isError ? "border-ctp-red/30 bg-ctp-red/5" : "border-ctp-surface1 bg-ctp-surface0"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-ctp-text truncate">{ext.name}</h3>
            <span className="text-xs text-ctp-overlay0">v{ext.version}</span>
            {ext.builtIn && (
              <span className="text-[10px] px-1.5 py-0.5 bg-ctp-surface1 text-ctp-overlay0 rounded-full">
                Built-in
              </span>
            )}
          </div>
          {ext.manifest.description && (
            <p className="text-xs text-ctp-overlay0 mt-1">{ext.manifest.description}</p>
          )}
          {isError && ext.error && (
            <p className="text-xs text-ctp-red mt-1">{ext.error}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-ctp-overlay0">
            {bladeCount > 0 && <span>Blades: {bladeCount}</span>}
            {commandCount > 0 && <span>Commands: {commandCount}</span>}
            {toolbarCount > 0 && <span>Toolbar: {toolbarCount}</span>}
          </div>
          {ext.manifest.permissions && ext.manifest.permissions.length > 0 && (
            <div className="flex gap-1 mt-2">
              {ext.manifest.permissions.map((perm) => (
                <PermissionBadge key={perm} permission={perm} />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isError && (
            <Toggle
              checked={isActive}
              onChange={handleToggle}
              loading={isToggling}
              aria-label={`${isActive ? "Disable" : "Enable"} ${ext.name}`}
            />
          )}
          {!ext.builtIn && (
            <Button variant="ghost" size="sm" className="text-ctp-red hover:text-ctp-red">
              Uninstall
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Toggle Switch Component

```tsx
// New reusable component following CVA pattern from button.tsx
// Source: Tailwind toggle switch pattern

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  loading?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}

function Toggle({ checked, onChange, loading, disabled, "aria-label": ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled || loading}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ctp-overlay0",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-ctp-green" : "bg-ctp-surface1"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-ctp-base shadow transition duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      >
        {loading && (
          <Loader2 className="w-3 h-3 animate-spin text-ctp-overlay0 absolute inset-0 m-auto" />
        )}
      </span>
    </button>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate merge button per strategy | Split button with dropdown (GitHub.com) | 2021+ | One-click for default, two for alternatives |
| Custom dialog overlays | Composable Dialog component with focus trap | 2023+ | Consistent accessibility, animation |
| "Yes/No" confirmation buttons | Verb+Noun labels ("Merge Pull Request", "Uninstall") | 2022+ (NN/g) | Fewer misclicks, clearer intent |
| Extension install without review | Permission review step before activation | 2023+ (Chrome MV3) | User trust, security transparency |
| Color-only toggle switches | Toggle with `role="switch"` + `aria-checked` | 2023+ (ARIA APG) | Screen reader compatibility |
| Manual PR title entry | AI-generated or auto-filled from branch+commits | 2024+ (GitKraken 11.1) | Faster PR creation |

## Open Questions

1. **Should the Create PR blade show a markdown preview toggle?**
   - What we know: GitHub.com has a "Preview" tab next to "Write". The existing `ConventionalCommitBlade` has a live preview panel.
   - What's unclear: Whether the split-pane preview or a tab toggle is better for the blade width
   - Recommendation: Use a simple "Preview" toggle button (not a tab, not a split pane). The blade is narrow; a split pane would make both panes too small. When preview is active, replace the textarea with rendered markdown. Match the pattern from GitHub.com's "Write | Preview" tabs.

2. **Should the extension manager allow reordering extension priority?**
   - What we know: Toolbar action priority determines rendering order. Extensions currently use fixed priority values.
   - What's unclear: Whether users need control over extension execution order
   - Recommendation: Defer. Priority is a developer concern, not an end-user concern. The extension manager should show extensions in alphabetical order, not by priority.

3. **Where should the Extension Manager blade be accessible from?**
   - What we know: Settings blade already exists. Extension Manager could be a tab within settings or a separate blade.
   - What's unclear: Whether it belongs in settings or is important enough for its own access point
   - Recommendation: Add it as a toolbar action in the `app` group (Puzzle icon, priority 55 between GitHub and Settings) AND as a section in the Settings blade under "Integrations" (with a "Manage Extensions" button that opens the Extension Manager blade). This gives two discovery paths.

4. **Should merge strategy selection persist across sessions?**
   - What we know: GitHub.com remembers the last-used strategy per repo. Users develop preferences.
   - What's unclear: Where to store this preference (localStorage, app settings, per-repo)
   - Recommendation: Store per-repo in the existing app settings mechanism. Default to "merge" if no preference exists. This matches GitHub.com's behavior and reduces friction for users who always squash.

5. **Should we show the PR template selector when creating a PR?**
   - What we know: Many repos have `.github/pull_request_template.md`. GitHub.com auto-fills the body with this template.
   - What's unclear: Whether fetching and parsing PR templates is worth the complexity in Phase 36
   - Recommendation: Defer template selection to a later phase. For Phase 36, auto-fill with commit messages only. If the repo has a default PR template, GitHub's API will automatically include it in the created PR's body. Explicit template selection adds complexity for a niche use case.

## Sources

### Primary (HIGH confidence)
- **FlowForge codebase** - Direct inspection of `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`, `Button`, `Input`, `Textarea`, `SettingsField`, `MergeDialog`, `FinishFlowDialog`, `NavigationGuardDialog`, `PullRequestDetailBlade`, `PullRequestListBlade`, `ExtensionHost`, `ExtensionAPI`, `ExtensionInfo`, `extensionManifest.ts`, `toolbarRegistry.ts`, `bladeRegistry.ts`, `toast.ts`, `ConventionalCommitBlade`
- **GitHub REST API docs** - Merge PR endpoint (PUT /repos/{owner}/{repo}/pulls/{number}/merge), Create PR endpoint (POST /repos/{owner}/{repo}/pulls)
- **NN/g** - Confirmation dialog best practices (https://www.nngroup.com/articles/confirmation-dialog/)

### Secondary (MEDIUM confidence)
- **GitHub.com merge UX** - Split button with strategy dropdown, pre-filled PR creation (https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github)
- **GitKraken Desktop 11.1** - AI-generated PR titles, auto-fill from commits (https://www.gitkraken.com/blog/gitkraken-desktop-11-1-auto-gen-pr-title-descriptions-stash-messages-more)
- **VS Code Extension Marketplace UX** - Extension list, enable/disable, search patterns (https://code.visualstudio.com/docs/editor/extension-marketplace)
- **VS Code UX Guidelines** - Extension contribution patterns (https://code.visualstudio.com/api/ux-guidelines/overview)
- **Obsidian Community Plugins** - Plugin install flow, toggle pattern, security warnings (https://help.obsidian.md/community-plugins)
- **UX Movement** - Destructive action button design (https://uxmovement.com/buttons/how-to-design-destructive-actions-that-prevent-data-loss/)
- **Carbon Design System** - Dialog pattern guidelines (https://carbondesignsystem.com/patterns/dialog-pattern/)

### Tertiary (LOW confidence)
- **Bitbucket PR defaults** - PR auto-fill behavior from commit/branch data (https://support.atlassian.com/bitbucket-cloud/kb/understanding-the-default-pull-request-title-description-and-merge-commit-message/)

## Metadata

**Confidence breakdown:**
- Merge dialog UX: HIGH - Well-established pattern across GitHub.com, Desktop, GitKraken, Tower; existing `Dialog`/`MergeDialog` patterns in codebase
- Create PR form UX: HIGH - Clear precedent in `ConventionalCommitBlade` form pattern; auto-fill behavior documented by GitHub, Bitbucket, GitKraken
- Extension manager UX: HIGH - VS Code, JetBrains, Obsidian all converge on the same list+actions pattern; `useExtensionHost` store already has all data
- Extension install flow: MEDIUM - URL-based install is less common than marketplace-based; the multi-step dialog pattern is sound but needs validation
- Extensibility visual identity: HIGH - Strong consensus that extension UI should be indistinguishable from core UI
- Accessibility patterns: HIGH - Based on ARIA APG, existing codebase patterns, and W3C dialog role guidelines
- Toggle component: HIGH - Standard ARIA switch role pattern, well-documented

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days - UX patterns are stable)
