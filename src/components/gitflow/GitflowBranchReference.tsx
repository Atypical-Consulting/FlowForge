import type { GitflowBranchType } from "../../lib/branchClassifier";
import { BRANCH_TYPE_COLORS } from "../../lib/branchClassifier";

interface BranchTypeInfo {
  type: GitflowBranchType;
  name: string;
  description: string;
  naming: string;
  branchesFrom: string;
  mergesTo: string;
  workflow: string;
}

const BRANCH_TYPES: BranchTypeInfo[] = [
  {
    type: "main",
    name: "Main (Production)",
    description:
      "Always reflects the current production-ready state. Every commit on main is a release.",
    naming: "main or master",
    branchesFrom: "\u2014",
    mergesTo: "\u2014",
    workflow:
      "Never commit directly. Receives merges from release and hotfix branches only.",
  },
  {
    type: "develop",
    name: "Develop (Integration)",
    description:
      "Integration branch for features. Contains the latest development changes for the next release.",
    naming: "develop",
    branchesFrom: "main (initial setup)",
    mergesTo: "\u2014",
    workflow:
      "Receives completed features. Used as the base for release and feature branches.",
  },
  {
    type: "feature",
    name: "Feature Branches",
    description:
      "Short-lived branches for developing individual features or enhancements.",
    naming: "feature/<descriptive-name>",
    branchesFrom: "develop",
    mergesTo: "develop",
    workflow:
      "Create from develop, implement the feature, then merge back into develop when complete.",
  },
  {
    type: "release",
    name: "Release Branches",
    description:
      "Preparation branches for a new production release. Allows final bug fixes and version bumping.",
    naming: "release/<version>",
    branchesFrom: "develop",
    mergesTo: "main and develop",
    workflow:
      "Create from develop when ready to release. Fix last-minute issues, bump version, then merge into both main and develop.",
  },
  {
    type: "hotfix",
    name: "Hotfix Branches",
    description:
      "Emergency fix branches created from main to address critical production issues.",
    naming: "hotfix/<name>",
    branchesFrom: "main",
    mergesTo: "main and develop",
    workflow:
      "Create from main, apply the fix, then merge into both main (for immediate deployment) and develop (to include the fix in future releases).",
  },
];

interface GitflowBranchReferenceProps {
  currentBranchType: GitflowBranchType;
}

export function GitflowBranchReference({
  currentBranchType,
}: GitflowBranchReferenceProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ctp-subtext1">
        Branch type reference
      </h3>
      {BRANCH_TYPES.map((info) => {
        const isCurrent = info.type === currentBranchType;
        const color = BRANCH_TYPE_COLORS[info.type];

        return (
          <div
            key={info.type}
            className={`
              border rounded-lg p-4 transition-colors
              ${
                isCurrent
                  ? "bg-ctp-surface0/30"
                  : "border-ctp-surface1 bg-ctp-surface0/20"
              }
            `}
            style={isCurrent ? { borderColor: color } : undefined}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <h4 className={`text-sm font-semibold ${isCurrent ? "text-ctp-text" : "text-ctp-subtext1"}`}>
                {info.name}
              </h4>
              {isCurrent && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${color}33`, color }}
                >
                  You are here
                </span>
              )}
            </div>
            <p className="text-xs text-ctp-subtext0 mb-2">{info.description}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>
                <span className="text-ctp-overlay0">Naming: </span>
                <code className="text-ctp-peach font-mono">{info.naming}</code>
              </div>
              <div>
                <span className="text-ctp-overlay0">Branches from: </span>
                <span className="text-ctp-subtext1">{info.branchesFrom}</span>
              </div>
              <div>
                <span className="text-ctp-overlay0">Merges to: </span>
                <span className="text-ctp-subtext1">{info.mergesTo}</span>
              </div>
              <div>
                <span className="text-ctp-overlay0">Workflow: </span>
                <span className="text-ctp-subtext1">{info.workflow}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
