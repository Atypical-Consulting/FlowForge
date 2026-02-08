import type { GitflowBranchType } from "../../lib/branchClassifier";
import { BRANCH_TYPE_COLORS } from "../../lib/branchClassifier";

interface GitflowDiagramProps {
  /** Which lane to highlight. undefined = no highlight. */
  highlightedLane?: GitflowBranchType;
}

const LANE_Y: Record<string, number> = {
  hotfix: 60,
  release: 130,
  main: 200,
  develop: 270,
  feature: 340,
};

const LANE_LABELS: Record<string, string> = {
  main: "main",
  develop: "develop",
  feature: "feature/*",
  release: "release/*",
  hotfix: "hotfix/*",
};

// Per-lane commit positions — long-lived branches get more dots
const LANE_COMMITS: Record<string, number[]> = {
  main: [200, 350, 500, 650],
  develop: [200, 300, 450, 600, 700],
  feature: [350, 450, 500],
  release: [400, 500, 550],
  hotfix: [450, 550],
};

interface FlowCurve {
  from: GitflowBranchType; // lane the curve relates to for highlighting
  path: string; // SVG cubic bezier path
  color: string; // from BRANCH_TYPE_COLORS
  startX: number;
  startY: number; // for connection dot
  endX: number;
  endY: number; // for connection dot
}

const FLOW_CURVES: FlowCurve[] = [
  // Feature branch-out (develop -> feature)
  {
    from: "feature",
    path: "M 300 270 C 300 305, 350 305, 350 340",
    color: BRANCH_TYPE_COLORS.feature,
    startX: 300,
    startY: 270,
    endX: 350,
    endY: 340,
  },
  // Feature merge-back (feature -> develop)
  {
    from: "feature",
    path: "M 500 340 C 500 305, 600 305, 600 270",
    color: BRANCH_TYPE_COLORS.feature,
    startX: 500,
    startY: 340,
    endX: 600,
    endY: 270,
  },
  // Release branch-out (develop -> release)
  {
    from: "release",
    path: "M 450 270 C 450 200, 400 200, 400 130",
    color: BRANCH_TYPE_COLORS.release,
    startX: 450,
    startY: 270,
    endX: 400,
    endY: 130,
  },
  // Release merge to main
  {
    from: "release",
    path: "M 550 130 C 550 165, 500 165, 500 200",
    color: BRANCH_TYPE_COLORS.release,
    startX: 550,
    startY: 130,
    endX: 500,
    endY: 200,
  },
  // Release merge back to develop
  {
    from: "release",
    path: "M 550 130 C 550 200, 600 200, 600 270",
    color: BRANCH_TYPE_COLORS.release,
    startX: 550,
    startY: 130,
    endX: 600,
    endY: 270,
  },
  // Hotfix branch-out (main -> hotfix)
  {
    from: "hotfix",
    path: "M 350 200 C 350 130, 450 130, 450 60",
    color: BRANCH_TYPE_COLORS.hotfix,
    startX: 350,
    startY: 200,
    endX: 450,
    endY: 60,
  },
  // Hotfix merge to main
  {
    from: "hotfix",
    path: "M 550 60 C 550 130, 650 130, 650 200",
    color: BRANCH_TYPE_COLORS.hotfix,
    startX: 550,
    startY: 60,
    endX: 650,
    endY: 200,
  },
  // Hotfix merge to develop
  {
    from: "hotfix",
    path: "M 550 60 C 550 165, 700 165, 700 270",
    color: BRANCH_TYPE_COLORS.hotfix,
    startX: 550,
    startY: 60,
    endX: 700,
    endY: 270,
  },
];

/**
 * Gitflow branching workflow diagram rendered as inline SVG.
 * Uses Catppuccin CSS variable colors for branch lanes.
 * The highlighted lane gets full opacity, wider stroke, and a glow effect.
 */
export function GitflowDiagram({ highlightedLane }: GitflowDiagramProps) {
  const laneOrder: GitflowBranchType[] = [
    "hotfix",
    "release",
    "main",
    "develop",
    "feature",
  ];

  const hasHighlight =
    highlightedLane !== undefined && highlightedLane !== "other";

  return (
    <svg
      viewBox="0 0 800 400"
      className="w-full h-auto"
      role="img"
      aria-label="Gitflow branching workflow diagram"
    >
      {/* Background */}
      <rect
        width="800"
        height="400"
        fill="var(--catppuccin-color-mantle)"
        rx="8"
      />

      {/* Glow filter for active lane */}
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Lane lines, labels, and commit dots */}
      {laneOrder.map((lane) => {
        const isActive = hasHighlight && highlightedLane === lane;
        const color = BRANCH_TYPE_COLORS[lane];
        const y = LANE_Y[lane];
        const laneOpacity = isActive ? 1 : 0.7;

        return (
          <g key={lane} opacity={laneOpacity}>
            {/* Lane line */}
            <line
              x1={120}
              y1={y}
              x2={750}
              y2={y}
              stroke={color}
              strokeWidth={isActive ? 3 : 2}
              strokeLinecap="round"
              {...(isActive && { filter: "url(#glow)" })}
            />

            {/* Lane label */}
            <text
              x={15}
              y={y + 4}
              fill={color}
              fontSize={12}
              fontFamily="var(--font-mono)"
              fontWeight={isActive ? "bold" : "normal"}
            >
              {LANE_LABELS[lane]}
            </text>

            {/* Per-lane commit dots */}
            {LANE_COMMITS[lane].map((cx) => (
              <circle
                key={cx}
                cx={cx}
                cy={y}
                r={isActive ? 5 : 4}
                fill={color}
              />
            ))}
          </g>
        );
      })}

      {/* Flow curves with connection dots */}
      {FLOW_CURVES.map((curve, i) => {
        const isActive = hasHighlight && highlightedLane === curve.from;
        const curveOpacity = isActive ? 0.9 : 0.55;

        return (
          <g key={i} opacity={curveOpacity}>
            {/* Curve path */}
            <path
              d={curve.path}
              fill="none"
              stroke={curve.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Connection dot at start */}
            <circle
              cx={curve.startX}
              cy={curve.startY}
              r={3}
              fill={curve.color}
            />

            {/* Connection dot at end */}
            <circle
              cx={curve.endX}
              cy={curve.endY}
              r={3}
              fill={curve.color}
            />
          </g>
        );
      })}

      {/* "You are here" indicator */}
      {hasHighlight && (
        <g className="motion-safe:animate-gentle-pulse">
          {/* Outer glow circle */}
          <circle
            cx={740}
            cy={LANE_Y[highlightedLane]}
            r={10}
            fill={BRANCH_TYPE_COLORS[highlightedLane]}
            opacity={0.25}
          />
          {/* Inner dot */}
          <circle
            cx={740}
            cy={LANE_Y[highlightedLane]}
            r={5}
            fill={BRANCH_TYPE_COLORS[highlightedLane]}
          />
          {/* Label */}
          <text
            x={740}
            y={LANE_Y[highlightedLane] - 18}
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
