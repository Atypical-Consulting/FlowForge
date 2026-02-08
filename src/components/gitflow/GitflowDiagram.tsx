import type { GitflowBranchType } from "../../lib/branchClassifier";
import { BRANCH_TYPE_COLORS } from "../../lib/branchClassifier";

interface GitflowDiagramProps {
  /** Which lane to highlight. undefined = no highlight. */
  highlightedLane?: GitflowBranchType;
}

// 5 horizontal lanes, evenly spaced — order matches mermaid gitgraph convention
const LANE_Y = {
  main: 40,
  hotfix: 90,
  release: 140,
  develop: 190,
  feature: 240,
} as const;

const LANE_X_START = 100;
const LANE_X_END = 850;
const SVG_WIDTH = 950;
const SVG_HEIGHT = 290;

// "You Are Here" indicator positions per branch type — derived from LANE_Y
const INDICATOR_Y: Record<string, number> = {
  main: LANE_Y.main,
  develop: LANE_Y.develop,
  feature: LANE_Y.feature,
  release: LANE_Y.release,
  hotfix: LANE_Y.hotfix,
};

// Commit dot positions on permanent lanes
const MAIN_COMMITS = [160, 280, 510, 660, 780];
const DEVELOP_COMMITS = [160, 240, 360, 530, 620, 700, 780];

// Feature: branches from develop, does work, merges back to develop
const FEATURE_BRANCH_X = 220;
const FEATURE_MERGE_X = 380;
const FEATURE_COMMITS = [260, 310, 350];

// Release: branches from develop, merges to main AND develop
const RELEASE_BRANCH_X = 420;
const RELEASE_MERGE_MAIN_X = 500;
const RELEASE_MERGE_DEV_X = 520;
const RELEASE_COMMITS = [450, 490];

// Hotfix: branches from main, merges to main AND develop
const HOTFIX_BRANCH_X = 580;
const HOTFIX_MERGE_MAIN_X = 650;
const HOTFIX_MERGE_DEV_X = 670;
const HOTFIX_COMMITS = [610];

// Version label positions on main
const VERSION_LABELS = [
  { x: 160, label: "v1.0" },
  { x: 510, label: "v2.0" },
  { x: 660, label: "v2.0.1" },
];

// Connector: straight vertical line between two lanes
interface Connector {
  type: GitflowBranchType;
  x: number;
  fromY: number;
  toY: number;
}

const CONNECTORS: Connector[] = [
  // Feature branch-out: develop -> feature (down)
  { type: "feature", x: FEATURE_BRANCH_X, fromY: LANE_Y.develop, toY: LANE_Y.feature },
  // Feature merge-back: feature -> develop (up)
  { type: "feature", x: FEATURE_MERGE_X, fromY: LANE_Y.feature, toY: LANE_Y.develop },
  // Release branch-out: develop -> release (up)
  { type: "release", x: RELEASE_BRANCH_X, fromY: LANE_Y.develop, toY: LANE_Y.release },
  // Release merge to main (up)
  { type: "release", x: RELEASE_MERGE_MAIN_X, fromY: LANE_Y.release, toY: LANE_Y.main },
  // Release merge to develop (down)
  { type: "release", x: RELEASE_MERGE_DEV_X, fromY: LANE_Y.release, toY: LANE_Y.develop },
  // Hotfix branch-out: main -> hotfix (down)
  { type: "hotfix", x: HOTFIX_BRANCH_X, fromY: LANE_Y.main, toY: LANE_Y.hotfix },
  // Hotfix merge to main (up)
  { type: "hotfix", x: HOTFIX_MERGE_MAIN_X, fromY: LANE_Y.hotfix, toY: LANE_Y.main },
  // Hotfix merge to develop (down)
  { type: "hotfix", x: HOTFIX_MERGE_DEV_X, fromY: LANE_Y.hotfix, toY: LANE_Y.develop },
];

const MARKER_TYPES: { id: string; type: GitflowBranchType }[] = [
  { id: "arrow-main", type: "main" },
  { id: "arrow-develop", type: "develop" },
  { id: "arrow-feature", type: "feature" },
  { id: "arrow-release", type: "release" },
  { id: "arrow-hotfix", type: "hotfix" },
];

// Lane configuration for rendering
interface LaneConfig {
  type: GitflowBranchType;
  label: string;
  y: number;
  xStart: number;
  xEnd: number;
  dashed: boolean;
  commits: number[];
}

const LANES: LaneConfig[] = [
  { type: "main", label: "main", y: LANE_Y.main, xStart: LANE_X_START, xEnd: LANE_X_END, dashed: false, commits: MAIN_COMMITS },
  { type: "hotfix", label: "hotfix/*", y: LANE_Y.hotfix, xStart: HOTFIX_BRANCH_X, xEnd: HOTFIX_MERGE_DEV_X, dashed: true, commits: HOTFIX_COMMITS },
  { type: "release", label: "release/*", y: LANE_Y.release, xStart: RELEASE_BRANCH_X, xEnd: RELEASE_MERGE_DEV_X, dashed: true, commits: RELEASE_COMMITS },
  { type: "develop", label: "develop", y: LANE_Y.develop, xStart: LANE_X_START, xEnd: LANE_X_END, dashed: false, commits: DEVELOP_COMMITS },
  { type: "feature", label: "feature/*", y: LANE_Y.feature, xStart: FEATURE_BRANCH_X, xEnd: FEATURE_MERGE_X, dashed: true, commits: FEATURE_COMMITS },
];

