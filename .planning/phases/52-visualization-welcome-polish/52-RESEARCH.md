# Phase 52: Visualization & Welcome Polish - Research

**Researched:** 2026-02-14
**Domain:** SVG topology visualization (heat map, tooltips), welcome screen UX (pinning, health indicators, quick actions)
**Confidence:** HIGH

## Summary

Phase 52 adds five features split across two areas: the topology graph extension (commit heat map coloring by recency + hover tooltips) and the welcome screen extension (pinned repos, health indicators, quick actions). All five features build on existing, well-structured code with clear integration points.

The topology graph already renders SVG `<circle>` elements for each `GraphNode` in `TopologyPanel.tsx`, with node color driven by branch type. The heat map (VIZ-02) replaces this color with a recency-based color scale when toggled. The tooltip (VIZ-03) overlays commit metadata on hover for those same circles. Both features are purely frontend -- no new Rust commands are needed since `GraphNode` already provides `timestampMs`, `shortOid`, `author`, and `message`.

The welcome screen features (WELC-01/02/03) build on the existing `RecentRepos` component and `useRecentRepos` hook which uses `@tauri-apps/plugin-store` for persistence. Pin state can be added to the same store. Health indicators require calling the existing `commands.getBranchAheadBehind` and `commands.getRepositoryStatus` Tauri commands for each repo. The "open in terminal" action (WELC-03) requires a new Rust Tauri command because `tauri-plugin-shell` is NOT currently installed; the cleanest approach is a `std::process::Command`-based Tauri command that reads the user's configured terminal from settings.

**Primary recommendation:** Keep all five features frontend-only except WELC-03's "open in terminal" which needs one new Rust command. Use the existing `@tauri-apps/plugin-store` for pin persistence. For the heat map, use a simple linear interpolation between Catppuccin colors (green->yellow->red for recent->old) rather than importing a d3-scale library.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.4 | Component framework | Project standard |
| framer-motion | ^12.34.0 | Tooltip animation, reduced-motion | Already used throughout; has `useReducedMotion` hook |
| lucide-react | ^0.563 | Icons (Pin, Terminal, X, Folder, etc.) | Project icon library |
| Tailwind CSS | ^4 | Styling with `ctp-*` tokens | Project CSS framework |
| @tauri-apps/plugin-store | ^2 | Persistent pin state | Already used for recent repos, settings, theme |
| zustand | ^5 | State management | All stores use this pattern |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | ^0.7.1 | Conditional class composition | Status dot variants |
| @tauri-apps/plugin-opener | ^2.5.3 | `revealItemInDir` for "open" action | Already used in toolbar-actions.ts |
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcuts for pin toggle | If keyboard support needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled color interpolation | d3-scale / d3-interpolate | Adds ~20KB dependency for a single lerp function; not worth it |
| `tauri-plugin-shell` for terminal | Rust `std::process::Command` in Tauri command | Shell plugin requires capability config and adds a dependency; direct Rust command is simpler for this single use case |
| Separate pinned-repos store | Extend `useRecentRepos` hook | Keep pinned state alongside recent repos in same storage key for atomicity |

**Installation:**
```bash
# No new npm packages needed -- all dependencies are already present
```

**Rust side (for WELC-03):**
```bash
# No new crates needed -- std::process::Command is in Rust stdlib
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── extensions/topology/
│   ├── components/
│   │   ├── TopologyPanel.tsx      # MODIFY: add heat map toggle + tooltip state
│   │   ├── CommitBadge.tsx        # KEEP: unchanged (badges already show metadata)
│   │   ├── HeatMapLegend.tsx      # NEW: color scale legend component
│   │   └── CommitTooltip.tsx      # NEW: hover tooltip overlay
│   └── lib/
│       ├── layoutUtils.ts         # KEEP: unchanged
│       └── heatMapUtils.ts        # NEW: recency color calculation
├── extensions/welcome-screen/
│   ├── components/
│   │   ├── RecentRepos.tsx        # MODIFY: add pin/health/quick-action support
│   │   ├── RepoCard.tsx           # NEW: extracted repo card with health + actions
│   │   ├── HealthDot.tsx          # NEW: colored status dot with tooltip
│   │   └── WelcomeContent.tsx     # MINOR: sorting (pinned first)
│   └── hooks/
│       └── useRepoHealth.ts       # NEW: async health check per repo
├── core/
│   ├── hooks/
│   │   └── useRecentRepos.ts      # MODIFY: add pin/unpin methods + pinned field
│   └── lib/
│       └── store.ts               # KEEP: unchanged (already provides persistence)
└── src-tauri/src/git/
    └── commands.rs                # MODIFY: add open_in_terminal command
```

