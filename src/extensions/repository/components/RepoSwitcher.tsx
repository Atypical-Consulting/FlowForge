import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, FolderGit } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRecentRepos } from "../../../core/hooks/useRecentRepos";
import { cn } from "../../../core/lib/utils";
import { usePreferencesStore as useNavigationStore } from "../../../core/stores/domain/preferences";
import { useGitOpsStore as useRepositoryStore } from "../../../core/stores/domain/git-ops";
import { RepoSwitcherItem, type RepoItemData } from "./RepoSwitcherItem";

const slideDown = {
  hidden: { opacity: 0, y: -8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.1, ease: "easeIn" as const },
  },
};

interface RepoSwitcherProps {
  onSelectRepo: (path: string) => void;
}

export function RepoSwitcher({ onSelectRepo }: RepoSwitcherProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const status = useRepositoryStore((s) => s.repoStatus);
  const {
    navRepoDropdownOpen: isOpen,
    toggleNavRepoDropdown: toggleRepoDropdown,
    closeNavPanels: closePanels,
    navPinnedRepoPaths: pinnedRepoPaths,
    pinRepo,
    unpinRepo,
    isRepoPinned: isPinned,
  } = useNavigationStore();

  const { recentRepos, refresh: refreshRecentRepos } = useRecentRepos();

  const currentPath = status?.repoPath ?? "";
  const currentName = status?.repoName ?? "No repo";

  // Build pinned repos list (exclude current)
  const pinnedRepos: RepoItemData[] = useMemo(() => {
    return pinnedRepoPaths
      .filter((p) => p !== currentPath)
      .map((path) => ({
        path,
        name: path.split(/[/\\]/).filter(Boolean).pop() || path,
      }));
  }, [pinnedRepoPaths, currentPath]);

  // Build recent repos list (exclude current and pinned)
  const recentRepoItems: RepoItemData[] = useMemo(() => {
    const pinnedSet = new Set(pinnedRepoPaths);
    return recentRepos
      .filter((r) => r.path !== currentPath && !pinnedSet.has(r.path))
      .slice(0, 5)
      .map((r) => ({ path: r.path, name: r.name }));
  }, [recentRepos, currentPath, pinnedRepoPaths]);

  // Combined flat list for keyboard navigation
  const allItems = useMemo(
    () => [...pinnedRepos, ...recentRepoItems],
    [pinnedRepos, recentRepoItems],
  );

  // Reset highlight and refresh recent repos when panel opens
  useEffect(() => {
    setHighlightedIndex(-1);
    if (isOpen) {
      refreshRecentRepos();
    }
  }, [isOpen, refreshRecentRepos]);

  // Click-outside dismissal — use "click" (not "mousedown") so React
  // has time to reconcile the DOM before we check `contains`. This
  // prevents the dropdown from closing when an internal action (pin,
  // select) causes a re-render that removes the event target node.
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closePanels();
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen, closePanels]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleRepoDropdown();
        }
        return;
      }

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          closePanels();
          break;
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i + 1, allItems.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && allItems[highlightedIndex]) {
            onSelectRepo(allItems[highlightedIndex].path);
            closePanels();
          }
          break;
      }
    },
    [
      isOpen,
      allItems,
      highlightedIndex,
      toggleRepoDropdown,
      closePanels,
      onSelectRepo,
    ],
  );

  const handleSelectRepo = useCallback(
    (path: string) => {
      onSelectRepo(path);
      closePanels();
    },
    [onSelectRepo, closePanels],
  );

  const handleTogglePin = useCallback(
    (path: string) => {
      if (isPinned(path)) {
        unpinRepo(path);
      } else {
        pinRepo(path);
      }
    },
    [isPinned, pinRepo, unpinRepo],
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleRepoDropdown}
        onKeyDown={handleKeyDown}
        className={cn(
          "group flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors",
          "hover:bg-ctp-surface0",
          isOpen && "bg-ctp-surface0",
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Repository: ${currentName}`}
      >
        <FolderGit className="w-4 h-4 text-ctp-subtext0" />
        <span className="text-sm text-ctp-subtext1 font-medium">
          {currentName}
        </span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-ctp-overlay0 transition-all",
            "opacity-0 group-hover:opacity-100",
            isOpen && "opacity-100 rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={slideDown}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute top-full left-0 z-40 mt-1 w-full min-w-[320px] max-w-100 bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-lg"
            role="listbox"
            aria-label="Repository list"
          >
            <div className="max-h-100 overflow-y-auto p-1">
              {pinnedRepos.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-ctp-overlay0 uppercase tracking-wider">
                    Pinned
                  </div>
                  {pinnedRepos.map((repo, idx) => (
                    <RepoSwitcherItem
                      key={repo.path}
                      repo={repo}
                      isPinned={true}
                      isCurrent={repo.path === currentPath}
                      isHighlighted={highlightedIndex === idx}
                      onSelect={() => handleSelectRepo(repo.path)}
                      onTogglePin={() => handleTogglePin(repo.path)}
                    />
                  ))}
                </div>
              )}

              {pinnedRepos.length > 0 && recentRepoItems.length > 0 && (
                <div className="mx-2 my-1 border-t border-ctp-surface0" />
              )}

              {recentRepoItems.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-ctp-overlay0 uppercase tracking-wider">
                    Recent
                  </div>
                  {recentRepoItems.map((repo, idx) => (
                    <RepoSwitcherItem
                      key={repo.path}
                      repo={repo}
                      isPinned={false}
                      isCurrent={repo.path === currentPath}
                      isHighlighted={
                        highlightedIndex === pinnedRepos.length + idx
                      }
                      onSelect={() => handleSelectRepo(repo.path)}
                      onTogglePin={() => handleTogglePin(repo.path)}
                    />
                  ))}
                </div>
              )}

              {pinnedRepos.length === 0 && recentRepoItems.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-ctp-overlay0">
                  No other repositories.
                  <br />
                  <span className="text-xs">
                    Open a repository to see it here.
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
