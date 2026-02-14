# Phase 51: Git Insights Dashboard - Research

**Researched:** 2026-02-14
**Domain:** Git analytics visualization, React charting, Rust commit analysis
**Confidence:** HIGH

## Summary

This phase adds a data-driven Git Insights Dashboard as a new extension. The project already has substantial infrastructure: the extension system (manifest.json + onActivate/onDeactivate), the blade system for UI panels, Zustand stores with the slice pattern for state, and the git2-rs backend with existing commit/branch commands. The primary new work involves: (1) new Rust Tauri commands to aggregate analytics data (commit frequency, contributor stats, branch health), (2) a new visx-based charting layer on the frontend, (3) a Gravatar avatar utility using SHA-256 hashes, and (4) wiring it all into a new `git-insights` extension with its own store, blades, and toolbar entry.

The Rust backend already exposes `get_commit_history`, `list_all_branches`, `get_branch_ahead_behind`, and `get_commit_graph` -- these provide some raw data but are not optimized for analytics aggregation. New Tauri commands should perform server-side aggregation (group-by-day, count-by-author) to avoid transferring thousands of individual commits over IPC. The frontend charting library recommendation is **visx** (@visx/xychart) -- it is modular, tree-shakeable, supports dark themes via `buildChartTheme`, and integrates naturally with React (JSX API). Gravatar now prefers SHA-256 over MD5, and the Web Crypto API (`crypto.subtle.digest`) is available in Tauri's webview.

**Primary recommendation:** Build as a self-contained `git-insights` extension using @visx/xychart for charts, new Rust analytics commands for server-side aggregation, and Web Crypto SHA-256 for Gravatar URLs. Follow existing extension patterns (topology, github) exactly.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @visx/xychart | ^3.11 | High-level chart components (BarSeries, AreaSeries, Tooltip, Axis, Grid) | Airbnb's React-native charting; modular, tree-shakeable, supports custom themes via `buildChartTheme` |
| @visx/responsive | ^3.11 | `ParentSize` wrapper for responsive chart dimensions | Required companion for responsive layouts in visx |
| @visx/text | ^3.11 | SVG text rendering for labels | Text rendering in axis labels and annotations |
| git2 (Rust) | 0.20 | Already in Cargo.toml -- commit walking, branch enumeration, ahead/behind | Already a project dependency; provides all git primitives needed |
| chrono (Rust) | 0.4 | Already in Cargo.toml -- date grouping for commit frequency | Already a project dependency; needed to bucket timestamps into days |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Web Crypto API (built-in) | N/A | SHA-256 hashing for Gravatar URLs | No install needed; `crypto.subtle.digest("SHA-256", ...)` is available in Tauri webview |
| @visx/gradient | ^3.11 | Optional SVG gradient fills for area charts | If area chart needs gradient fill from color to transparent |
| @visx/group | ^3.11 | SVG group positioning | If building custom chart layouts beyond xychart |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @visx/xychart | recharts | Recharts is simpler (drop-in) but less customizable; ~40kb gzipped monolith vs visx modular tree-shaking; recharts gives less control over Catppuccin theme integration |
| @visx/xychart | Custom SVG | Full control but requires hand-rolling tooltips, axes, scales, responsiveness -- weeks of work for minimal benefit |
| Web Crypto SHA-256 | md5 npm package | Gravatar still supports MD5 but officially recommends SHA-256; Web Crypto is built-in (zero-dependency) |
| Rust-side aggregation | Frontend aggregation | Frontend aggregation would transfer thousands of CommitSummary objects over IPC for large repos; Rust-side is dramatically faster and lighter on the wire |

**Installation:**
```bash
npm install @visx/xychart @visx/responsive @visx/text
```

No Rust dependencies to add -- git2 0.20 and chrono 0.4 are already in Cargo.toml.

## Architecture Patterns