### Pattern 1: Heat Map Color Interpolation (VIZ-02)
**What:** Map each commit's `timestampMs` to a color on a gradient (recent = green, old = red) using simple linear interpolation between Catppuccin hex colors.
**When to use:** When the heat map toggle is enabled in the topology graph toolbar.
**Example:**
```typescript
// Source: project patterns (branchClassifier.ts hex color approach)
const HEAT_COLORS = {
  recent: "#a6e3a1",  // ctp-green
  mid:    "#f9e2af",  // ctp-yellow
  old:    "#f38ba8",  // ctp-red
};

function interpolateColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function getHeatColor(timestampMs: number, minTs: number, maxTs: number): string {
  if (maxTs === minTs) return HEAT_COLORS.recent;
  const t = (maxTs - timestampMs) / (maxTs - minTs); // 0 = recent, 1 = old
  if (t < 0.5) return interpolateColor(HEAT_COLORS.recent, HEAT_COLORS.mid, t * 2);
  return interpolateColor(HEAT_COLORS.mid, HEAT_COLORS.old, (t - 0.5) * 2);
}
```

### Pattern 2: SVG Tooltip on Hover (VIZ-03)
**What:** Track hovered node in state; render a positioned `<div>` tooltip near the SVG circle.
**When to use:** Whenever the user hovers over a commit node circle in the topology SVG.
**Example:**
```typescript
// Source: ShortcutTooltip.tsx pattern (framer-motion + useReducedMotion)
// The topology SVG circles already have pointer-events-auto and onClick.
// Add onMouseEnter/onMouseLeave to track hovered node:
<circle
  onMouseEnter={() => setHoveredNode(pn)}
  onMouseLeave={() => setHoveredNode(null)}
  // ... existing props
/>

// Tooltip positioned absolutely relative to SVG container:
{hoveredNode && (
  <div
    className="absolute z-50 pointer-events-none"
    style={{ left: hoveredNode.cx + 16, top: hoveredNode.cy - 40 }}
  >
    <CommitTooltip node={hoveredNode.node} />
  </div>
)}
```

### Pattern 3: Persistent Pin State (WELC-01)
**What:** Extend `RecentRepo` type with `isPinned` boolean; persist via `@tauri-apps/plugin-store` alongside recent repos.
**When to use:** When user clicks pin icon on a repo card.
**Example:**
```typescript
// Source: useRecentRepos.ts existing persistence pattern
export interface RecentRepo {
  path: string;
  name: string;
  lastOpened: number;
  isPinned?: boolean; // NEW FIELD -- optional for backward compat
}

// In useRecentRepos hook, add:
const togglePin = useCallback(async (path: string) => {
  const store = await getStore();
  const existing = (await store.get<RecentRepo[]>(RECENT_REPOS_KEY)) || [];
  const updated = existing.map((r) =>
    r.path === path ? { ...r, isPinned: !r.isPinned } : r
  );
  await store.set(RECENT_REPOS_KEY, updated);
  await store.save();
  setRecentRepos(updated);
}, []);
```

### Pattern 4: Async Health Check (WELC-02)
**What:** For each repo in the recent list, query its status (clean/dirty/ahead/behind) using existing Tauri commands.
**When to use:** On welcome screen mount, with debounced refresh.
**Example:**
```typescript
// Source: commands.getBranchAheadBehind existing Tauri binding
// Note: getRepositoryStatus requires an open repo, but repos in the recent list
// are NOT open. Need a new lightweight Tauri command OR open-then-check-then-close pattern.
// RECOMMENDATION: Add a new Rust command `get_repo_status_quick(path)` that opens
// the repo temporarily, reads status, and closes without setting it as the active repo.

export type RepoHealthStatus = "clean" | "dirty" | "ahead" | "behind" | "diverged" | "unknown";
```

### Pattern 5: Open in Terminal via Rust Command (WELC-03)
**What:** A new Tauri command `open_in_terminal` that spawns the configured terminal at a given path using `std::process::Command`.
**When to use:** When user clicks "Open in Terminal" on a repo card.
**Example:**
```rust
// Source: Rust stdlib + project pattern (Tauri commands in src-tauri/src/git/commands.rs)
#[tauri::command]
#[specta::specta]
pub async fn open_in_terminal(path: String, terminal: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }

    // Platform-specific terminal spawning
    #[cfg(target_os = "macos")]
    {
        match terminal.as_str() {
            "terminal" => {
                std::process::Command::new("open")
                    .args(["-a", "Terminal", &path.display().to_string()])
                    .spawn()
                    .map_err(|e| e.to_string())?;
            }
            "iterm2" => {
                std::process::Command::new("open")
                    .args(["-a", "iTerm", &path.display().to_string()])
                    .spawn()
                    .map_err(|e| e.to_string())?;
            }
            other => {
                std::process::Command::new("open")
                    .args(["-a", other, &path.display().to_string()])
                    .spawn()
                    .map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(())
}
```