/**
 * Gitflow branching workflow diagram rendered as inline SVG.
 * Mermaid gitgraph-style: 5 horizontal lanes with straight vertical connectors.
 * Uses Catppuccin CSS variable colors for branch lanes.
 */
export function GitflowDiagram({ highlightedLane }: GitflowDiagramProps) {
  const hasHighlight =
    highlightedLane !== undefined && highlightedLane !== "other";

  const getOpacity = (type: GitflowBranchType) => {
    if (!hasHighlight) return 0.85;
    return highlightedLane === type ? 1 : 0.35;
  };

  const getStrokeWidth = (type: GitflowBranchType, base: number) => {
    if (hasHighlight && highlightedLane === type) return base + 1;
    return base;
  };

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className="w-full h-auto"
      role="img"
      aria-label="Gitflow branching workflow diagram"
    >
      {/* Background */}
      <rect
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        fill="var(--catppuccin-color-mantle)"
        rx="8"
      />

      <defs>
        {/* Glow filter for active lane */}
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Arrow markers — one per branch color */}
        {MARKER_TYPES.map(({ id, type }) => (
          <marker
            key={id}
            id={id}
            viewBox="0 0 10 8"
            refX="10"
            refY="4"
            markerWidth="8"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 4 L 0 8 z" fill={BRANCH_TYPE_COLORS[type]} />
          </marker>
        ))}
      </defs>

      {/* === HORIZONTAL LANE LINES === */}
      {LANES.map((lane) => (
        <g key={lane.type} opacity={getOpacity(lane.type)}>
          {/* Lane line */}
          <line
            x1={lane.xStart}
            y1={lane.y}
            x2={lane.xEnd}
            y2={lane.y}
            stroke={BRANCH_TYPE_COLORS[lane.type]}
            strokeWidth={getStrokeWidth(lane.type, 2.5)}
            strokeLinecap="round"
            {...(lane.dashed && { strokeDasharray: "6 3" })}
            {...(hasHighlight &&
              highlightedLane === lane.type && { filter: "url(#glow)" })}
          />

          {/* Lane label */}
          <text
            x={15}
            y={lane.y + 5}
            fill={BRANCH_TYPE_COLORS[lane.type]}
            fontSize={13}
            fontFamily="var(--font-mono)"
            fontWeight={
              hasHighlight && highlightedLane === lane.type ? "bold" : "normal"
            }
          >
            {lane.label}
          </text>

          {/* Commit dots */}
          {lane.commits.map((cx) => (
            <circle
              key={cx}
              cx={cx}
              cy={lane.y}
              r={hasHighlight && highlightedLane === lane.type ? 5 : 4}
              fill={BRANCH_TYPE_COLORS[lane.type]}
            />
          ))}
        </g>
      ))}

      {/* === VERTICAL CONNECTORS === */}
      {CONNECTORS.map((connector, i) => {
        const markerId = `arrow-${connector.type}`;
        return (
          <g key={i} opacity={getOpacity(connector.type)}>
            {/* Vertical connector line */}
            <line
              x1={connector.x}
              y1={connector.fromY}
              x2={connector.x}
              y2={connector.toY}
              stroke={BRANCH_TYPE_COLORS[connector.type]}
              strokeWidth={getStrokeWidth(connector.type, 2)}
              markerEnd={`url(#${markerId})`}
              {...(hasHighlight &&
                highlightedLane === connector.type && { filter: "url(#glow)" })}
            />

            {/* Junction dot at source */}
            <circle
              cx={connector.x}
              cy={connector.fromY}
              r={3}
              fill={BRANCH_TYPE_COLORS[connector.type]}
            />

            {/* Junction dot at target */}
            <circle
              cx={connector.x}
              cy={connector.toY}
              r={3}
              fill={BRANCH_TYPE_COLORS[connector.type]}
            />
          </g>
        );
      })}

      {/* === VERSION LABELS ON MAIN === */}
      {VERSION_LABELS.map(({ x, label }) => (
        <g key={label} opacity={getOpacity("main")}>
          <rect
            x={x - 18}
            y={LANE_Y.main - 26}
            width={36}
            height={16}
            rx={3}
            fill="var(--catppuccin-color-surface0)"
            stroke={BRANCH_TYPE_COLORS.main}
            strokeWidth={1}
          />
          <text
            x={x}
            y={LANE_Y.main - 15}
            fill={BRANCH_TYPE_COLORS.main}
            fontSize={9}
            fontFamily="var(--font-mono)"
            fontWeight="bold"
            textAnchor="middle"
          >
            {label}
          </text>
        </g>
      ))}

      {/* === "YOU ARE HERE" INDICATOR === */}
      {hasHighlight && (
        <g className="motion-safe:animate-gentle-pulse">
          {/* Outer glow circle */}
          <circle
            cx={820}
            cy={INDICATOR_Y[highlightedLane]}
            r={10}
            fill={BRANCH_TYPE_COLORS[highlightedLane]}
            opacity={0.25}
          />
          {/* Inner dot */}
          <circle
            cx={820}
            cy={INDICATOR_Y[highlightedLane]}
            r={5}
            fill={BRANCH_TYPE_COLORS[highlightedLane]}
          />
          {/* Label */}
          <text
            x={820}
            y={INDICATOR_Y[highlightedLane] - 18}
            fill={BRANCH_TYPE_COLORS[highlightedLane]}
            fontSize={10}
            fontWeight="bold"
            textAnchor="middle"
          >
            YOU ARE HERE
          </text>
        </g>
      )}
    </svg>
  );
}