### Recommended Project Structure
```
src/extensions/git-insights/
  manifest.json              # Extension manifest (id: "git-insights")
  index.ts                   # onActivate / onDeactivate
  insightsStore.ts           # Zustand store for analytics data
  types.ts                   # TypeScript types for analytics data
  blades/
    InsightsDashboardBlade.tsx  # Main dashboard blade with sub-tabs
  components/
    CommitActivityChart.tsx   # INSI-01: Daily commit frequency chart
    ContributorBreakdown.tsx  # INSI-02: Contributor stats + click-to-filter
    BranchHealthOverview.tsx  # INSI-03: Branch health table
    RepoStatsCards.tsx        # INSI-04: Summary stat cards grid
    GravatarAvatar.tsx        # VIZ-01: Email-based avatar component
    TimeRangeSelector.tsx     # Shared time range picker (7/30/90 days)
  hooks/
    useInsightsData.ts        # React hook orchestrating data loading
  lib/
    gravatar.ts              # SHA-256 hash + URL generation utility
    chartTheme.ts            # Catppuccin-based visx theme via buildChartTheme

src-tauri/src/git/
  insights.rs               # New module: analytics aggregation commands
```

### Pattern 1: Extension Registration (follow topology/github patterns exactly)

**What:** New extension with manifest.json + onActivate/onDeactivate entry point
**When to use:** Always for new features in this project
**Example:**
```json
// manifest.json
{
  "id": "git-insights",
  "name": "Git Insights Dashboard",
  "version": "1.0.0",
  "description": "Data-driven repository analytics with commit activity charts, contributor breakdown, and branch health.",
  "apiVersion": "1",
  "main": "index.ts",
  "contributes": {
    "blades": [{ "type": "insights-dashboard", "title": "Insights" }],
    "commands": [{ "id": "show-insights", "title": "Show Insights", "category": "Navigation" }],
    "toolbar": [{ "id": "insights", "label": "Insights", "group": "views", "priority": 40 }]
  },
  "trustLevel": "built-in"
}
```

```typescript
// index.ts (follows topology extension pattern)
import { lazy } from "react";
import { BarChart3 } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { openBlade } from "../../core/lib/bladeOpener";
import { useGitOpsStore } from "../../core/stores/domain/git-ops";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const InsightsDashboardBlade = lazy(() =>
    import("./blades/InsightsDashboardBlade").then((m) => ({
      default: m.InsightsDashboardBlade,
    }))
  );

  api.registerBlade({
    type: "insights-dashboard",
    title: "Insights",
    component: InsightsDashboardBlade,
    singleton: true,
    lazy: true,
    wrapInPanel: true,
    showBack: true,
  });

  api.registerCommand({
    id: "show-insights",
    title: "Show Insights Dashboard",
    description: "View repository analytics and activity charts",
    category: "Navigation",
    icon: BarChart3,
    keywords: ["insights", "analytics", "activity", "contributors", "stats"],
    action: () => openBlade("ext:git-insights:insights-dashboard", {}),
    enabled: () => !!useGitOpsStore.getState().repoStatus,
  });

  api.contributeToolbar({
    id: "insights",
    label: "Insights",
    icon: BarChart3,
    group: "views",
    priority: 40,
    when: () => !!useGitOpsStore.getState().repoStatus,
    execute: () => openBlade("ext:git-insights:insights-dashboard", {}),
  });
}

export function onDeactivate(): void {
  // api.cleanup() handles all unregistrations
}
```

### Pattern 2: Rust Analytics Commands (server-side aggregation)

**What:** New Tauri commands that aggregate data in Rust, returning pre-computed summaries
**When to use:** When raw data is too large to send over IPC (thousands of commits)
**Example:**
```rust
// src-tauri/src/git/insights.rs

/// Daily commit count for a specific date.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DailyCommitCount {
    /// Date as "YYYY-MM-DD"
    pub date: String,
    /// Number of commits on this date
    pub count: u32,
}

/// Contributor statistics.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContributorStats {
    pub name: String,
    pub email: String,
    pub commit_count: u32,
    pub percentage: f64,
    pub first_commit_ms: f64,
    pub last_commit_ms: f64,
}

/// Repository-level summary statistics.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepoInsights {
    pub total_commits: u32,
    pub active_branches: u32,
    pub contributor_count: u32,
    pub first_commit_ms: f64,
    pub daily_commits: Vec<DailyCommitCount>,
    pub contributors: Vec<ContributorStats>,
}

/// Get aggregated repository insights.
#[tauri::command]
#[specta::specta]
pub async fn get_repo_insights(
    days: u32,
    state: State<'_, RepositoryState>,
) -> Result<RepoInsights, GitError> {
    let repo_path = state.get_path().await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        // ... aggregate data in a single revwalk pass ...
    }).await.map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
```