### Anti-Patterns to Avoid
- **Do NOT open/close the active repository to check health of recent repos:** This would disrupt the user's current session. Instead, create a separate lightweight Rust command that opens a temporary repo handle.
- **Do NOT use d3-scale for a single color interpolation:** The math is trivial; adding a dependency would be over-engineering.
- **Do NOT store pin state in a separate store key:** Keep it in the `RecentRepo[]` array alongside `lastOpened` for atomic updates.
- **Do NOT use raw `setTimeout` for tooltip delays:** Use framer-motion's `AnimatePresence` with `useReducedMotion` following the existing `ShortcutTooltip.tsx` pattern.
- **Do NOT install `tauri-plugin-shell` just for terminal opening:** A direct `std::process::Command` in a Tauri command is simpler and avoids capability configuration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reduced motion detection | Manual `matchMedia` listener | `useReducedMotion()` from framer-motion | Already imported in 4 components; handles cleanup |
| Tooltip positioning | Custom position math | Absolute positioning relative to SVG container + CSS `pointer-events-none` | SVG container is the natural coordinate space |
| Persistent key-value storage | File system writes | `@tauri-apps/plugin-store` via `getStore()` | Already handles serialization, disk persistence, cross-restart |
| Animated gradient legend | Canvas rendering | CSS `linear-gradient` with Tailwind | Simpler, theme-aware, zero-JS |

**Key insight:** Every feature in this phase integrates into existing patterns. The topology already has positioned nodes with colors; the welcome screen already has a persistent recent repos list. Resist the urge to introduce new state management or storage patterns.

## Common Pitfalls

### Pitfall 1: Heat Map Color Not Updating When New Commits Load
**What goes wrong:** The min/max timestamp range for color calculation is computed once and not recalculated when `loadMore()` appends new nodes.
**Why it happens:** `useMemo` dependency is stale if it only depends on `graphNodes` reference which mutates.
**How to avoid:** Compute `minTs` and `maxTs` inside the same `useMemo` that computes layout, or in a separate `useMemo` that depends on `graphNodes.length` and the last node's timestamp.
**Warning signs:** Colors at the bottom of the graph don't match the legend after loading more commits.

### Pitfall 2: Tooltip Flickers When Moving Between Adjacent Nodes
**What goes wrong:** `onMouseLeave` fires before `onMouseEnter` on the next circle, causing a brief null state.
**Why it happens:** SVG circles have gaps; the mouse crosses empty SVG space between them.
**How to avoid:** Use a small delay (50-100ms) before clearing the hovered node, or use a single `onMouseMove` handler on the SVG element that finds the nearest node within a threshold.
**Warning signs:** Tooltip rapidly appears/disappears when dragging mouse across commit nodes.

### Pitfall 3: Health Check Blocks Welcome Screen Render
**What goes wrong:** Checking status for 10 recent repos serially creates noticeable delay before the welcome screen shows content.
**Why it happens:** Each `getRepositoryStatus` involves opening a git repo, which is I/O bound.
**How to avoid:** Render repo cards immediately with "unknown" health status, then update asynchronously. Use `Promise.allSettled` to parallelize checks. Show a subtle loading indicator (skeleton dot) while checking.
**Warning signs:** Welcome screen takes 2+ seconds to render with 5+ recent repos.

### Pitfall 4: Pin State Lost on RecentRepo Array Mutation
**What goes wrong:** `addRecentRepo` reconstructs the array without preserving `isPinned` from existing entries.
**Why it happens:** The current `addRecentRepo` filters then prepends; it doesn't merge fields.
**How to avoid:** When re-adding a repo, preserve the `isPinned` field from the existing entry: `{ ...existingEntry, lastOpened: Date.now() }`.
**Warning signs:** Pinned repos lose their pin status after being opened.

