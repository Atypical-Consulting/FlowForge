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
  // Filter files based on search
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
    <div className="pl-2">
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

// Indent guide component — aligned with 16px step
function IndentGuides({ depth }: { depth: number }) {
  return (
    <>
      {Array.from({ length: depth }).map((_, i) => (
        <div
          key={i}
          className="absolute h-full w-px bg-ctp-surface1"
          style={{ left: `${i * 16 + 16}px` }}
        />
      ))}
    </>
  );
}

function TreeNode({
  node,
  section,
  depth,
  onFileSelect,
  onStageFolder,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);

  if (!node.isDirectory && node.file) {
    return (
      <div className="relative">
        <IndentGuides depth={depth} />
        <FileItem
          file={node.file}
          section={section}
          depth={depth}
          showFilenameOnly
          onFileSelect={onFileSelect}
        />
      </div>
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
      <div className="relative group">
        <IndentGuides depth={depth} />
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
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
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
      {expanded && (
        <div>
          {childNodes.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              section={section}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              onStageFolder={onStageFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