### Pattern 3: Extension Zustand Store (standalone, not a git-ops slice)

**What:** Dedicated Zustand store for insights data, separate from the git-ops mega-store
**When to use:** Extension-specific state that doesn't need to be shared with core
**Example:**
```typescript
// insightsStore.ts (follows githubStore pattern -- standalone, not a git-ops slice)
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { commands } from "../../bindings";

interface InsightsState {
  insights: RepoInsights | null;
  isLoading: boolean;
  error: string | null;
  timeRange: 7 | 30 | 90;
  selectedContributor: string | null;
  loadInsights: () => Promise<void>;
  setTimeRange: (range: 7 | 30 | 90) => void;
  selectContributor: (email: string | null) => void;
}

export const useInsightsStore = create<InsightsState>()(
  devtools((set, get) => ({
    insights: null,
    isLoading: false,
    error: null,
    timeRange: 30,
    selectedContributor: null,
    loadInsights: async () => { /* ... */ },
    setTimeRange: (range) => { set({ timeRange: range }); get().loadInsights(); },
    selectContributor: (email) => set({ selectedContributor: email }),
  }), { name: "git-insights", enabled: import.meta.env.DEV })
);
```

### Pattern 4: visx XYChart with Catppuccin Theme

**What:** Chart components using @visx/xychart with a custom Catppuccin-derived theme
**When to use:** All chart rendering in this extension
**Example:**
```typescript
// lib/chartTheme.ts
import { buildChartTheme } from "@visx/xychart";

// Catppuccin Mocha colors for chart series
const CATPPUCCIN_CHART_COLORS = [
  "#89b4fa", // blue
  "#a6e3a1", // green
  "#f9e2af", // yellow
  "#fab387", // peach
  "#cba6f7", // mauve
  "#f38ba8", // red
  "#94e2d5", // teal
  "#f5c2e7", // pink
];

export const insightsChartTheme = buildChartTheme({
  backgroundColor: "#1e1e2e",  // ctp-base
  colors: CATPPUCCIN_CHART_COLORS,
  gridColor: "#313244",        // ctp-surface0
  gridColorDark: "#45475a",    // ctp-surface1
  svgLabelSmall: { fill: "#a6adc8" },  // ctp-subtext0
  svgLabelBig: { fill: "#cdd6f4" },    // ctp-text
  tickLength: 4,
});
```

```tsx
// components/CommitActivityChart.tsx
import { XYChart, BarSeries, Axis, Grid, Tooltip } from "@visx/xychart";
import { insightsChartTheme } from "../lib/chartTheme";

export function CommitActivityChart({ data }: { data: DailyCommitCount[] }) {
  return (
    <XYChart
      height={240}
      theme={insightsChartTheme}
      xScale={{ type: "band", paddingInner: 0.3 }}
      yScale={{ type: "linear" }}
    >
      <Grid columns={false} numTicks={4} />
      <BarSeries
        dataKey="commits"
        data={data}
        xAccessor={(d) => d.date}
        yAccessor={(d) => d.count}
      />
      <Axis orientation="bottom" numTicks={7} />
      <Axis orientation="left" numTicks={4} />
      <Tooltip
        snapTooltipToDatumX
        snapTooltipToDatumY
        showVerticalCrosshair
        renderTooltip={({ tooltipData }) => {
          const datum = tooltipData?.nearestDatum?.datum as DailyCommitCount;
          return datum ? <div>{datum.date}: {datum.count} commits</div> : null;
        }}
      />
    </XYChart>
  );
}
```

### Pattern 5: Gravatar Avatar with SHA-256 and Caching

**What:** Email-to-avatar component using Web Crypto SHA-256 with in-memory cache
**When to use:** Displaying author avatars next to commits
**Example:**
```typescript
// lib/gravatar.ts
const hashCache = new Map<string, string>();

export async function getGravatarUrl(email: string, size = 40): Promise<string> {
  const normalized = email.trim().toLowerCase();

  if (hashCache.has(normalized)) {
    return `https://gravatar.com/avatar/${hashCache.get(normalized)}?s=${size}&d=retro`;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  hashCache.set(normalized, hashHex);
  return `https://gravatar.com/avatar/${hashHex}?s=${size}&d=retro`;
}
```

```tsx
// components/GravatarAvatar.tsx
import { useState, useEffect } from "react";