### Pitfall 5: Open in Terminal Fails Silently on Unsupported Terminal
**What goes wrong:** `std::process::Command` spawns but the terminal app doesn't exist on the user's system.
**Why it happens:** The settings terminal value is a string like "iterm2" but the user hasn't installed iTerm.
**How to avoid:** Catch the spawn error and return a user-friendly error message. Consider falling back to the system default terminal.
**Warning signs:** "Open in Terminal" button appears to do nothing; no error toast shown.

### Pitfall 6: SVG Tooltip Positioned Outside Visible Viewport
**What goes wrong:** Tooltips for nodes near the right edge or bottom of the scrollable SVG area render off-screen.
**Why it happens:** Absolute positioning doesn't account for scroll position or container bounds.
**How to avoid:** Calculate tooltip position relative to the scroll container, and flip the tooltip direction when it would overflow. Use `getBoundingClientRect` for edge detection similar to `ShortcutTooltip.tsx` nudge logic.
**Warning signs:** Hovering nodes at extreme positions shows no visible tooltip (it exists but is clipped).

## Code Examples

### Existing PositionedNode Structure (topology layout)
```typescript
// Source: src/extensions/topology/lib/layoutUtils.ts
export interface PositionedNode {
  node: GraphNode;  // has oid, shortOid, message, author, timestampMs
  cx: number;       // center X in SVG coordinates
  cy: number;       // center Y in SVG coordinates
  r: number;        // circle radius
  color: string;    // branch-type hex color (replaced by heat color when toggle on)
}
```

### Existing SVG Circle Rendering (integration point for heat map + tooltip)
```typescript
// Source: src/extensions/topology/components/TopologyPanel.tsx lines 136-150
{nodes.map((pn: PositionedNode) => (
  <circle
    key={pn.node.oid}
    cx={pn.cx}
    cy={pn.cy}
    r={pn.r}
    fill={pn.color}                    // <-- heat map changes this
    fillOpacity={0.9}
    stroke={pn.node.oid === selectedCommit ? "#ffffff" : pn.color}
    strokeWidth={pn.node.oid === selectedCommit ? 3 : 1.5}
    strokeOpacity={pn.node.oid === selectedCommit ? 1 : 0.6}
    className="cursor-pointer pointer-events-auto"
    onClick={() => handleNodeClick(pn.node.oid)}
    // ADD: onMouseEnter/onMouseLeave for tooltip
  />
))}
```

### Existing Recent Repo Persistence Pattern
```typescript
// Source: src/core/hooks/useRecentRepos.ts
const store = await getStore();
const repos = await store.get<RecentRepo[]>(RECENT_REPOS_KEY);
// ... mutate array ...
await store.set(RECENT_REPOS_KEY, updated);
// Pin state follows this exact same pattern
```

### Existing Reduced Motion Pattern
```typescript
// Source: src/core/components/ui/ShortcutTooltip.tsx lines 1, 31
import { useReducedMotion } from "framer-motion";
const shouldReduceMotion = useReducedMotion();
// When shouldReduceMotion: render static div instead of motion.div
```

### Existing useReducedMotion in Tailwind
```css
/* Source: src/index.css and various components */
/* Pattern: motion-safe: prefix on animate-* classes */
className="motion-safe:animate-gentle-pulse"
```

### Existing AheadBehind Tauri Command
```typescript
// Source: src/bindings.ts line 511
async getBranchAheadBehind(branchName: string): Promise<Result<AheadBehind, GitError>>
// Returns { ahead: number, behind: number }
// NOTE: Requires an open repository. For welcome screen health checks,
// need a new command that can check a non-active repo path.
```

