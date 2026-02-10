import { useQuery } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { commands } from "../../bindings";
import type { RepoFileEntry } from "../../bindings";
import { bladeTypeForFile } from "../../lib/fileDispatch";
import { getBladeRegistration } from "../../lib/bladeRegistry";
import { useBladeNavigation } from "../../hooks/useBladeNavigation";
import { FileTypeIcon } from "../../components/icons/FileTypeIcon";
import { BladeContentLoading } from "../_shared/BladeContentLoading";
import { BladeContentError } from "../_shared/BladeContentError";
import { BladeContentEmpty } from "../_shared/BladeContentEmpty";

interface RepoBrowserBladeProps {
  path?: string;
}

export function RepoBrowserBlade({ path = "" }: RepoBrowserBladeProps) {
  const { pushBlade, replaceBlade } = useBladeNavigation();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const {
    data: entries,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["repoFiles", path],
    queryFn: async () => {
      const result = await commands.listRepoFiles(path);
      if (result.status === "ok") {
        return result.data;
      }
      throw new Error("Failed to load directory contents");
    },
    staleTime: 30_000,
  });

  // Reset focus when path changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [path]);

  // Focus the item when focusedIndex changes
  useEffect(() => {
    itemRefs.current[focusedIndex]?.focus();
  }, [focusedIndex, entries]);

  const navigateToDirectory = useCallback(
    (dirPath: string) => {
      replaceBlade({
        type: "repo-browser",
        title: dirPath.split("/").pop() || "Repository Browser",
        props: { path: dirPath },
      });
    },
    [replaceBlade],
  );

  const openFile = useCallback(
    (entry: RepoFileEntry) => {
      if (entry.isDir) {
        navigateToDirectory(entry.path);
        return;
      }

      const dispatched = bladeTypeForFile(entry.path, "browse");
      const title = entry.name;
      // Fall back to viewer-plaintext if the dispatched blade type is not registered
      // (e.g., content-viewers extension is disabled)
      const bladeType = getBladeRegistration(dispatched) ? dispatched : "viewer-plaintext";
      pushBlade({ type: bladeType, title, props: { filePath: entry.path } });
    },
    [pushBlade, navigateToDirectory],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!entries || entries.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((i) => Math.min(i + 1, entries.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setFocusedIndex(entries.length - 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (entries[focusedIndex]) {
            openFile(entries[focusedIndex]);
          }
          break;
        case "Backspace":
          e.preventDefault();
          if (path) {
            const parentPath = path.includes("/")
              ? path.substring(0, path.lastIndexOf("/"))
              : "";
            navigateToDirectory(parentPath);
          }
          break;
      }
    },
    [entries, focusedIndex, openFile, path, navigateToDirectory],
  );

  if (isLoading) {
    return <BladeContentLoading />;
  }

  if (error) {
    return (
      <BladeContentError
        message="Could not load repository contents"
        detail={error instanceof Error ? error.message : String(error)}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {!entries || entries.length === 0 ? (
        <BladeContentEmpty
          icon={FolderOpen}
          message="This directory is empty"
        />
      ) : (
        <div
          role="listbox"
          aria-label={`Files in ${path || "repository root"}`}
          className="flex-1 overflow-y-auto"
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {entries.map((entry, index) => (
            <FileRow
              key={entry.path}
              entry={entry}
              isFocused={index === focusedIndex}
              onClick={() => openFile(entry)}
              onFocus={() => setFocusedIndex(index)}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- FileRow ---

interface FileRowProps {
  entry: RepoFileEntry;
  isFocused: boolean;
  onClick: () => void;
  onFocus: () => void;
}

const FileRow = forwardRef<HTMLButtonElement, FileRowProps>(
  function FileRow({ entry, isFocused, onClick, onFocus }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={false}
        onClick={onClick}
        onFocus={onFocus}
        tabIndex={isFocused ? 0 : -1}
        className={`
          w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-sm
          hover:bg-ctp-surface0/50 transition-colors
          focus:bg-ctp-surface0/50 focus:outline-none focus:ring-1 focus:ring-ctp-blue/50 focus:ring-inset
          ${isFocused ? "bg-ctp-surface0/30" : ""}
        `}
      >
        <FileTypeIcon
          path={entry.name}
          isDirectory={entry.isDir}
        />
        <span className="flex-1 truncate text-ctp-text">
          {entry.name}
          {entry.isDir && (
            <span className="text-ctp-overlay0">/</span>
          )}
        </span>
        {!entry.isDir && entry.size > 0 && (
          <span className="text-xs text-ctp-overlay0 tabular-nums shrink-0">
            {formatFileSize(entry.size)}
          </span>
        )}
      </button>
    );
  },
);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