interface GravatarAvatarProps {
  email: string;
  name: string;
  size?: "sm" | "md";
}

export function GravatarAvatar({ email, name, size = "sm" }: GravatarAvatarProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    getGravatarUrl(email, size === "sm" ? 40 : 56).then(setUrl);
  }, [email, size]);

  // Fallback to initials (similar to existing UserAvatar pattern)
  if (!url || hasError) {
    return (
      <div className={`${sizeClass} rounded-full bg-ctp-surface1 ...`}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return <img src={url} alt={name} className={`${sizeClass} rounded-full`}
    loading="lazy" onError={() => setHasError(true)} />;
}
```

### Anti-Patterns to Avoid
- **Transferring raw commits over IPC for analytics:** Never send thousands of CommitSummary objects to JS for counting. Aggregate in Rust.
- **Installing full @visx/visx umbrella:** Only install the specific visx packages needed. The umbrella package includes all 30+ sub-packages.
- **Adding insights as a git-ops slice:** The insights store is extension-specific. Don't pollute the core GitOpsStore with extension data. Follow the githubStore pattern (standalone create()).
- **MD5 for Gravatar:** Use SHA-256 (Gravatar's current recommendation). MD5 works but is deprecated for this use case.
- **Synchronous revwalk on main thread:** Always use `tokio::task::spawn_blocking` for git2 operations, as the project already does consistently.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG bar/area charts | Custom SVG rects + scales | @visx/xychart BarSeries/AreaSeries | Axes, scales, tooltips, responsiveness, animation all handled; 100+ edge cases in chart rendering |
| Responsive chart sizing | Manual resize observers | @visx/responsive ParentSize | Handles debouncing, SSR, and container queries properly |
| Chart tooltips | Custom mousemove + positioning | @visx/xychart Tooltip | Cross-browser, snap-to-datum, crosshair support built-in |
| SHA-256 hashing | Custom implementation or npm package | Web Crypto API `crypto.subtle.digest` | Built into all modern browsers and Tauri webview; zero-dependency |
| Date bucketing in JS | Manual date grouping | Rust-side chrono aggregation | Avoid sending thousands of commits over IPC; chrono already in Cargo.toml |

**Key insight:** visx's @visx/xychart provides a high-level declarative API (JSX) that handles the 80% case, while the modular architecture means you only import what you need. The alternative (raw D3 or custom SVG) would add weeks of work with no tangible benefit.

## Common Pitfalls

### Pitfall 1: Revwalk Performance on Large Repos
**What goes wrong:** Walking entire commit history (100k+ commits) for analytics causes multi-second blocking
**Why it happens:** git2 revwalk is single-threaded and must deserialize every commit object
**How to avoid:**
  - Use `days` parameter to limit walk scope (cutoff by timestamp, break early)
  - Use `spawn_blocking` (already project standard)
  - Cache results with a timestamp; only recompute on repository-changed events
  - For "total commits" stat, consider using `revwalk.count()` which is faster than collecting
**Warning signs:** Analytics load time > 1 second on medium repos (5k+ commits)

### Pitfall 2: visx Bundle Bloat
**What goes wrong:** Installing `@visx/visx` umbrella brings in 30+ packages including react-spring, d3-geo, etc.
**Why it happens:** Developers import from umbrella package for convenience
**How to avoid:** Only install needed packages: `@visx/xychart`, `@visx/responsive`, `@visx/text`. The xychart package internally depends on what it needs.
**Warning signs:** Bundle analyzer shows d3-geo, topojson, or react-spring when you only need bar charts

### Pitfall 3: IPC Serialization Overhead
**What goes wrong:** Sending 10,000 CommitSummary objects across Tauri IPC for frontend aggregation
**Why it happens:** Developer thinks "just get all commits and group in JS"
**How to avoid:** Aggregate in Rust. Return pre-computed `DailyCommitCount[]` and `ContributorStats[]` instead of raw commits. A single Rust revwalk pass with HashMap accumulation is O(n) and stays in-process.
**Warning signs:** Dashboard takes 3+ seconds to load; network tab shows large IPC payloads

### Pitfall 4: Gravatar Rate Limiting / Privacy
**What goes wrong:** Hundreds of concurrent Gravatar HTTP requests on large contributor lists
**Why it happens:** Each avatar triggers an immediate HTTP request without deduplication
**How to avoid:**
  - Deduplicate by email hash before requesting (Map cache)
  - Use `loading="lazy"` on img elements (browser-native lazy loading)
  - Consider `d=retro` or `d=identicon` as default to always get a deterministic image (no 404)
  - Keep avatar requests in the browser (img src), don't proxy through Rust
**Warning signs:** Console shows many 404s or rate-limit responses from gravatar.com

### Pitfall 5: Stale Data After Repository Changes
**What goes wrong:** Insights dashboard shows old data after new commits, branch operations
**Why it happens:** Extension doesn't subscribe to repository-changed events
**How to avoid:** Listen for `repository-changed` Tauri event (same pattern as topology extension) to trigger re-fetch. Also re-fetch on `repoStatus` changes in the Zustand store.
**Warning signs:** User commits but chart doesn't update until manual refresh

### Pitfall 6: BranchInfo Missing Last Commit Timestamp
**What goes wrong:** Branch health view needs "last commit date" but existing `BranchInfo` only has `lastCommitOid` and `lastCommitMessage`
**Why it happens:** The current Rust `list_all_branches` command doesn't include timestamp
**How to avoid:** Either (a) extend `BranchInfo` with a `lastCommitTimestampMs` field, or (b) create a new `BranchHealthInfo` struct in the insights module that includes all needed fields. Option (b) is cleaner -- avoids modifying existing API surface.
**Warning signs:** N+1 query pattern where frontend calls `get_commit_details` for each branch to get timestamps

## Code Examples

### Rust: Single-Pass Commit Aggregation
```rust
// Efficient single-pass revwalk with early termination
use std::collections::HashMap;
use chrono::{NaiveDate, TimeZone, Utc};

fn aggregate_commits(
    repo: &git2::Repository,
    days: u32,
) -> Result<(Vec<DailyCommitCount>, Vec<ContributorStats>, u32), GitError> {
    let cutoff_ts = Utc::now().timestamp() - (days as i64 * 86400);

    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    revwalk.set_sorting(git2::Sort::TIME)?;

    let mut daily: HashMap<String, u32> = HashMap::new();
    let mut authors: HashMap<String, (String, u32, i64, i64)> = HashMap::new(); // email -> (name, count, first, last)
    let mut total = 0u32;

    for oid_result in revwalk {
        let oid = match oid_result {
            Ok(o) => o,
            Err(_) => continue,
        };
        let commit = match repo.find_commit(oid) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let ts = commit.author().when().seconds();
        total += 1;

        // Only bucket within time range
        if ts >= cutoff_ts {
            let date = Utc.timestamp_opt(ts, 0)
                .single()
                .map(|dt| dt.format("%Y-%m-%d").to_string())
                .unwrap_or_default();
            *daily.entry(date).or_insert(0) += 1;

            let email = commit.author().email().unwrap_or("").to_string();
            let name = commit.author().name().unwrap_or("Unknown").to_string();
            let entry = authors.entry(email).or_insert((name, 0, ts, ts));
            entry.1 += 1;
            entry.2 = entry.2.min(ts);
            entry.3 = entry.3.max(ts);
        } else {
            // Commits are sorted by time, so we can break early
            // But we still need total_commits... so either continue counting
            // or accept approximate total (commits within timeframe)
            break; // For approximate: break here, total = within-range count
        }
    }

    // Convert to sorted vectors...
    Ok((daily_vec, contributor_vec, total))
}
```

### TypeScript: visx XYChart with Catppuccin Dark Theme
```tsx
import { XYChart, AnimatedBarSeries, AnimatedAxis, AnimatedGrid, Tooltip } from "@visx/xychart";
import { ParentSize } from "@visx/responsive";
import type { DailyCommitCount } from "../types";
import { insightsChartTheme } from "../lib/chartTheme";

interface Props {
  data: DailyCommitCount[];
}

export function CommitActivityChart({ data }: Props) {
  return (
    <ParentSize>
      {({ width }) => (
        <XYChart
          height={240}
          width={width}
          theme={insightsChartTheme}
          xScale={{ type: "band", paddingInner: 0.3 }}
          yScale={{ type: "linear" }}
        >
          <AnimatedGrid columns={false} numTicks={4} />
          <AnimatedBarSeries
            dataKey="Daily Commits"
            data={data}
            xAccessor={(d) => d.date}
            yAccessor={(d) => d.count}
          />
          <AnimatedAxis orientation="bottom" numTicks={7} tickLabelProps={{ angle: -45 }} />
          <AnimatedAxis orientation="left" numTicks={4} />
          <Tooltip
            snapTooltipToDatumX
            snapTooltipToDatumY
            showVerticalCrosshair
            renderTooltip={({ tooltipData }) => {
              const datum = tooltipData?.nearestDatum?.datum as DailyCommitCount;
              if (!datum) return null;
              return (
                <div className="text-xs">
                  <div className="font-medium">{datum.date}</div>
                  <div>{datum.count} commits</div>
                </div>
              );
            }}
          />
        </XYChart>
      )}
    </ParentSize>
  );
}
```

### TypeScript: SHA-256 Gravatar URL Generation
```typescript
// Source: MDN Web Crypto API + Gravatar Developer Docs
const hashCache = new Map<string, string>();

export async function getGravatarUrl(email: string, size = 40): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const cached = hashCache.get(normalized);
  if (cached) return `https://gravatar.com/avatar/${cached}?s=${size}&d=retro`;

  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  hashCache.set(normalized, hashHex);
  return `https://gravatar.com/avatar/${hashHex}?s=${size}&d=retro`;
}
```

## Existing Code to Reuse

The following already exists in the codebase and should be reused, NOT duplicated:

| What | Location | How to Reuse |
|------|----------|--------------|
| `CommitSummary` type (has `authorEmail`) | `src/bindings.ts`, `src-tauri/src/git/history.rs` | Available for Gravatar email source; already has `authorEmail` field |
| `BranchInfo` type (has `lastCommitOid`, `isMerged`) | `src/bindings.ts`, `src-tauri/src/git/branch.rs` | Partial branch health data; extend with new `BranchHealthInfo` for timestamps |
| `AheadBehind` type | `src/bindings.ts`, `src-tauri/src/git/branch.rs` | `get_branch_ahead_behind` command already exists for per-branch ahead/behind |
| `GraphNode` type (has `author`, `timestampMs`) | `src/bindings.ts`, `src-tauri/src/git/graph.rs` | Graph nodes already include author and timestamp |
| `UserAvatar` component pattern | `src/extensions/github/components/UserAvatar.tsx` | Pattern for avatar with initials fallback; replicate for GravatarAvatar |
| `RepositoryState` + spawn_blocking pattern | `src-tauri/src/git/repository.rs` | All Tauri commands use this pattern; follow exactly |
| `GitError` enum | `src-tauri/src/git/error.rs` | Reuse for new command error handling |
| Extension registration pattern | `src/extensions/topology/index.ts` | Follow this pattern for blade + command + toolbar registration |
| Standalone store pattern | `src/extensions/github/githubStore.ts` | Follow this pattern for `useInsightsStore` (not a git-ops slice) |
| `listen("repository-changed")` | `src/extensions/topology/index.ts` line 43 | Subscribe to auto-refresh insights on external repo changes |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Gravatar MD5 hashing | Gravatar SHA-256 hashing | 2024 | Use `crypto.subtle.digest("SHA-256", ...)` instead of MD5; both still work but SHA-256 is officially recommended |
| @visx/xychart v2 | @visx/xychart v3 | 2023 | v3 improved tooltip performance and added AnimatedBarSeries; v3.11.0 (May 2024) has latest perf fixes |
| visx umbrella install | Modular per-package install | Always true | Only install `@visx/xychart`, `@visx/responsive`, `@visx/text` -- xychart pulls its own internal deps |

**Deprecated/outdated:**
- Gravatar MD5: Still works but SHA-256 is the official recommendation since 2024
- `@visx/visx` umbrella: Not deprecated per se, but not recommended for production due to bundle size

## Open Questions

1. **Total Commits Count Strategy**
   - What we know: Breaking early on timestamp cutoff gives fast results for "within range" data, but "total commits ever" requires a full revwalk
   - What's unclear: Is approximate total (within range) acceptable, or must we walk all commits?
   - Recommendation: Use two-pass: first call returns time-ranged data, second optional call counts total with a simple `revwalk.count()` (no commit deserialization needed)

2. **Branch Health "Staleness" Threshold**
   - What we know: Need a "stale" flag for branches
   - What's unclear: What defines "stale"? 30 days? 60 days? Configurable?
   - Recommendation: Default to 30 days (common in similar tools). Make it configurable via extension settings. Flag branches where last commit > threshold as stale.

3. **Click-to-Filter Contributor Integration**
   - What we know: INSI-02 requires clicking a contributor to filter commit history to that person
   - What's unclear: Does "filter commit history" mean filtering the topology graph or a local list within the insights blade?
   - Recommendation: Filter a local commit list within the insights blade first (self-contained). Optionally emit an extension event (`api.events.emit("filter-by-author", { email })`) that topology could subscribe to later.

4. **Avatar Caching Duration**
   - What we know: Gravatar URLs are deterministic (hash + email), so the hash cache is permanent. But avatar images themselves could change.
   - What's unclear: How long to cache the actual image response?
   - Recommendation: Let the browser handle image caching (HTTP cache headers from Gravatar). Only cache the hash computation (Map in memory, cleared on page reload). This is sufficient.

5. **BladePropsMap Registration**
   - What we know: Core blade types are registered in `src/core/stores/bladeTypes.ts`. Extension blades use the `ext:` prefix and don't need core registration.
   - What's unclear: Nothing -- extension blades bypass BladePropsMap entirely.
   - Recommendation: Do NOT add to BladePropsMap. Use `ext:git-insights:insights-dashboard` convention (automatic from ExtensionAPI).

## Sources

### Primary (HIGH confidence)
- Codebase analysis of existing extension patterns (topology, github, gitflow, worktrees) -- direct file reads
- Codebase analysis of Rust backend (history.rs, branch.rs, graph.rs, repository.rs) -- direct file reads
- Codebase analysis of store patterns (topology.slice.ts, githubStore.ts, git-ops/index.ts) -- direct file reads
- [@visx/xychart GitHub README](https://github.com/airbnb/visx/blob/master/packages/visx-xychart/README.md) -- API components and props
- [MDN SubtleCrypto.digest()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) -- SHA-256 Web Crypto API

### Secondary (MEDIUM confidence)
- [Gravatar Developer Docs - Creating identifier hash](https://docs.gravatar.com/rest/hash/) -- SHA-256 replaces MD5 as recommended algorithm
- [Gravatar Developer Docs - Avatars](https://docs.gravatar.com/sdk/images/) -- URL format, size parameter, default options
- [LogRocket: Best React Chart Libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/) -- visx vs recharts comparison
- [npm-compare: visx vs recharts](https://npm-compare.com/@visx/visx,chart.js,d3,react-vis,recharts) -- bundle size and popularity comparison
- [THG Tech Blog: Analysing source control history with Rust](https://medium.com/thg-tech-blog/analysing-source-control-history-with-rust-ba766cf1f648) -- git2 revwalk performance patterns
- [git2-rs Revwalk docs](https://docs.rs/git2/latest/git2/struct.Revwalk.html) -- API reference

### Tertiary (LOW confidence)
- [libgit2 revwalk performance regression #4740](https://github.com/libgit2/libgit2/issues/4740) -- historical performance issue (may not apply to current git2 0.20)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - visx is well-documented, tree-shakeable, and fits the project's React + custom theme needs; all Rust deps already present
- Architecture: HIGH - Extension patterns are thoroughly documented by existing code (topology, github); store patterns clear from git-ops slices and githubStore
- Pitfalls: HIGH - Identified from direct codebase analysis and known git2 performance characteristics
- Gravatar: MEDIUM - SHA-256 recommendation verified via multiple sources but official docs page rendered as CSS (content not extractable); URL format verified via blog + WordPress trac ticket
- visx API details: MEDIUM - GitHub README and npm docs confirmed API; Context7 unavailable (quota exceeded)

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable domain; visx and git2 are mature libraries)
