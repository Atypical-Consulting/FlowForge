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

  return (
    <svg
      viewBox="0 0 800 400"
      className="w-full h-auto"
      role="img"
      aria-label="Gitflow branching workflow diagram"
    >
      {/* Background */}
      <rect width="800" height="400" fill="var(--ctp-mantle)" rx="8" />

      {/* Lane lines and labels */}
      {laneOrder.map((lane) => {
        const isActive = highlightedLane === lane;
        const color = BRANCH_TYPE_COLORS[lane];
        const y = LANE_Y[lane];

        return (
          <g key={lane} opacity={isActive ? 1 : 0.4}>
            {/* Lane line */}
            <line
              x1={120}
              y1={y}
              x2={750}
              y2={y}
              stroke={color}
              strokeWidth={isActive ? 3 : 2}
              strokeLinecap="round"
              {...(isActive && {
                filter: "url(#glow)",
              })}
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

            {/* Example commit dots */}
            {[200, 350, 500, 650].map((cx) => (
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

      {/* Branch/merge arrows (simplified illustration) */}
      {/* Feature branches from develop */}
      <path
        d="M 250 270 Q 250 305 300 340"
        fill="none"
        stroke={BRANCH_TYPE_COLORS.feature}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        opacity={highlightedLane === "feature" ? 0.8 : 0.3}
      />
      <path
        d="M 550 340 Q 600 305 600 270"
        fill="none"
        stroke={BRANCH_TYPE_COLORS.feature}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        opacity={highlightedLane === "feature" ? 0.8 : 0.3}
      />

      {/* Release branches from develop, merge to main and develop */}
      <path
        d="M 350 270 Q 350 200 400 130"
        fill="none"
        stroke={BRANCH_TYPE_COLORS.release}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        opacity={highlightedLane === "release" ? 0.8 : 0.3}
      />
      <path
        d="M 550 130 Q 575 165 575 200"
        fill="none"
        stroke={BRANCH_TYPE_COLORS.release}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        opacity={highlightedLane === "release" ? 0.8 : 0.3}
      />

      {/* Hotfix branches from main, merge to main and develop */}
      <path
        d="M 400 200 Q 400 130 450 60"
        fill="none"
        stroke={BRANCH_TYPE_COLORS.hotfix}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        opacity={highlightedLane === "hotfix" ? 0.8 : 0.3}
      />
      <path
        d="M 600 60 Q 625 130 625 200"
        fill="none"
        stroke={BRANCH_TYPE_COLORS.hotfix}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        opacity={highlightedLane === "hotfix" ? 0.8 : 0.3}
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

      {/* "You are here" indicator */}
      {highlightedLane && highlightedLane !== "other" && (
        <g className="motion-safe:animate-gentle-pulse">
          {/* Outer glow circle */}
          <circle
            cx={700}
            cy={LANE_Y[highlightedLane]}
            r={10}
            fill={BRANCH_TYPE_COLORS[highlightedLane]}
            opacity={0.25}
          />
          {/* Inner dot */}
          <circle
            cx={700}
            cy={LANE_Y[highlightedLane]}
            r={5}
            fill={BRANCH_TYPE_COLORS[highlightedLane]}
          />
          {/* Label */}
          <text
            x={700}
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
