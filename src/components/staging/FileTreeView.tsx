import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { useMemo, useState } from "react";
import type { FileChange } from "../../bindings";
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
}

export function FileTreeView({ files, section }: FileTreeViewProps) {
  const tree = useMemo(() => {
    const root: FileTreeNode = {
      name: "",
      path: "",
      isDirectory: true,
      children: new Map(),
    };

    for (const file of files) {
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
  }, [files]);

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

function TreeNode({ node, section, depth }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);

  if (!node.isDirectory && node.file) {
    return (
      <FileItem
        file={node.file}
        section={section}
        depth={depth}
        showFilenameOnly
      />
    );
  }

  const childNodes = Array.from(node.children.values());

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-800/30 text-sm text-gray-400 w-full text-left"
        onClick={() => setExpanded(!expanded)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <Folder className="w-4 h-4 text-blue-400" />
        <span>{node.name}</span>
      </button>
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