### GraphNode Fields Available for Tooltip (VIZ-03)
```typescript
// Source: src/bindings.ts lines 2136-2180
export type GraphNode = {
  oid: string;           // Full 40-char SHA
  shortOid: string;      // 7-char SHA (for tooltip display)
  message: string;       // First line of commit message (subject)
  author: string;        // Author name
  timestampMs: number;   // Unix timestamp in ms (for heat map + tooltip date)
  parents: string[];
  branchType: BranchType;
  column: number;
  branchNames: string[];
  isHeadAncestor: boolean;
  ideologicalBranch: string;
};
// NOTE: GraphNode has `author` (name) but NOT `authorEmail`.
// CommitSummary has both `authorName` and `authorEmail`.
// Tooltip will show author name from GraphNode directly.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Canvas-based graph rendering | SVG with DOM overlay badges | Phase 48 (current) | SVG is simpler for tooltips and heat map; no need to change |
| Individual localStorage keys | `@tauri-apps/plugin-store` single JSON file | Phase 1 (initial) | Atomic persistence; pin state fits naturally |
| `tauri-plugin-shell` for spawning | `std::process::Command` in Tauri command | N/A (new pattern) | Avoids new plugin dependency for single use case |

**Deprecated/outdated:**
- None relevant to this phase. All existing patterns are current and appropriate.

## Open Questions

1. **Health check for non-open repositories (WELC-02)**
   - What we know: `getRepositoryStatus` and `getBranchAheadBehind` require an open (active) repository. The welcome screen shows repos that are NOT currently open.
   - What's unclear: Can we safely open a repo temporarily in Rust without affecting the active repository state?
   - Recommendation: Add a new Rust command `get_repo_health_quick(path: String) -> RepoHealth` that opens a temporary `git2::Repository` handle (NOT through `RepositoryState`), reads branch name, dirty status, and ahead/behind counts, then drops the handle. This avoids disturbing the active repo. **Confidence: HIGH** -- `git2::Repository::open()` is independent of the app's `RepositoryState`.

2. **GraphNode lacks `authorEmail` for heat map author filtering**
   - What we know: `GraphNode` has `author` (string name) but no email. `CommitSummary` has both.
   - What's unclear: Whether we need author-specific heat map filtering in this phase.
   - Recommendation: Not needed for VIZ-02 requirements. The heat map is purely recency-based. If author filtering is desired later, extend `GraphNode` in Rust.

3. **"Open in Terminal" on Linux and Windows**
   - What we know: macOS uses `open -a <app> <path>`. Windows uses `cmd /c start <app>`. Linux varies by desktop environment.
   - What's unclear: Exact command syntax for all terminal apps across all platforms.
   - Recommendation: Implement macOS first (primary dev platform based on project config). Use a match statement per platform with the terminal identifier from settings. Fall back to `open <path>` (macOS) / `xdg-open <path>` (Linux) / `explorer <path>` (Windows) for unknown terminals. Add `#[cfg(target_os = "...")]` blocks.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** - Direct reading of:
  - `src/extensions/topology/components/TopologyPanel.tsx` (SVG rendering, node circles)
  - `src/extensions/topology/lib/layoutUtils.ts` (PositionedNode, layout computation)
  - `src/extensions/topology/components/CommitBadge.tsx` (commit metadata display)
  - `src/extensions/welcome-screen/components/RecentRepos.tsx` (repo card rendering)
  - `src/extensions/welcome-screen/components/WelcomeContent.tsx` (welcome layout)
  - `src/core/hooks/useRecentRepos.ts` (persistent recent repo storage)
  - `src/core/lib/store.ts` (`@tauri-apps/plugin-store` wrapper)
  - `src/core/stores/domain/preferences/settings.slice.ts` (settings persistence)
  - `src/core/components/ui/ShortcutTooltip.tsx` (tooltip + reduced motion pattern)
  - `src/core/lib/branchClassifier.ts` (hex color maps for SVG)
  - `src/core/lib/integrations-options.ts` (terminal app list per platform)
  - `src/bindings.ts` (GraphNode, RepoStatus, AheadBehind, CommitSummary types)
  - `src-tauri/src/git/repository.rs` (RepoStatus struct, RepositoryState)
  - `src-tauri/src/git/branch.rs` (AheadBehind, get_branch_ahead_behind)
  - `src-tauri/src/git/commands.rs` (Tauri command patterns)
  - `src-tauri/Cargo.toml` (no plugin-shell dependency)
  - `src-tauri/capabilities/default.json` (opener, dialog, store permissions)
  - `src/extensions/git-insights/components/GravatarAvatar.tsx` (Phase 51 avatar)
  - `src/index.css` (Tailwind @theme block, animation patterns)

### Secondary (MEDIUM confidence)
- [Tauri v2 Shell Plugin docs](https://v2.tauri.app/plugin/shell/) - Confirmed shell plugin exists but is NOT installed in this project
- [Tauri v2 Opener Plugin docs](https://v2.tauri.app/plugin/opener/) - Confirmed `revealItemInDir` and `openUrl` are available
- [Tauri v2 process spawning patterns](https://v2.tauri.app/plugin/process/) - `std::process::Command` is valid in Tauri commands

### Tertiary (LOW confidence)
- None. All findings verified through codebase inspection or official Tauri docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use; no new dependencies
- Architecture: HIGH - all integration points identified through direct code reading; patterns well-established
- Pitfalls: HIGH - identified through understanding actual code structure (heat map update, tooltip positioning, health check blocking, pin state preservation)
- Open questions: MEDIUM - the "open in terminal" cross-platform behavior needs validation during implementation

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable -- no moving library targets)
