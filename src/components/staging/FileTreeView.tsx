import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { FileChange } from "../../bindings";
import { cn } from "../../lib/utils";
import { FileTypeIcon } from "../icons/FileTypeIcon";
import { FileItem } from "./FileItem";

interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: Map<string, FileTreeNode>;
  file?: FileChange;
}

/** Recursively collect all leaf FileChange objects under a tree node. */
function collectAllFiles(node: FileTreeNode): FileChange[] {
  const files: FileChange[] = [];
  if (node.file) files.push(node.file);
  for (const child of node.children.values()) {
    files.push(...collectAllFiles(child));
  }
  return files;
}

interface FileTreeViewProps {
  files: FileChange[];
  section: "staged" | "unstaged" | "untracked";
  filter?: string;
  onFileSelect?: (
    file: FileChange,
    section: "staged" | "unstaged" | "untracked",
  ) => void;
  onStageFolder?: (paths: string[]) => void;
}

export function FileTreeView({
  files,
  section,
  filter = "",
  onFileSelect,
  onStageFolder,
}: FileTreeViewProps) {
  const filteredFiles = useMemo(() => {
    if (!filter) return files;
    const lowerFilter = filter.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(lowerFilter));
  }, [files, filter]);

  const tree = useMemo(() => {
    const root: FileTreeNode = {
      name: "",
      path: "",
      isDirectory: true,
      children: new Map(),
    };

    for (const file of filteredFiles) {
      const parts = file.path.split("/");
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const fullPath = parts.slice(0, i + 1).join("/");

        if (!current.children.has(part)) {
          current.children.set(part, {
            name: part,
            path: fullPath,
            isDirectory: !isLast,
            children: new Map(),
            file: isLast ? file : undefined,
          });
        }
        const next = current.children.get(part);
        if (next) current = next;
      }
    }

    return root;
  }, [filteredFiles]);

  if (filteredFiles.length === 0 && filter) {
    return (
      <div className="px-4 py-2 text-sm text-ctp-overlay0">
        No files matching "{filter}"
      </div>
    );
  }

  return (
    <div className="pl-1">
      {Array.from(tree.children.values()).map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          section={section}
          depth={0}
          onFileSelect={onFileSelect}
          onStageFolder={onStageFolder}
        />
      ))}
    </div>
  );
}

/*
 * Layout geometry:
 *
 * Parent folder row (px-2 gap-1):
 *   [8px pad] [16px chevron] [4px gap] [16px icon] [4px gap] [text...]
 *   Chevron center = 8 + 8 = 16px from left edge
 *
 * To place the vertical guide line under the chevron center:
 *   margin-left on children wrapper = 15px (border at 15.5px ≈ 16px center)
 *
 * The horizontal branch extends from the vertical line rightward.
 * Child content is pushed right by BRANCH_WIDTH, then has its own px-2 (8px).
 * The branch should visually connect the vertical line to the child's first element.
 *
 * Total indent per level = GUIDE_INDENT + BRANCH_WIDTH = 15 + 9 = 24px
 */
const GUIDE_INDENT = 15;
const BRANCH_WIDTH = 9;
const CURVE_RADIUS = 6;
const GUIDE_COLOR = "var(--catppuccin-color-surface1)";

/** Row height center: py-1 (4px) + ~16px content / 2 = 12px from top */
const ROW_CENTER = 12;

interface TreeNodeProps {
  node: FileTreeNode;
  section: "staged" | "unstaged" | "untracked";
  depth: number;
  onFileSelect?: (
    file: FileChange,
    section: "staged" | "unstaged" | "untracked",
  ) => void;
  onStageFolder?: (paths: string[]) => void;
}

