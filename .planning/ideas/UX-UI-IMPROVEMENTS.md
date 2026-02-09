# FlowForge UX/UI Improvement Roadmap

A comprehensive guide to enhancing the user experience and interface design of FlowForge, our Tauri-based Git GUI application.

---

## Progress Overview

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Command Palette (⌘K) | Done | Custom fuzzy search, categories, keyboard nav |
| 2 | Contextual Empty States | Done | Staging, topology, history, commit panels |
| 3 | Progressive Disclosure (Commit) | Done | Inline pills, smart scope, collapsible breaking changes, AI inference |
| 4 | Enhanced Diff Viewer | Partial | Split/unified toggle done; line-level staging, collapsible regions, word-level diff remaining |
| 5 | Micro-Feedback & Notifications | Done | Custom toast system, skeleton loaders, button spinners, pulse animations |
| 6 | Enhanced Spatial Design | Done | Frosted glass, backdrop-blur, panel headers |
| 7 | Branch & Commit Visualization | Partial | Branch colors and node shapes done; author avatars and heat map remaining |
| 8 | Welcome Screen Enhancement | Partial | Repo cards and drag-drop done; pinned repos and health indicators remaining |
| 9 | Inline Conflict Resolution | Not started | MergeDialog lists conflicts but no resolution UI |
| 10 | Git Insights Dashboard | Not started | — |
| 11 | Customizable Workspace Layouts | Not started | Resizable panels exist but no presets/focus mode |

---

## Current State Summary

FlowForge is built on a solid foundation:
- **React 19** with TypeScript 5.9
- **Tailwind CSS v4** with **Catppuccin** color system (Mocha/Latte themes)
- **Framer Motion** for animations
- **Zustand** + **TanStack Query** for state management
- Three-panel resizable layout with Monaco-based diff viewer
- WCAG 2.1 AA accessibility compliance

---

## High-Impact UX Improvements

### 1. Command Palette (⌘K) — Done

**Priority:** Critical
**Effort:** Medium
**Impact:** Very High

The #1 power-user feature for desktop applications. A unified command palette provides instant access to any action without the mouse.

**Why it matters:**
- Reduces cognitive load (no need to remember individual shortcuts)
- Modern expectation (VS Code, Linear, Notion, Raycast, Arc)
- Accelerates expert users while remaining discoverable for beginners

**Implementation details:**
- Fuzzy search with scoring algorithm (fzf-style)
- Action categories: Navigation, Git Operations, View, Settings
- Recent actions history
- Keyboard-first navigation (↑↓ to select, Enter to execute, Esc to close)

**What was built:**
- `src/components/command-palette/CommandPalette.tsx` — full palette UI
- `src/lib/fuzzySearch.ts` — custom fuzzy search with match highlighting
- Triggers: `Cmd/Ctrl+K` and `Cmd/Ctrl+Shift+P`
- Category-based grouping, backdrop blur, smooth animations

**Actions to include:**
| Category | Actions |
|----------|---------|
| Git | Commit, Push, Pull, Fetch, Stash, Pop Stash |
| Branches | Switch Branch, Create Branch, Delete Branch, Merge |
| Navigation | Go to Changes, Go to History, Go to Topology |
| Repository | Open Repository, Close Repository, Refresh |
| View | Toggle Theme, Toggle Panel, Focus Mode |

---

### 2. Contextual Empty States — Done

**Priority:** High
**Effort:** Low
**Impact:** Medium-High

Transform blank panels into helpful, actionable guidance.

| Panel | Current State | Proposed Empty State |
|-------|---------------|----------------------|
| Staging (no changes) | Empty list | Illustration + "All clean! No changes to stage" + hint about making edits |
| Staging (all staged) | Empty unstaged | "All changes staged" + Commit CTA button |
| Stash | Empty list | "Stash your work for later" + explanation + `⌘⇧S` shortcut hint |
| History (new repo) | Empty | "Make your first commit" + arrow pointing to commit form |
| Branches | Only main | "Create a feature branch" + branching strategy hint |
| Tags | No tags | "Tag a release" + semantic versioning hint |

**What was built:**
- `src/components/ui/EmptyState.tsx` — reusable empty state component
- Staging: "All clear! No changes to commit"
- Topology: "No commits yet" with custom SVG illustration
- Commit history: "Fresh start!" / "No matching commits"
- All include icons, descriptions, and optional action buttons

**Design principles:**
- Use Catppuccin `subtext0` for secondary text
- Include relevant Lucide icon or custom illustration
- Always provide a clear next action
- Keep copy concise and friendly

---

### 3. Progressive Disclosure in Commit Form — Done

**Priority:** High
**Effort:** Medium
**Impact:** High

Streamline the commit workflow while maintaining conventional commit support.

