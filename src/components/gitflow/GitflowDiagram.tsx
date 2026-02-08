import type { GitflowBranchType } from "../../lib/branchClassifier";
import { BRANCH_TYPE_COLORS } from "../../lib/branchClassifier";

interface GitflowDiagramProps {
  /** Which lane to highlight. undefined = no highlight. */
  highlightedLane?: GitflowBranchType;
}

// Canonical layout: main at top, develop below, arcs between/below
const MAIN_Y = 50;
const DEVELOP_Y = 200;
const LANE_X_START = 100;
const LANE_X_END = 820;

// "You Are Here" indicator positions per branch type
const INDICATOR_Y: Record<string, number> = {
  main: MAIN_Y,
  develop: DEVELOP_Y,
  feature: 280, // below develop arc midpoint
  release: 125, // between develop and main
  hotfix: 125, // between main and develop
};

// Commit dot positions on permanent lanes
const MAIN_COMMITS = [160, 280, 510, 660, 780];
const DEVELOP_COMMITS = [160, 240, 360, 530, 620, 700, 780];

// Feature arc: branches DOWN from develop at x=180, arcs to Y=280, merges back at x=350
const FEATURE_BRANCH_X = 180;
const FEATURE_ARC_Y = 280;
const FEATURE_MERGE_X = 350;
const FEATURE_COMMITS = [230, 280, 310];

// Release arc: branches UP from develop at x=390, arcs to Y=125, merges to main at x=500, back to develop at x=530
const RELEASE_BRANCH_X = 390;
const RELEASE_ARC_Y = 125;
const RELEASE_MERGE_MAIN_X = 500;
const RELEASE_MERGE_DEV_X = 530;
const RELEASE_COMMITS = [430, 470];

// Hotfix arc: branches DOWN from main at x=570, arcs to Y=125, merges back to main at x=660, down to develop at x=690
const HOTFIX_BRANCH_X = 570;
const HOTFIX_ARC_Y = 125;
const HOTFIX_MERGE_MAIN_X = 660;
const HOTFIX_MERGE_DEV_X = 690;
const HOTFIX_COMMITS = [610];

// Version label positions on main
const VERSION_LABELS = [
  { x: 160, label: "v1.0" },
  { x: 510, label: "v2.0" },
  { x: 660, label: "v2.0.1" },
];

interface FlowCurve {
  type: GitflowBranchType;
  path: string;
  markerId: string;
}

const FLOW_CURVES: FlowCurve[] = [
  // Feature branch-out: develop -> feature (down)
  {
    type: "feature",
    path: `M ${FEATURE_BRANCH_X} ${DEVELOP_Y} C ${FEATURE_BRANCH_X} ${DEVELOP_Y + 50}, ${FEATURE_BRANCH_X + 30} ${FEATURE_ARC_Y}, ${FEATURE_BRANCH_X + 50} ${FEATURE_ARC_Y}`,
    markerId: "arrow-feature",
  },
  // Feature merge-back: feature -> develop (up)
  {
    type: "feature",
    path: `M ${FEATURE_MERGE_X - 20} ${FEATURE_ARC_Y} C ${FEATURE_MERGE_X} ${FEATURE_ARC_Y}, ${FEATURE_MERGE_X} ${DEVELOP_Y + 50}, ${FEATURE_MERGE_X} ${DEVELOP_Y}`,
    markerId: "arrow-feature",
  },
  // Release branch-out: develop -> release (up)
  {
    type: "release",
    path: `M ${RELEASE_BRANCH_X} ${DEVELOP_Y} C ${RELEASE_BRANCH_X} ${DEVELOP_Y - 40}, ${RELEASE_BRANCH_X + 20} ${RELEASE_ARC_Y}, ${RELEASE_BRANCH_X + 40} ${RELEASE_ARC_Y}`,
    markerId: "arrow-release",
  },
  // Release merge to main (up)
  {
    type: "release",
    path: `M ${RELEASE_MERGE_MAIN_X - 30} ${RELEASE_ARC_Y} C ${RELEASE_MERGE_MAIN_X - 10} ${RELEASE_ARC_Y}, ${RELEASE_MERGE_MAIN_X} ${MAIN_Y + 40}, ${RELEASE_MERGE_MAIN_X} ${MAIN_Y}`,
    markerId: "arrow-release",
  },
  // Release merge back to develop (down)
  {
    type: "release",
    path: `M ${RELEASE_MERGE_MAIN_X - 30} ${RELEASE_ARC_Y} C ${RELEASE_MERGE_DEV_X - 20} ${RELEASE_ARC_Y}, ${RELEASE_MERGE_DEV_X} ${DEVELOP_Y - 40}, ${RELEASE_MERGE_DEV_X} ${DEVELOP_Y}`,
    markerId: "arrow-release",
  },
  // Hotfix branch-out: main -> hotfix (down)
  {
    type: "hotfix",
    path: `M ${HOTFIX_BRANCH_X} ${MAIN_Y} C ${HOTFIX_BRANCH_X} ${MAIN_Y + 40}, ${HOTFIX_BRANCH_X + 20} ${HOTFIX_ARC_Y}, ${HOTFIX_BRANCH_X + 40} ${HOTFIX_ARC_Y}`,
    markerId: "arrow-hotfix",
  },
  // Hotfix merge to main (up)
  {
    type: "hotfix",
    path: `M ${HOTFIX_MERGE_MAIN_X - 30} ${HOTFIX_ARC_Y} C ${HOTFIX_MERGE_MAIN_X - 10} ${HOTFIX_ARC_Y}, ${HOTFIX_MERGE_MAIN_X} ${MAIN_Y + 40}, ${HOTFIX_MERGE_MAIN_X} ${MAIN_Y}`,
    markerId: "arrow-hotfix",
  },
  // Hotfix merge to develop (down)
  {
    type: "hotfix",
    path: `M ${HOTFIX_MERGE_MAIN_X - 30} ${HOTFIX_ARC_Y} C ${HOTFIX_MERGE_DEV_X - 20} ${HOTFIX_ARC_Y}, ${HOTFIX_MERGE_DEV_X} ${DEVELOP_Y - 40}, ${HOTFIX_MERGE_DEV_X} ${DEVELOP_Y}`,
    markerId: "arrow-hotfix",
  },
];

