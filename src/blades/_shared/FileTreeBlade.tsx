import { FolderOpen, List, Search, TreePine } from "lucide-react";
import { useMemo, useState } from "react";
import type { FileChanged } from "../../bindings";
import { cn } from "../../lib/utils";

interface FileTreeBladeProps {
  files: FileChanged[];
  onSelectFile: (filePath: string) => void;
  selectedFile?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  Added: { label: "A", color: "text-ctp-green" },
  added: { label: "A", color: "text-ctp-green" },
  Modified: { label: "M", color: "text-ctp-yellow" },
  modified: { label: "M", color: "text-ctp-yellow" },
  Deleted: { label: "D", color: "text-ctp-red" },
  deleted: { label: "D", color: "text-ctp-red" },
  Renamed: { label: "R", color: "text-ctp-blue" },
  renamed: { label: "R", color: "text-ctp-blue" },
  Copied: { label: "C", color: "text-ctp-teal" },
  copied: { label: "C", color: "text-ctp-teal" },
};

function getStatusInfo(status: string) {
  return STATUS_MAP[status] || { label: "?", color: "text-ctp-overlay0" };
}

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  file?: FileChanged;
}

function buildTree(files: FileChanged[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: new Map() };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          children: new Map(),
          file: isFile ? file : undefined,
        });
      } else if (isFile) {
        current.children.get(part)!.file = file;
      }

      current = current.children.get(part)!;
    }
  }

  return root;
}

function StatsBar({ additions, deletions }: { additions: number; deletions: number }) {
  const total = additions + deletions;
  if (total === 0) return null;

  const addPct = (additions / total) * 100;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-xs text-ctp-green">+{additions}</span>
      <span className="text-xs text-ctp-red">-{deletions}</span>
      <div className="w-16 h-2 rounded-full overflow-hidden flex bg-ctp-surface0">
        <div
          className="bg-ctp-green h-full"
          style={{ width: `${addPct}%` }}
        />
        <div
          className="bg-ctp-red h-full"
          style={{ width: `${100 - addPct}%` }}
        />
      </div>
    </div>
  );
}

function FileRow({
  file,
  onSelect,
  isSelected,
}: {
  file: FileChanged;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const statusInfo = getStatusInfo(file.status);
  const fileName = file.path.split("/").pop() || file.path;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2 text-sm py-1.5 px-3 hover:bg-ctp-surface0/50 cursor-pointer rounded-sm text-left",
        isSelected && "bg-ctp-surface0 ring-1 ring-ctp-blue/30",
      )}
    >
      <span className={cn("w-4 text-center text-xs font-mono shrink-0", statusInfo.color)}>
        {statusInfo.label}
      </span>
      <span className="text-ctp-subtext1 truncate flex-1" title={file.path}>
        {fileName}
      </span>
      <StatsBar additions={file.additions} deletions={file.deletions} />
    </button>
  );
}

function TreeView({
  node,
  onSelectFile,
  selectedFile,
  depth,
}: {
  node: TreeNode;
  onSelectFile: (path: string) => void;
  selectedFile?: string;
  depth: number;
}) {
  const folders: TreeNode[] = [];
  const files: TreeNode[] = [];

  for (const child of node.children.values()) {
    if (child.file) {
      files.push(child);
    } else {
      folders.push(child);
    }
  }

  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
      {folders.map((folder) => (
        <details key={folder.path} open>
          <summary className="flex items-center gap-1.5 py-1 px-2 text-sm text-ctp-subtext0 hover:bg-ctp-surface0/30 cursor-pointer rounded-sm select-none">
            <FolderOpen className="w-3.5 h-3.5 text-ctp-overlay1" />
            <span>{folder.name}</span>
            <span className="text-xs text-ctp-overlay0 ml-1">
              ({countFiles(folder)})
            </span>
          </summary>
          <TreeView
            node={folder}
            onSelectFile={onSelectFile}
            selectedFile={selectedFile}
            depth={depth + 1}
          />
        </details>
      ))}
      {files.map((fileNode) => (
        <FileRow
          key={fileNode.path}
          file={fileNode.file!}
          onSelect={() => onSelectFile(fileNode.file!.path)}
          isSelected={selectedFile === fileNode.file!.path}
        />
      ))}
    </div>
  );
}

function countFiles(node: TreeNode): number {
  let count = 0;
  for (const child of node.children.values()) {
    if (child.file) count++;
    else count += countFiles(child);
  }
  return count;
}

export function FileTreeBlade({
  files,
  onSelectFile,
  selectedFile,
}: FileTreeBladeProps) {
  const [viewMode, setViewMode] = useState<"tree" | "flat">("flat");
  const [searchFilter, setSearchFilter] = useState("");

  const filteredFiles = useMemo(() => {
    if (!searchFilter) return files;
    const lower = searchFilter.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(lower));
  }, [files, searchFilter]);

  const tree = useMemo(() => buildTree(filteredFiles), [filteredFiles]);

  const totalAdditions = useMemo(
    () => files.reduce((sum, f) => sum + f.additions, 0),
    [files],
  );
  const totalDeletions = useMemo(
    () => files.reduce((sum, f) => sum + f.deletions, 0),
    [files],
  );

  const sortedFiles = useMemo(
    () => [...filteredFiles].sort((a, b) => a.path.localeCompare(b.path)),
    [filteredFiles],
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Summary */}
      <div className="flex items-center justify-between px-3">
        <span className="text-xs text-ctp-subtext0">
          {files.length} files changed{" "}
          <span className="text-ctp-green">+{totalAdditions}</span>{" "}
          <span className="text-ctp-red">-{totalDeletions}</span>
        </span>
        <div className="flex items-center bg-ctp-surface0 rounded p-0.5">
          <button
            onClick={() => setViewMode("flat")}
            className={cn(
              "p-1 rounded transition-colors",
              viewMode === "flat"
                ? "bg-ctp-surface1 text-ctp-text"
                : "text-ctp-overlay0 hover:text-ctp-subtext1",
            )}
            title="Flat list"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode("tree")}
            className={cn(
              "p-1 rounded transition-colors",
              viewMode === "tree"
                ? "bg-ctp-surface1 text-ctp-text"
                : "text-ctp-overlay0 hover:text-ctp-subtext1",
            )}
            title="Tree view"
          >
            <TreePine className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ctp-overlay0" />
          <input
            type="text"
            placeholder="Filter files..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-ctp-surface0/50 border border-ctp-surface1 rounded text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:ring-1 focus:ring-ctp-blue/50"
          />
        </div>
      </div>

      {/* File list */}
      <div className="overflow-y-auto">
        {viewMode === "flat" ? (
          <div>
            {sortedFiles.map((file) => (
              <FileRow
                key={file.path}
                file={file}
                onSelect={() => onSelectFile(file.path)}
                isSelected={selectedFile === file.path}
              />
            ))}
          </div>
        ) : (
          <TreeView
            node={tree}
            onSelectFile={onSelectFile}
            selectedFile={selectedFile}
            depth={0}
          />
        )}
      </div>
    </div>
  );
}