**What was built:**
- `src/components/commit/ConventionalCommitForm.tsx`
- Inline type pills with grid layout and color coding
- Smart scope autocomplete from recent commit history
- Collapsible breaking change section (checkbox reveals textarea)
- AI-powered type and scope inference with "Apply" buttons
- Scope frequency chart with collapsible history

#### 3.1 Inline Type Selector — Done
Replace dropdown with horizontal pill/chip selector:
```
[ feat ] [ fix ] [ docs ] [ style ] [ refactor ] [ test ] [ chore ]
```
- Single click to select
- Visual distinction for selected type
- Color coding per type (feat=green, fix=red, docs=blue, etc.)

#### 3.2 Smart Scope Suggestions — Done
- Extract scopes from recent commits
- Show as autocomplete dropdown
- Learn from repository patterns

#### 3.3 Collapsible Advanced Options — Done
- Hide "Breaking Changes" by default
- Expand when user types `!` after type or clicks "Advanced"
- Include co-authors field in collapsed section

#### 3.4 AI-Assisted Messages — Done
- Analyze staged diff
- Suggest commit message based on changes
- "Generate message" button with loading state

---

### 4. Enhanced Diff Viewer — Partial

**Priority:** High
**Effort:** High
**Impact:** Very High

Monaco Editor is powerful but needs Git-specific enhancements.

**What was built:**
- `src/blades/diff/DiffBlade.tsx`
- Split/unified view toggle ("Side-by-side" vs "Inline")
- Monaco Editor integration with custom Catppuccin theme
- File navigation (prev/next) in staging mode
- Markdown preview mode for `.md`/`.mdx` files

**Improvements:**

#### 4.1 Collapsible Unchanged Regions — Not started
- Collapse blocks of unchanged code (like GitHub)
- Show "Show 23 unchanged lines" expander
- Preserve context lines at boundaries

#### 4.2 Line-Level Staging — Not started
- Gutter controls for staging individual lines/hunks
- Checkbox or +/- buttons per line
- Visual indication of staged vs unstaged lines

#### 4.3 View Mode Toggle — Done
- Split view (side-by-side)
- Unified view (inline)
- Persist preference per user

#### 4.4 Syntax-Aware Highlighting — Not started
- Highlight semantic changes (function renamed, variable changed)
- Dim unchanged syntax (brackets, keywords)
- Word-level diff highlighting within lines

---

### 5. Micro-Feedback & Notifications — Done

**Priority:** High
**Effort:** Low
**Impact:** High

Provide immediate feedback for all user actions.

#### 5.1 Toast Notification System — Done

**What was built:**
- `src/components/ui/Toast.tsx` and `src/components/ui/ToastContainer.tsx`
- `src/stores/toast.ts` — Zustand store
- 4 types: success, error, info, warning
- Auto-dismiss with progress bar animation
- Action buttons support
- AnimatePresence with spring animations
- Backdrop blur and shadow effects
- Max 3 visible toasts

Position: Bottom-right corner
Types: Success, Error, Warning, Info
Features:
- Auto-dismiss with progress indicator
- Action buttons (Undo, View, Retry)
- Stack multiple notifications
- Framer Motion enter/exit animations

**Notification triggers:**
| Action | Notification |
|--------|--------------|
| Push success | "Pushed 3 commits to origin/main" |
| Push failed | "Push failed: remote rejected" + Retry button |
| Fetch complete | "Fetched 5 new commits" |
| Stash created | "Changes stashed" + Pop button |
| Branch switched | "Switched to feature/xyz" |
| Commit created | "Committed: feat(ui): add button" |

#### 5.2 Optimistic UI Updates — Done
- Update UI immediately on user action
- Show subtle loading indicator
- Rollback with error toast if operation fails

#### 5.3 Enhanced Loading States — Done

**What was built:**
- `src/components/ui/Skeleton.tsx` — uses `motion-safe:animate-pulse`
- `src/components/ui/button.tsx` — `loading` prop with Loader2 spinner + optional `loadingText`
- Skeleton loaders in: StagingPanel, CommitHistory, ScopeFrequencyChart
- 28+ files use `isLoading` or `isPending` states

#### 5.4 Dirty State Enhancement — Done

**What was built:**
- Custom keyframes in `src/index.css`: `--animate-dirty-pulse` and `--animate-gentle-pulse`
- GitflowDiagram "YOU ARE HERE" indicator uses `motion-safe:animate-gentle-pulse`
- Skeleton component uses `motion-safe:animate-pulse`

---

## Design Refinements

### 6. Enhanced Spatial Design — Done

**Priority:** Medium
**Effort:** Low-Medium
**Impact:** High (Visual Polish)

Elevate the visual hierarchy and create depth.

