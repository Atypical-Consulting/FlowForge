# FlowForge UX/UI Improvement Roadmap

A comprehensive guide to enhancing the user experience and interface design of FlowForge, our Tauri-based Git GUI application.

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

### 1. Command Palette (⌘K)

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

**Actions to include:**
| Category | Actions |
|----------|---------|
| Git | Commit, Push, Pull, Fetch, Stash, Pop Stash |
| Branches | Switch Branch, Create Branch, Delete Branch, Merge |
| Navigation | Go to Changes, Go to History, Go to Topology |
| Repository | Open Repository, Close Repository, Refresh |
| View | Toggle Theme, Toggle Panel, Focus Mode |

---

### 2. Contextual Empty States

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

**Design principles:**
- Use Catppuccin `subtext0` for secondary text
- Include relevant Lucide icon or custom illustration
- Always provide a clear next action
- Keep copy concise and friendly

---

### 3. Progressive Disclosure in Commit Form

**Priority:** High  
**Effort:** Medium  
**Impact:** High

Streamline the commit workflow while maintaining conventional commit support.

**Current issues:**
- Breaking changes section always visible (rarely used)
- Type selector requires dropdown interaction
- Scope field lacks smart suggestions

**Proposed changes:**

#### 3.1 Inline Type Selector
Replace dropdown with horizontal pill/chip selector:
```
[ feat ] [ fix ] [ docs ] [ style ] [ refactor ] [ test ] [ chore ]
```
- Single click to select
- Visual distinction for selected type
- Color coding per type (feat=green, fix=red, docs=blue, etc.)

#### 3.2 Smart Scope Suggestions
- Extract scopes from recent commits
- Show as autocomplete dropdown
- Learn from repository patterns

#### 3.3 Collapsible Advanced Options
- Hide "Breaking Changes" by default
- Expand when user types `!` after type or clicks "Advanced"
- Include co-authors field in collapsed section

#### 3.4 AI-Assisted Messages (Future)
- Analyze staged diff
- Suggest commit message based on changes
- "Generate message" button with loading state

---

### 4. Enhanced Diff Viewer

**Priority:** High  
**Effort:** High  
**Impact:** Very High

Monaco Editor is powerful but needs Git-specific enhancements.

**Improvements:**

#### 4.1 Collapsible Unchanged Regions
- Collapse blocks of unchanged code (like GitHub)
- Show "Show 23 unchanged lines" expander
- Preserve context lines at boundaries

#### 4.2 Line-Level Staging
- Gutter controls for staging individual lines/hunks
- Checkbox or +/- buttons per line
- Visual indication of staged vs unstaged lines

#### 4.3 View Mode Toggle
- Split view (side-by-side)
- Unified view (inline)
- Persist preference per user

#### 4.4 Syntax-Aware Highlighting
- Highlight semantic changes (function renamed, variable changed)
- Dim unchanged syntax (brackets, keywords)
- Word-level diff highlighting within lines

---

### 5. Micro-Feedback & Notifications

**Priority:** High  
**Effort:** Low  
**Impact:** High

Provide immediate feedback for all user actions.

#### 5.1 Toast Notification System
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

#### 5.2 Optimistic UI Updates
- Update UI immediately on user action
- Show subtle loading indicator
- Rollback with error toast if operation fails

#### 5.3 Enhanced Loading States
- Button spinner matching Catppuccin theme
- Skeleton loaders for async content
- Progress indicators for long operations (clone, large push)

#### 5.4 Dirty State Enhancement
Current: Yellow dot  
Proposed: Subtle pulse animation + tooltip showing change count

---

## Design Refinements

### 6. Enhanced Spatial Design

**Priority:** Medium  
**Effort:** Low-Medium  
**Impact:** High (Visual Polish)

Elevate the visual hierarchy and create depth.

#### 6.1 Panel Headers
```css
/* Frosted glass effect */
.panel-header {
  background: rgba(var(--ctp-mantle-rgb), 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(var(--ctp-surface0-rgb), 0.5);
}
```

#### 6.2 Depth & Shadows
- Add subtle shadows using `ctp-crust` with low opacity
- Layer panels with z-index for visual hierarchy
- Hover states that lift elements slightly

#### 6.3 Divider Refinement
- Replace solid borders with gradient fades
- Or remove dividers entirely, relying on spacing
- Subtle separator dots for horizontal lists

