import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Circle, GitBranch } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BranchInfo } from "../../bindings";
import { cn } from "../../lib/utils";
import { useBranchStore } from "../../stores/branches";
import { useNavigationStore } from "../../stores/navigation";
import { useRepositoryStore } from "../../stores/repository";
import { BranchSwitcherItem } from "./BranchSwitcherItem";
import { SwitcherSearch } from "./SwitcherSearch";

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

interface BranchSwitcherProps {
  onSelectBranch: (name: string, isRemote: boolean) => void;
}

export function BranchSwitcher({ onSelectBranch }: BranchSwitcherProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState("");
  const [includeRemote, setIncludeRemote] = useState(false);

  const status = useRepositoryStore((s) => s.status);
  const { allBranches, loadAllBranches } = useBranchStore();
  const {
    branchDropdownOpen: isOpen,
    toggleBranchDropdown,
    closePanels,
    getRecentBranches,
  } = useNavigationStore();

  const currentBranch = status?.branchName ?? "";
  const isDirty = status?.isDirty ?? false;
  const repoPath = status?.repoPath ?? "";

  // Load branches when panel opens
  useEffect(() => {
    if (isOpen) {
      loadAllBranches(includeRemote);
      setSearchQuery("");
      setHighlightedIndex(-1);
    }
  }, [isOpen, includeRemote, loadAllBranches]);

  // Recent branches (only those that still exist in allBranches)
  const recentBranches: BranchInfo[] = useMemo(() => {
    if (searchQuery) return [];
    const recentNames = getRecentBranches(repoPath);
    const branchMap = new Map(allBranches.map((b) => [b.name, b]));
    return recentNames
      .filter((name) => name !== currentBranch && branchMap.has(name))
      .map((name) => branchMap.get(name)!)
      .slice(0, 3);
  }, [searchQuery, getRecentBranches, repoPath, allBranches, currentBranch]);

  // Filtered branches
  const filteredBranches: BranchInfo[] = useMemo(() => {
    if (!searchQuery) return allBranches;
    const q = searchQuery.toLowerCase();
    return allBranches.filter((b) => b.name.toLowerCase().includes(q));
  }, [allBranches, searchQuery]);

  // Combined flat list for keyboard navigation
  const allItems = useMemo(
    () => [...recentBranches, ...filteredBranches],
    [recentBranches, filteredBranches],
  );

  // Click-outside dismissal
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closePanels();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closePanels]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleBranchDropdown();
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
            const item = allItems[highlightedIndex];
            onSelectBranch(item.name, item.isRemote);
            closePanels();
          }
          break;
      }
    },
    [
      isOpen,
      allItems,
      highlightedIndex,
      toggleBranchDropdown,
      closePanels,
      onSelectBranch,
    ],
  );

  const handleSelectBranch = useCallback(
    (branch: BranchInfo) => {
      onSelectBranch(branch.name, branch.isRemote);
      closePanels();
    },
    [onSelectBranch, closePanels],
  );

  const handleToggleRemote = useCallback(() => {
    setIncludeRemote((prev) => !prev);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleBranchDropdown}
        onKeyDown={handleKeyDown}
        className={cn(
          "group flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors",
          "hover:bg-ctp-surface0",
          isOpen && "bg-ctp-surface0",
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Branch: ${currentBranch}`}
      >
        <GitBranch className="w-4 h-4 text-ctp-subtext0" />
        <span className="text-sm text-ctp-subtext1 font-mono font-medium">
          {currentBranch || "No branch"}
        </span>
        {isDirty && (
          <Circle className="w-2 h-2 fill-ctp-yellow text-ctp-yellow shrink-0" />
        )}
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
            className="absolute top-full left-0 z-40 mt-1 w-full min-w-[320px] max-w-[400px] bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-lg"
            role="listbox"
            aria-label="Branch list"
            onKeyDown={handleKeyDown}
          >
            <SwitcherSearch
              value={searchQuery}
              onChange={setSearchQuery}
              inputRef={searchRef}
            />

            {/* Remote toggle */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-ctp-surface0">
              <span className="text-xs text-ctp-overlay0">
                Show remote branches
              </span>
              <button
                type="button"
                onClick={handleToggleRemote}
                className={cn(
                  "w-8 h-4 rounded-full transition-colors relative",
                  includeRemote ? "bg-ctp-blue" : "bg-ctp-surface1",
                )}
                role="switch"
                aria-checked={includeRemote}
                aria-label="Toggle remote branches"
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-ctp-text transition-transform",
                    includeRemote ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>

            <div className="max-h-[380px] overflow-y-auto p-1">
              {/* Recent branches section */}
              {recentBranches.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-ctp-overlay0 uppercase tracking-wider">
                    Recent
                  </div>
                  {recentBranches.map((branch, idx) => (
                    <BranchSwitcherItem
                      key={`recent-${branch.name}`}
                      branch={branch}
                      isCurrent={branch.name === currentBranch}
                      isHighlighted={highlightedIndex === idx}
                      onSelect={() => handleSelectBranch(branch)}
                    />
                  ))}
                  <div className="mx-2 my-1 border-t border-ctp-surface0" />
                </div>
              )}

              {/* Full branch list */}
              <div className="px-3 py-1.5 text-xs font-semibold text-ctp-overlay0 uppercase tracking-wider">
                {includeRemote ? "All branches" : "Local branches"}
              </div>
              {filteredBranches.map((branch, idx) => (
                <BranchSwitcherItem
                  key={branch.name}
                  branch={branch}
                  isCurrent={branch.name === currentBranch}
                  isHighlighted={
                    highlightedIndex === recentBranches.length + idx
                  }
                  onSelect={() => handleSelectBranch(branch)}
                />
              ))}

              {/* No results */}
              {filteredBranches.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-ctp-overlay0">
                  No branches match &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