**What was built:**
- Frosted glass with `backdrop-blur` across 12+ files (command palette, toasts, headers, dialogs, ShortcutTooltip)
- Panel headers in gitflow, worktree, stash, tags components
- `src/components/layout/ResizablePanelLayout.tsx` — resizable panel system

#### 6.1 Panel Headers — Done
```css
/* Frosted glass effect */
.panel-header {
  background: rgba(var(--ctp-mantle-rgb), 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(var(--ctp-surface0-rgb), 0.5);
}
```

#### 6.2 Depth & Shadows — Done
- Add subtle shadows using `ctp-crust` with low opacity
- Layer panels with z-index for visual hierarchy
- Hover states that lift elements slightly

#### 6.3 Divider Refinement — Done
- Replace solid borders with gradient fades
- Or remove dividers entirely, relying on spacing
- Subtle separator dots for horizontal lists

#### 6.4 Floating Action Buttons — Done
- Primary actions float above content
- "Stage All" and "Commit" as prominent FABs
- Keyboard shortcut badges on hover

---

### 7. Branch & Commit Visualization — Partial

**Priority:** Medium
**Effort:** Medium
**Impact:** Medium-High

Enhance the topology view for better Git understanding.

**What was built:**
- `src/components/gitflow/GitflowDiagram.tsx`
- Branch color coding (5 branch types with Catppuccin colors)
- Node differentiation (commit dots, merge connectors, version labels)
- Animated "YOU ARE HERE" indicator with pulse
- Glow filter for highlighted lanes

#### 7.1 Author Avatars — Not started
- Fetch from Gravatar or GitHub API
- Fallback to initials with generated colors
- Show on commit nodes and in history list

#### 7.2 Branch Color Coding — Done
- Assign consistent colors per branch name
- Hash branch name to Catppuccin accent color
- Persist across sessions

#### 7.3 Node Differentiation — Done
| Commit Type | Node Shape | Color |
|-------------|------------|-------|
| Regular | Circle | `ctp-blue` |
| Merge | Diamond | `ctp-mauve` |
| Initial | Circle with dot | `ctp-green` |
| HEAD | Circle with ring | `ctp-yellow` |
| Tag | Hexagon | `ctp-peach` |

#### 7.4 Commit Heat Map — Not started
- Color intensity based on recency
- Fade older commits
- Highlight recent activity

---

### 8. Welcome Screen Enhancement — Partial

**Priority:** Medium
**Effort:** Low
**Impact:** Medium

Polish the first impression and improve recent repos UX.

**What was built:**
- `src/components/WelcomeView.tsx`
- Repository cards in RecentRepos component
- Drag-drop support for folders
- Animated gradient background
- Time-based "last opened" display

#### 8.1 Recent Repository Cards — Done
Replace list with rich cards showing:
- Repository name and path
- Current branch
- Last commit message and date
- Change indicator (uncommitted changes)
- Quick actions on hover (Open, Terminal, Remove, Pin)

#### 8.2 Pinned Repositories — Not started
- Star/pin favorite repos
- Pinned repos appear first
- Persist across sessions

#### 8.3 Repository Health Indicators — Not started
| Indicator | Icon | Meaning |
|-----------|------|---------|
| Green dot | Clean, up to date |
| Yellow dot | Uncommitted changes |
| Red dot | Behind remote |
| Blue arrow | Ahead of remote |

#### 8.4 Drag & Drop Enhancement — Done
- Larger drop zone with dashed border
- Animated border on drag hover
- Support dropping `.git` folders

---

## Advanced UX Features

### 9. Inline Conflict Resolution — Not started

**Priority:** Medium
**Effort:** High
**Impact:** Very High

Git conflicts are painful—make them manageable.

*Note: `MergeDialog` currently lists conflicted files but has no inline resolution UI.*

#### 9.1 Conflict Detection
- Visual conflict markers in file tree (red warning icon)
- Conflict count badge in header
- Dedicated "Conflicts" filter in staging panel

#### 9.2 Three-Way Merge View
```
┌─────────────┬─────────────┬─────────────┐
│    OURS     │    BASE     │   THEIRS    │
│  (current)  │  (common)   │  (incoming) │
└─────────────┴─────────────┴─────────────┘
```

#### 9.3 Resolution Actions
- "Accept Ours" button
- "Accept Theirs" button
- "Accept Both" (concatenate)
- Manual edit with live preview
- Mark as resolved

---

### 10. Git Insights Dashboard — Not started

**Priority:** Low
**Effort:** High
**Impact:** Medium

A new view for repository analytics.

**Visualizations:**
- Commit frequency chart (last 30 days)
- Contributor activity (if multi-author)
- Branch health (stale branches, days since update)
- File change frequency (hot files)
- Lines added/removed over time

**Stats cards:**
- Total commits
- Active branches
- Contributors
- Repository age
- Largest files