function TreeNode({
  node,
  section,
  depth,
  onFileSelect,
  onStageFolder,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);

  // Leaf file node
  if (!node.isDirectory && node.file) {
    return (
      <FileItem
        file={node.file}
        section={section}
        depth={depth}
        showFilenameOnly
        onFileSelect={onFileSelect}
      />
    );
  }

  const childNodes = Array.from(node.children.values());

  const handleStageFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allFiles = collectAllFiles(node);
    onStageFolder?.(allFiles.map((f) => f.path));
  };

  return (
    <div>
      {/* Folder row */}
      <div className="group">
        <div
          role="button"
          tabIndex={0}
          className={cn(
            "flex items-center gap-1 px-2 py-1 cursor-pointer",
            "hover:bg-ctp-surface0/50 text-sm text-ctp-subtext0 w-full text-left",
          )}
          onClick={() => setExpanded(!expanded)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded(!expanded);
            }
          }}
        >
          <span className="w-4 flex items-center justify-center shrink-0">
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
          <span className="w-4 flex items-center justify-center shrink-0">
            <FileTypeIcon path={node.path} isDirectory isOpen={expanded} />
          </span>
          <span className="ml-0.5 flex-1 truncate">{node.name}</span>
          {onStageFolder && (
            <button
              type="button"
              onClick={handleStageFolder}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  const allFiles = collectAllFiles(node);
                  onStageFolder(allFiles.map((f) => f.path));
                }
              }}
              className={cn(
                "p-0.5 rounded transition-all shrink-0",
                "text-ctp-overlay0 opacity-0 group-hover:opacity-100",
                section === "staged"
                  ? "hover:bg-ctp-red/20 hover:text-ctp-red"
                  : "hover:bg-ctp-green/20 hover:text-ctp-green",
              )}
              aria-label={`${section === "staged" ? "Unstage" : "Stage"} all files in ${node.name}`}
              title={
                section === "staged"
                  ? "Unstage all files in folder"
                  : "Stage all files in folder"
              }
            >
              {section === "staged" ? (
                <X className="w-3 h-3" />
              ) : (
                <Check className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Children with indent guide */}
      {expanded && childNodes.length > 0 && (
        <div style={{ marginLeft: `${GUIDE_INDENT}px` }}>
          {childNodes.map((child, index) => {
            const isLastChild = index === childNodes.length - 1;
            return (
              <ConnectorRow key={child.path} isLast={isLastChild}>
                {child.isDirectory ? (
                  <TreeNode
                    node={child}
                    section={section}
                    depth={depth + 1}
                    onFileSelect={onFileSelect}
                    onStageFolder={onStageFolder}
                  />
                ) : child.file ? (
                  <FileItem
                    file={child.file}
                    section={section}
                    depth={0}
                    showFilenameOnly
                    onFileSelect={onFileSelect}
                  />
                ) : null}
              </ConnectorRow>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * ConnectorRow renders tree branch graphics for a single child.
 *
 * Structure:
 *   <div>                     ← border-left for vertical line (non-last only)
 *     <svg/>                  ← connector: ├── or ╰──
 *     <div pl={BRANCH_WIDTH}> ← content pushed right
 *       {children}
 *     </div>
 *   </div>
 *
 * The SVG is positioned absolutely at left: -1px so it overlays the border-left.
 * For last children, border-left is removed and the SVG draws the vertical
 * segment + curve + horizontal branch.
 */
function ConnectorRow({
  isLast,
  children,
}: {
  isLast: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative"
      style={{
        borderLeft: isLast ? "none" : `1px solid ${GUIDE_COLOR}`,
        marginLeft: isLast ? "1px" : "0px",
      }}
    >
      {/* SVG connector */}
      <svg
        className="absolute pointer-events-none"
        style={{
          left: "-1px",
          top: 0,
          width: `${BRANCH_WIDTH + 1}px`,
          height: "100%",
          overflow: "visible",
        }}
        aria-hidden="true"
      >
        {isLast ? (
          /* ╰── curved connector for last child */
          <path
            d={[
              `M 0.5 0`,
              `L 0.5 ${ROW_CENTER - CURVE_RADIUS}`,
              `Q 0.5 ${ROW_CENTER} ${CURVE_RADIUS + 0.5} ${ROW_CENTER}`,
              `L ${BRANCH_WIDTH + 0.5} ${ROW_CENTER}`,
            ].join(" ")}
            fill="none"
            stroke={GUIDE_COLOR}
            strokeWidth="1"
          />
        ) : (
          /* ├── T-connector for non-last child */
          <line
            x1="0.5"
            y1={ROW_CENTER}
            x2={BRANCH_WIDTH + 0.5}
            y2={ROW_CENTER}
            stroke={GUIDE_COLOR}
            strokeWidth="1"
          />
        )}
      </svg>

      {/* Content pushed right past the connector */}
      <div style={{ paddingLeft: `${BRANCH_WIDTH}px` }}>{children}</div>
    </div>
  );
}