const MARKER_TYPES: { id: string; type: GitflowBranchType }[] = [
  { id: "arrow-main", type: "main" },
  { id: "arrow-develop", type: "develop" },
  { id: "arrow-feature", type: "feature" },
  { id: "arrow-release", type: "release" },
  { id: "arrow-hotfix", type: "hotfix" },
];

/**
 * Gitflow branching workflow diagram rendered as inline SVG.
 * Canonical layout: main at top, develop below, short-lived branches as arcs.
 * Uses Catppuccin CSS variable colors for branch lanes.
 * Arrowheads on all curves indicate flow direction.
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
      viewBox="0 0 900 340"
      className="w-full h-auto"
      role="img"
      aria-label="Gitflow branching workflow diagram"
    >
      {/* Background */}
      <rect
        width="900"
        height="340"
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

      {/* === PERMANENT LANES === */}

      {/* Main lane */}
      <g opacity={getOpacity("main")}>
        <line
          x1={LANE_X_START}
          y1={MAIN_Y}
          x2={LANE_X_END}
          y2={MAIN_Y}
          stroke={BRANCH_TYPE_COLORS.main}
          strokeWidth={getStrokeWidth("main", 2.5)}
          strokeLinecap="round"
          {...(hasHighlight &&
            highlightedLane === "main" && { filter: "url(#glow)" })}
        />
        <text
          x={15}
          y={MAIN_Y + 5}
          fill={BRANCH_TYPE_COLORS.main}
          fontSize={13}
          fontFamily="var(--font-mono)"
          fontWeight={
            hasHighlight && highlightedLane === "main" ? "bold" : "normal"
          }
        >
          main
        </text>
        {MAIN_COMMITS.map((cx) => (
          <circle
            key={cx}
            cx={cx}
            cy={MAIN_Y}
            r={hasHighlight && highlightedLane === "main" ? 5 : 4}
            fill={BRANCH_TYPE_COLORS.main}
          />
        ))}
      </g>

      {/* Develop lane */}
      <g opacity={getOpacity("develop")}>
        <line
          x1={LANE_X_START}
          y1={DEVELOP_Y}
          x2={LANE_X_END}
          y2={DEVELOP_Y}
          stroke={BRANCH_TYPE_COLORS.develop}
          strokeWidth={getStrokeWidth("develop", 2.5)}
          strokeLinecap="round"
          {...(hasHighlight &&
            highlightedLane === "develop" && { filter: "url(#glow)" })}
        />
        <text
          x={15}
          y={DEVELOP_Y + 5}
          fill={BRANCH_TYPE_COLORS.develop}
          fontSize={13}
          fontFamily="var(--font-mono)"
          fontWeight={
            hasHighlight && highlightedLane === "develop" ? "bold" : "normal"
          }
        >
          develop
        </text>
        {DEVELOP_COMMITS.map((cx) => (
          <circle
            key={cx}
            cx={cx}
            cy={DEVELOP_Y}
            r={hasHighlight && highlightedLane === "develop" ? 5 : 4}
            fill={BRANCH_TYPE_COLORS.develop}
          />
        ))}
      </g>

      {/* === SHORT-LIVED BRANCH ARCS === */}

      {/* Flow curves with arrowheads */}
      {FLOW_CURVES.map((curve, i) => (
        <path
          key={i}
          d={curve.path}
          fill="none"
          stroke={BRANCH_TYPE_COLORS[curve.type]}
          strokeWidth={getStrokeWidth(curve.type, 2)}
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={`url(#${curve.markerId})`}
          opacity={getOpacity(curve.type)}
          {...(hasHighlight &&
            highlightedLane === curve.type && { filter: "url(#glow)" })}
        />
      ))}

      {/* Feature arc commit dots */}
      <g opacity={getOpacity("feature")}>
        {FEATURE_COMMITS.map((cx) => (
          <circle
            key={cx}
            cx={cx}
            cy={FEATURE_ARC_Y}
            r={hasHighlight && highlightedLane === "feature" ? 5 : 4}
            fill={BRANCH_TYPE_COLORS.feature}
          />
        ))}
        <text
          x={(FEATURE_BRANCH_X + FEATURE_MERGE_X) / 2}
          y={FEATURE_ARC_Y + 22}
          fill={BRANCH_TYPE_COLORS.feature}
          fontSize={11}
          fontFamily="var(--font-mono)"
          textAnchor="middle"
          fontWeight={
            hasHighlight && highlightedLane === "feature" ? "bold" : "normal"
          }
        >
          feature/*
        </text>
      </g>

      {/* Release arc commit dots */}
      <g opacity={getOpacity("release")}>
        {RELEASE_COMMITS.map((cx) => (
          <circle
            key={cx}
            cx={cx}
            cy={RELEASE_ARC_Y}
            r={hasHighlight && highlightedLane === "release" ? 5 : 4}
            fill={BRANCH_TYPE_COLORS.release}
          />
        ))}
        <text
          x={(RELEASE_BRANCH_X + RELEASE_MERGE_MAIN_X) / 2 + 10}
          y={RELEASE_ARC_Y - 14}
          fill={BRANCH_TYPE_COLORS.release}
          fontSize={11}
          fontFamily="var(--font-mono)"
          textAnchor="middle"
          fontWeight={
            hasHighlight && highlightedLane === "release" ? "bold" : "normal"
          }
        >
          release/*
        </text>
      </g>

      {/* Hotfix arc commit dots */}
      <g opacity={getOpacity("hotfix")}>
        {HOTFIX_COMMITS.map((cx) => (
          <circle
            key={cx}
            cx={cx}
            cy={HOTFIX_ARC_Y}
            r={hasHighlight && highlightedLane === "hotfix" ? 5 : 4}
            fill={BRANCH_TYPE_COLORS.hotfix}
          />
        ))}
        <text
          x={(HOTFIX_BRANCH_X + HOTFIX_MERGE_MAIN_X) / 2 + 10}
          y={HOTFIX_ARC_Y - 14}
          fill={BRANCH_TYPE_COLORS.hotfix}
          fontSize={11}
          fontFamily="var(--font-mono)"
          textAnchor="middle"
          fontWeight={
            hasHighlight && highlightedLane === "hotfix" ? "bold" : "normal"
          }
        >
          hotfix/*
        </text>
      </g>

      {/* === VERSION LABELS ON MAIN === */}
      {VERSION_LABELS.map(({ x, label }) => (
        <g key={label} opacity={getOpacity("main")}>
          <rect
            x={x - 18}
            y={MAIN_Y - 26}
            width={36}
            height={16}
            rx={3}
            fill="var(--catppuccin-color-surface0)"
            stroke={BRANCH_TYPE_COLORS.main}
            strokeWidth={1}
          />
          <text
            x={x}
            y={MAIN_Y - 15}
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
            cx={800}
            cy={INDICATOR_Y[highlightedLane]}
            r={10}
            fill={BRANCH_TYPE_COLORS[highlightedLane]}
            opacity={0.25}
          />
          {/* Inner dot */}
          <circle
            cx={800}
            cy={INDICATOR_Y[highlightedLane]}
            r={5}
            fill={BRANCH_TYPE_COLORS[highlightedLane]}
          />
          {/* Label */}
          <text
            x={800}
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
