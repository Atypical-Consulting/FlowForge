# FlowForge UX Design Principles Audit

Findings from the [7 Fundamental UX Design Principles (2026)](https://www.uxdesigninstitute.com/blog/ux-design-principles-2026/), mapped to FlowForge's current implementation and remaining roadmap.

---

## Principle-by-Principle Analysis

### 1. User-Centricity

> Design decisions guided by actual user behavior, not assumptions.

**FlowForge current state:** Strong. The command palette, conventional commit form, and progressive disclosure were all designed around observed Git workflow patterns. Empty states guide users toward next actions.

**Gaps identified:**

| Gap | Impact | Relates to |
|-----|--------|------------|
| No user analytics or telemetry to validate which features are actually used | Medium | — |
| No onboarding flow for first-time users (welcome screen jumps straight to repo selection) | Medium | E3 |
| AI-assisted commit messages assume a conventional-commit workflow without confirming user preference | Low | Feature 3 |

**Recommendations:**
- Add an optional first-run walkthrough highlighting key shortcuts (Cmd+K, staging workflow, theme toggle)
- Consider a "What's your Git workflow?" onboarding step that configures sensible defaults (e.g., conventional commits on/off, preferred merge strategy)
- Track which command palette actions are most/least used to prioritize future work

---

### 2. Consistency

> Interfaces behave uniformly across screens and touchpoints.

**FlowForge current state:** Good. Catppuccin tokens, Geist/JetBrains Mono typography, and Lucide icons create a coherent visual language. Zustand + TanStack Query provide consistent data patterns.

**Gaps identified:**

| Gap | Impact | Relates to |
|-----|--------|------------|
| Loading states vary: some panels use Skeleton, others use Loader2 spinner, some show nothing | Medium | Feature 5 |
| Empty states exist for some panels but not all (e.g., stash list, tags list missing in UX doc) | Low | Feature 2 |
| Panel header patterns differ between gitflow, worktree, stash, and tags components | Low | Feature 6 |
| Toast actions sometimes use "Retry", sometimes "Try again" — inconsistent copy | Low | Feature 5 |

**Recommendations:**
- Audit all loading states and standardize on a single pattern per context: Skeleton for initial loads, inline Loader2 for actions, overlay for blocking operations
- Create a shared `PanelHeader` component enforcing consistent layout (title, badge count, action buttons, frosted glass)
- Establish a microcopy style guide for toast messages and action buttons (verb tense, capitalization, button labels)

---

### 3. Hierarchy

> Organize information so users understand importance and navigate intuitively.

**FlowForge current state:** Strong spatial hierarchy through the three-panel layout and resizable panels. Command palette categories establish action hierarchy. Commit form progressive disclosure handles information density well.

**Gaps identified:**

| Gap | Impact | Relates to |
|-----|--------|------------|
| Diff viewer shows all changes with equal visual weight — no way to identify "important" changes | High | E1-US03, E1-US04 |
| Topology view treats all commits equally — no visual hierarchy for merge vs. regular vs. tagged | Medium | E2-US02 (heat map) |
| Welcome screen doesn't distinguish "needs attention" repos from clean ones | Medium | E3-US02 (health indicators) |
| No progressive disclosure for Git operations that have advanced options (push --force, rebase --onto) | Medium | — |

**Recommendations:**
- **Word-level diff highlighting** (E1-US03) directly addresses the article's advice: "Emphasize most important information first using visual prominence"
- **Commit heat map** (E2-US02) creates temporal hierarchy — recent = prominent, old = faded
- **Repo health indicators** (E3-US02) add urgency hierarchy to the welcome screen
- Consider a "Smart Diff Summary" that shows a one-line description of what changed above the full diff (e.g., "Renamed `getUserName` to `fetchUserProfile` and added error handling") — applies the article's guidance on showing summaries before details, especially relevant for AI-generated content

---

### 4. Context

> Understand where and how users interact with products under specific conditions.

**FlowForge current state:** Desktop-only (Tauri) removes multi-device concerns, but within the desktop context there are still situational differences — quick commit vs. deep review vs. merge resolution.

**Gaps identified:**

| Gap | Impact | Relates to |
|-----|--------|------------|
| No adaptive layouts for different tasks (review vs. commit vs. resolve) | High | E6-US01 (layout presets) |
| Keyboard shortcuts don't adapt to context (same shortcuts in staging vs. diff vs. topology) | Medium | — |
| No reduced-complexity mode for quick commits (full UI shown even for `git add . && git commit`) | Medium | — |

**Recommendations:**
- **Layout presets** (E6-US01) are the primary answer here — "Review Mode", "Commit Mode", "Explore Mode" map directly to the article's principle: "Adapt interface complexity based on situation"
- Consider context-aware keyboard shortcuts: in staging panel, `s` stages the selected file; in diff view, `s` stages the current hunk — same key, different context
- A "Quick Commit" flow (Cmd+Enter from anywhere) that shows only the commit form + staged files, no diff panel, for rapid fire commits

---

### 5. User Control

> Grant users appropriate freedom and provide clear recovery mechanisms.

**FlowForge current state:** Mixed. Toast system supports "Undo" and "Retry" actions, which is excellent. Optimistic UI with rollback respects user expectations. However, destructive Git operations lack guardrails.

**Gaps identified:**

| Gap | Impact | Relates to |
|-----|--------|------------|
| No undo for destructive Git operations (force push, branch delete, hard reset) | Critical | — |
| Conflict resolution (planned) needs strong undo per the article: "brief grace periods for irreversible actions" | High | E4-US03 |
| No confirmation dialog for operations that could lose work (checkout with uncommitted changes, stash drop) | High | — |
| AI-generated commit messages auto-fill the form — should present as suggestions per the article's Google Docs example | Medium | Feature 3 |

**Recommendations:**
- **Undo buffer for Git operations**: After a branch delete, show a toast with "Undo" that recreates the branch at the same commit. After a stash drop, offer to re-stash. Use Git's reflog as the underlying recovery mechanism.
- **Confirmation dialogs for destructive operations**: "This will discard N uncommitted changes. Continue?" with a clear description of what will be lost
- **AI commit messages as suggestions**: Show the generated message in a distinct "suggestion" style (like Google Docs) rather than replacing the input field. User clicks "Apply" to accept, preserving the article's user control principle
- **Operation preview**: Before push/pull/merge, show a dry-run summary of what will happen ("Push 3 commits to origin/main", "Merge feature/x into main — 12 files changed, 2 conflicts expected")

---

### 6. Accessibility

> Ensure products remain usable by diverse populations.

**FlowForge current state:** Good foundation — WCAG 2.1 AA compliance target, `prefers-reduced-motion` support via `motion-safe:` prefixes, focus-visible ring styles, Catppuccin offers both dark (Mocha) and light (Latte) themes.

**Gaps identified:**

| Gap | Impact | Relates to |
|-----|--------|------------|
| Color-only indicators in topology (branch colors) may be indistinguishable for colorblind users | High | E2 |
| No high-contrast mode beyond Mocha/Latte | Medium | — |
| Screen reader support for topology SVG view is likely poor (SVGs need explicit ARIA) | High | E2 |
| Keyboard navigation in the topology graph is not documented or tested | Medium | E2 |
| Touch targets in dense panels (staging file list) may be below 44px | Low | — |
| Diff viewer relies heavily on red/green color coding — classic colorblind accessibility issue | High | E1 |

**Recommendations:**
- **Branch shape indicators**: Supplement color with patterns or icons so branch types are distinguishable without color (dotted lines for feature branches, solid for main, dashed for hotfix)
- **Diff color alternatives**: Offer a colorblind-safe diff palette using blue/orange instead of red/green, or add +/- gutter markers alongside color
- **Topology ARIA**: Add `role="img"` with `aria-label` describing the graph structure, or provide an accessible text alternative ("Branch main: 5 commits. Branch feature/auth: 3 commits, branched from main at commit abc123")
- **EU Accessibility Act compliance**: The article notes this is now legally mandated — audit against WCAG 2.1 AA systematically, especially for the diff viewer and topology graph which are the most visually complex components

---

### 7. Usability

> How easily users complete tasks — learnability, efficiency, memorability, error recovery, satisfaction.

**FlowForge current state:** Strong on efficiency (command palette, keyboard shortcuts) and satisfaction (animations, visual polish). Learnability is moderate — conventional commit form is self-documenting, but the three-panel layout has no guided introduction.

**Gaps identified:**

| Gap | Impact | Relates to |
|-----|--------|------------|
| No visible path from "merge conflict detected" to "conflict resolved" — the article's "minimize steps between intent and completion" | Critical | E4 |
| No progress indicator for multi-step operations (clone, large push, rebase) | High | Feature 5 |
| No clear feedback when a fetch finds nothing new ("Fetched: up to date" vs. silence) | Medium | Feature 5 |
| No memorability aids — no way to see "what did I do last time in this repo?" | Medium | E5-US01 |
| Error messages from Git are shown raw, not translated to user-friendly language | Medium | — |

**Recommendations:**
- **Conflict resolution workflow** (E4) is the single highest-impact usability improvement — the article specifically states "Minimize steps between intent and task completion"
- **Git error translator**: Map common Git errors to human-readable messages with suggested actions ("Your branch has diverged from origin/main. Would you like to merge or rebase?")
- **Operation progress**: Show a progress bar in the toolbar for long-running operations (clone: "Receiving objects: 45%", push: "Uploading 2/3 commits")
- **Activity feed**: A minimal "Recent activity" section showing the last 5 operations performed in the current session, providing memorability and undo access

---

## Cross-Reference: Principles to Remaining User Stories

This matrix shows which UX principles each remaining user story addresses. Stories that hit 3+ principles should be prioritized as they deliver compounding UX value.

| User Story | User-Centric | Consistency | Hierarchy | Context | User Control | Accessibility | Usability | Score |
|------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **E1-US01** Collapsible regions | | | X | | | | X | 2 |
| **E1-US02** Line-level staging | X | | | | X | | X | 3 |
| **E1-US03** Word-level diff | | | X | | | X | X | 3 |
| **E1-US04** Semantic highlighting | | | X | | | | X | 2 |
| **E1-US05** Diff preference persist | X | X | | X | X | | | 4 |
| **E2-US01** Author avatars | | X | X | | | | X | 3 |
| **E2-US02** Commit heat map | | | X | | | | X | 2 |
| **E3-US01** Pinned repos | X | | | X | X | | X | 4 |
| **E3-US02** Health indicators | | | X | | | X | X | 3 |
| **E4-US01** Conflict detection | | X | X | | | | X | 3 |
| **E4-US02** Three-way merge | | | X | | X | | X | 3 |
| **E4-US03** One-click resolve | X | | | | X | | X | 3 |
| **E6-US01** Layout presets | X | | | X | X | | X | 4 |
| **E6-US02** Focus mode | | | | X | X | | X | 3 |

**Highest-scoring stories (4):** E1-US05, E3-US01, E6-US01 — all quick-to-moderate effort, high principle coverage.

---

## New Feature Ideas Inspired by the Article

These are net-new ideas not currently in the roadmap, derived from applying the 7 principles:

### N1. Git Error Translator (User Control + Usability)

Map raw Git errors to human-readable messages with actionable suggestions.

```
Raw:    "error: failed to push some refs to 'origin/main'"
Human:  "Push failed: remote has new commits you don't have yet."
Action: [Pull & Retry] [Force Push (caution)] [Cancel]
```

**Effort:** 2-3 days | **Impact:** High

---

### N2. Operation Preview / Dry Run (User Control + Hierarchy)

Before executing push, pull, merge, or rebase, show a preview of what will happen.

```
Push to origin/main:
  3 commits (abc123..def456)
  +142 / -37 lines across 8 files
  [Push] [Cancel]
```

**Effort:** 3-4 days | **Impact:** High

---

### N3. Quick Commit Mode (Context + Usability)

A minimal overlay triggered by `Cmd+Shift+C` for rapid commits without the full three-panel UI.

Shows only: staged files list + commit message input + Commit button.

**Effort:** 2-3 days | **Impact:** Medium

---

### N4. First-Run Walkthrough (User-Centricity + Usability)

A brief 4-step onboarding tour highlighting:
1. Three-panel layout and how to resize
2. Command palette (Cmd+K)
3. Theme toggle (Mocha/Latte)
4. Keyboard shortcuts overview

Skippable, never shown again after dismissal.

**Effort:** 2-3 days | **Impact:** Medium

---

### N5. Activity Feed / Session History (Usability — Memorability)

A collapsible sidebar or panel showing recent operations in the current session:

```
12:34  Committed: feat(ui): add toast system
12:32  Staged 3 files
12:30  Switched to branch feature/toasts
12:28  Fetched: 2 new commits on origin/main
```

Each entry has an undo action where applicable.

**Effort:** 3-4 days | **Impact:** Medium

---

### N6. Colorblind-Safe Diff Mode (Accessibility)

Alternative diff color palette using blue/orange instead of red/green, togglable in settings.

Additionally, add +/- gutter markers that work independently of color.

**Effort:** 1-2 days | **Impact:** High (for affected users)

---

## Updated Priority Recommendations

Incorporating the principle-based scoring with the original roadmap priorities:

### Tier 1 — High Principle Score + High Impact

1. **E6-US01** Layout presets (score 4, enables context-adaptive UI)
2. **E1-US02** Line-level staging (score 3, very high user impact)
3. **E4-US01** Conflict detection UI (score 3, unlocks the full conflict resolution epic)
4. **N1** Git error translator (new, high usability impact, low effort)
5. **E1-US03** Word-level diff highlighting (score 3, improves hierarchy + accessibility)

### Tier 2 — Quick Wins with Good Coverage

6. **E1-US05** Diff preference persistence (score 4, minimal effort)
7. **E3-US01** Pinned repositories (score 4, quality of life)
8. **N6** Colorblind-safe diff mode (new, high accessibility impact, very low effort)
9. **N2** Operation preview (new, high user control impact)

### Tier 3 — Polish and Advanced

10. **E3-US02** Repository health indicators (score 3)
11. **E2-US01** Author avatars (score 3)
12. **N3** Quick commit mode (new, context optimization)
13. **N4** First-run walkthrough (new, learnability)
14. **E4-US02 through E4-US05** Full conflict resolution
15. **N5** Activity feed (new, memorability)

---

## Key Takeaways

1. **User Control is the biggest gap.** FlowForge handles the "happy path" well but lacks guardrails and undo for destructive Git operations. The article's emphasis on "clearly marked emergency exits" highlights this as critical.

2. **Accessibility needs focused attention in visual components.** The topology graph and diff viewer are the most at-risk components for colorblind users and screen reader users.

3. **Context-adaptive UI is a differentiator.** Layout presets (E6-US01) score highest across principles and would make FlowForge feel responsive to the user's current task — a standout feature among Git GUIs.

4. **Small usability wins compound.** Error translation, operation previews, and diff preference persistence are all low-effort improvements that address multiple principles simultaneously.

5. **The conflict resolution epic (E4) is validated.** The article's usability principle ("minimize steps between intent and completion") directly supports making E4 a top priority once the diff viewer improvements are complete.

---

*Source: [7 Fundamental UX Design Principles (2026)](https://www.uxdesigninstitute.com/blog/ux-design-principles-2026/) — UX Design Institute*
*Created: February 2026*
*Cross-references: [UX-UI-IMPROVEMENTS.md](./UX-UI-IMPROVEMENTS.md), [UX-UI-USER-STORIES.md](./UX-UI-USER-STORIES.md)*
