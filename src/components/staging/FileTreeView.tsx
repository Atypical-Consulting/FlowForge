import { ChevronDown, ChevronRight } from "lucide-react";
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

interface FileTreeViewProps {
  files: FileChange[];
  section: "staged" | "unstaged" | "untracked";
  filter?: string;
}

export function FileTreeView({
  files,
  section,
  filter = "",
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
        <TreeNode key={node.path} node={node} section={section} depth={0} />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: FileTreeNode;
  section: "staged" | "unstaged" | "untracked";
  depth: number;
}

// Indent guide component
function IndentGuides({ depth }: { depth: number }) {
  return (
    <>
      {Array.from({ length: depth }).map((_, i) => (
        <div
          key={i}
          className="absolute h-full w-px bg-ctp-surface1"
          style={{ left: `${i * 12 + 14}px` }}
        />
      ))}
    </>
  );
}

function TreeNode({ node, section, depth }: TreeNodeProps) {
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
        />
      </div>
    );
  }

  const childNodes = Array.from(node.children.values());

  return (
    <div>
      <div className="relative">
        <IndentGuides depth={depth} />
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 px-2 py-1 cursor-pointer",
            "hover:bg-ctp-surface0/50 text-sm text-ctp-subtext0 w-full text-left",
          )}
          onClick={() => setExpanded(!expanded)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <FileTypeIcon path={node.path} isDirectory isOpen={expanded} />
          <span>{node.name}</span>
        </button>
      </div>
      {expanded && (
        <div>
          {childNodes.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              section={section}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