#### 6.4 Floating Action Buttons
- Primary actions float above content
- "Stage All" and "Commit" as prominent FABs
- Keyboard shortcut badges on hover

---

### 7. Branch & Commit Visualization

**Priority:** Medium  
**Effort:** Medium  
**Impact:** Medium-High

Enhance the topology view for better Git understanding.

#### 7.1 Author Avatars
- Fetch from Gravatar or GitHub API
- Fallback to initials with generated colors
- Show on commit nodes and in history list

#### 7.2 Branch Color Coding
- Assign consistent colors per branch name
- Hash branch name to Catppuccin accent color
- Persist across sessions

#### 7.3 Node Differentiation
| Commit Type | Node Shape | Color |
|-------------|------------|-------|
| Regular | Circle | `ctp-blue` |
| Merge | Diamond | `ctp-mauve` |
| Initial | Circle with dot | `ctp-green` |
| HEAD | Circle with ring | `ctp-yellow` |
| Tag | Hexagon | `ctp-peach` |

#### 7.4 Commit Heat Map
- Color intensity based on recency
- Fade older commits
- Highlight recent activity

---

### 8. Welcome Screen Enhancement

**Priority:** Medium  
**Effort:** Low  
**Impact:** Medium

Polish the first impression and improve recent repos UX.

#### 8.1 Recent Repository Cards
Replace list with rich cards showing:
- Repository name and path
- Current branch
- Last commit message and date
- Change indicator (uncommitted changes)
- Quick actions on hover (Open, Terminal, Remove, Pin)

#### 8.2 Pinned Repositories
- Star/pin favorite repos
- Pinned repos appear first
- Persist across sessions

#### 8.3 Repository Health Indicators
| Indicator | Icon | Meaning |
|-----------|------|---------|
| Green dot | Clean, up to date |
| Yellow dot | Uncommitted changes |
| Red dot | Behind remote |
| Blue arrow | Ahead of remote |

#### 8.4 Drag & Drop Enhancement
- Larger drop zone with dashed border
- Animated border on drag hover
- Support dropping `.git` folders

---

## Advanced UX Features

### 9. Inline Conflict Resolution

**Priority:** Medium  
**Effort:** High  
**Impact:** Very High

Git conflicts are painful—make them manageable.

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

### 10. Git Insights Dashboard

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

### 11. Customizable Workspace Layouts

**Priority:** Low  
**Effort:** Medium  
**Impact:** Medium

Let users optimize their workflow.

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

### Quick Wins (Low Effort, High Impact)

| Improvement | Effort | Impact | Suggested Sprint |
|-------------|--------|--------|------------------|
| Toast notification system | 2-3 days | High | Sprint 1 |
| Empty state illustrations | 1-2 days | Medium | Sprint 1 |
| Keyboard shortcut tooltips | 1 day | Medium | Sprint 1 |
| Button loading spinners | 1 day | Medium | Sprint 1 |
| Panel header frosted glass | 1 day | High (visual) | Sprint 1 |
| Dirty state pulse animation | 0.5 day | Low | Sprint 1 |

### Medium Term

| Improvement | Effort | Impact | Suggested Sprint |
|-------------|--------|--------|------------------|
| Command palette (⌘K) | 1 week | Very High | Sprint 2 |
| Commit type inline pills | 2-3 days | Medium | Sprint 2 |
| Recent repos as cards | 2-3 days | Medium | Sprint 2 |
| Branch color coding | 2 days | Medium | Sprint 2 |
| Collapsible diff regions | 3-4 days | High | Sprint 3 |

### Long Term

| Improvement | Effort | Impact | Suggested Sprint |
|-------------|--------|--------|------------------|
| Line-level staging | 2 weeks | Very High | Sprint 4 |
| Three-way merge view | 2 weeks | Very High | Sprint 5 |
| Git insights dashboard | 2 weeks | Medium | Sprint 6 |
| Workspace layouts | 1 week | Medium | Sprint 6 |

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

1. **Review and prioritize** this document with the team
2. **Create issues** in the project tracker for approved items
3. **Design mockups** for complex features (command palette, merge view)
4. **Implement Sprint 1** quick wins for immediate impact
5. **User testing** after each sprint to validate improvements

---

*Document created: February 2026*  
*Last updated: February 2026*  
*Version: 1.0*
