import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Home } from "lucide-react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { commands } from "../../bindings";
import type { RepoFileEntry } from "../../bindings";
import { bladeTypeForFile } from "../../lib/fileDispatch";
import { useBladeStore } from "../../stores/blades";
import { FileTypeIcon } from "../icons/FileTypeIcon";
import { BladeContentLoading } from "./BladeContentLoading";
import { BladeContentError } from "./BladeContentError";
import { BladeContentEmpty } from "./BladeContentEmpty";
import { BladeToolbar } from "./BladeToolbar";

interface RepoBrowserBladeProps {
  path?: string;
}

export function RepoBrowserBlade({ path = "" }: RepoBrowserBladeProps) {
  const store = useBladeStore();
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
      store.replaceBlade({
        type: "repo-browser",
        title: dirPath.split("/").pop() || "Repository Browser",
        props: { path: dirPath },
      });
    },
    [store],
  );

  const openFile = useCallback(
    (entry: RepoFileEntry) => {
      if (entry.isDir) {
        navigateToDirectory(entry.path);
        return;
      }

      const bladeType = bladeTypeForFile(entry.path, "browse");
      const title = entry.name;

      if (bladeType === "viewer-image") {
        store.pushBlade({ type: "viewer-image", title, props: { filePath: entry.path } });
      } else if (bladeType === "viewer-markdown") {
        store.pushBlade({ type: "viewer-markdown", title, props: { filePath: entry.path } });
      } else if (bladeType === "viewer-3d") {
        store.pushBlade({ type: "viewer-3d", title, props: { filePath: entry.path } });
      } else if (bladeType === "viewer-nupkg") {
        store.pushBlade({ type: "viewer-nupkg", title, props: { filePath: entry.path } });
      } else {
        // viewer-code is the default for browse context
        store.pushBlade({ type: "viewer-code", title, props: { filePath: entry.path } });
      }
    },
    [store, navigateToDirectory],
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
      <BladeToolbar>
        <Breadcrumbs path={path} onNavigate={navigateToDirectory} />
      </BladeToolbar>

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

// --- Breadcrumbs ---

interface BreadcrumbsProps {
  path: string;
  onNavigate: (path: string) => void;
}

function Breadcrumbs({ path, onNavigate }: BreadcrumbsProps) {
  const segments = path ? path.split("/").filter(Boolean) : [];

  return (
    <nav aria-label="Repository path" className="flex-1 min-w-0">
      <ol className="flex items-center gap-1 text-sm overflow-x-auto scrollbar-none">
        <li>
          {segments.length === 0 ? (
            <span
              className="flex items-center gap-1 font-medium text-ctp-text"
              aria-current="page"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="sr-only">Repository root</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate("")}
              className="flex items-center gap-1 text-ctp-overlay1 hover:text-ctp-text hover:underline"
              aria-label="Repository root"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
          )}
        </li>

        {segments.map((segment, index) => {
          const segmentPath = segments.slice(0, index + 1).join("/");
          const isLast = index === segments.length - 1;

          return (
            <li key={segmentPath} className="flex items-center gap-1">
              <span aria-hidden="true" className="text-ctp-overlay0">
                /
              </span>
              {isLast ? (
                <span
                  className="font-medium text-ctp-text truncate"
                  aria-current="page"
                >
                  {segment}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(segmentPath)}
                  className="text-ctp-overlay1 hover:text-ctp-text hover:underline truncate"
                >
                  {segment}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
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