---

### 11. Customizable Workspace Layouts — Not started

**Priority:** Low
**Effort:** Medium
**Impact:** Medium

Let users optimize their workflow.

*Note: Resizable panels already exist via `ResizablePanelLayout`, but no presets or focus mode.*

#### 11.1 Layout Presets
| Preset | Configuration |
|--------|---------------|
| Review Mode | Wide diff panel, narrow staging |
| Commit Mode | Wide staging, medium commit form |
| Explore Mode | Wide topology, narrow panels |
| Focus Mode | Single panel, fullscreen |

#### 11.2 Panel Controls
- Toggle individual panels on/off
- Resize with persistence
- Reset to default layout

#### 11.3 Focus Mode
- Double-click panel header to maximize
- `Esc` to exit
- Useful for diff review and topology exploration

---

## Implementation Priority Matrix

### Quick Wins (Sprint 1) — All Done

| Improvement | Effort | Impact | Status |
|-------------|--------|--------|--------|
| Toast notification system | 2-3 days | High | Done |
| Empty state illustrations | 1-2 days | Medium | Done |
| Keyboard shortcut tooltips | 1 day | Medium | Done |
| Button loading spinners | 1 day | Medium | Done |
| Panel header frosted glass | 1 day | High (visual) | Done |
| Dirty state pulse animation | 0.5 day | Low | Done |

### Medium Term (Sprint 2-3) — Mostly Done

| Improvement | Effort | Impact | Status |
|-------------|--------|--------|--------|
| Command palette (⌘K) | 1 week | Very High | Done |
| Commit type inline pills | 2-3 days | Medium | Done |
| Recent repos as cards | 2-3 days | Medium | Done |
| Branch color coding | 2 days | Medium | Done |
| Collapsible diff regions | 3-4 days | High | Not started |

### Long Term (Sprint 4+) — Remaining Work

| Improvement | Effort | Impact | Status |
|-------------|--------|--------|--------|
| Line-level staging | 2 weeks | Very High | Not started |
| Three-way merge view | 2 weeks | Very High | Not started |
| Git insights dashboard | 2 weeks | Medium | Not started |
| Workspace layouts | 1 week | Medium | Not started |
| Author avatars | 3-4 days | Medium | Not started |
| Commit heat map | 2-3 days | Medium | Not started |
| Pinned repositories | 2-3 days | Low | Not started |
| Repo health indicators | 2-3 days | Medium | Not started |

---

## Design Tokens Reference

When implementing these improvements, use the established design system:

### Colors (Catppuccin)
```css
/* Backgrounds */
--ctp-base       /* Main background */
--ctp-mantle     /* Elevated surfaces */
--ctp-crust      /* Deepest background, shadows */
--ctp-surface0/1 /* Interactive surfaces */

/* Text */
--ctp-text       /* Primary text */
--ctp-subtext0/1 /* Secondary text */
--ctp-overlay0   /* Disabled, hints */

/* Accents */
--ctp-blue       /* Primary actions */
--ctp-green      /* Success, additions */
--ctp-red        /* Errors, deletions */
--ctp-yellow     /* Warnings, dirty state */
--ctp-peach      /* Highlights */
--ctp-mauve      /* Special accents */
```

### Typography
```css
font-family: 'Geist Variable', sans-serif;      /* UI text */
font-family: 'JetBrains Mono Variable', mono;   /* Code, paths */
```

### Spacing
Use Tailwind's spacing scale: `1` = 4px, `2` = 8px, `4` = 16px, etc.

### Animation
```typescript
// Framer Motion defaults
const transition = { duration: 0.2, ease: "easeOut" };
const spring = { type: "spring", stiffness: 300, damping: 30 };
```

---

## Accessibility Checklist

For each improvement, ensure:

- [ ] Keyboard navigation works (Tab, Arrow keys, Enter, Escape)
- [ ] Focus states are visible (`focus-visible:ring`)
- [ ] ARIA labels on interactive elements
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Screen reader announces state changes
- [ ] Reduced motion preference respected (`prefers-reduced-motion`)
- [ ] Touch targets are at least 44x44px

---

## Next Steps

1. ~~**Review and prioritize** this document with the team~~ Done
2. ~~**Implement Sprint 1** quick wins for immediate impact~~ Done
3. ~~**Implement Sprint 2** medium-term features~~ Mostly done
4. **Collapsible diff regions** — last remaining Sprint 3 item
5. **Line-level staging** and **three-way merge view** — highest-impact remaining features
6. **Welcome screen polish** — pinned repos, health indicators
7. **Git insights dashboard** and **workspace layouts** — lower priority, future sprints

---

*Document created: February 2026*
*Last updated: February 2026*
*Version: 2.0 — Updated with implementation status*
