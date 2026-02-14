import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { GitCommit, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { Virtuoso } from "react-virtuoso";
import { type CommitSummary, commands } from "../../../bindings";
import { useContextMenuRegistry } from "../../lib/contextMenuRegistry";
import { cn } from "../../lib/utils";
import { GravatarAvatar } from "../../../extensions/git-insights/components/GravatarAvatar";
import { useInsightsStore } from "../../../extensions/git-insights/insightsStore";
import { AuthorFilter } from "./AuthorFilter";
import { CommitSearch } from "./CommitSearch";

interface CommitHistoryProps {
  onSelectCommit?: (commit: CommitSummary) => void;
  selectedOid?: string | null;
  onCommitSelect?: (oid: string) => void;
}

const PAGE_SIZE = 50;
const SEARCH_LIMIT = 100;

export function CommitHistory({
  onSelectCommit,
  selectedOid,
  onCommitSelect,
}: CommitHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const externalContributor = useInsightsStore((s) => s.selectedContributor);

  // Regular paginated history (when not searching)
  const historyQuery = useInfiniteQuery({
    queryKey: ["commitHistory"],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await commands.getCommitHistory(pageParam, PAGE_SIZE);
      if (result.status === "ok") {
        return result.data;
      }
      throw new Error(
        result.error && "message" in result.error
          ? String(result.error.message)
          : "Unknown error",
      );
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.flat().length : undefined,
    initialPageParam: 0,
    enabled: !searchQuery, // Disable when searching
  });

  // Search query (when searching)
  const searchQueryResult = useQuery({
    queryKey: ["commitSearch", searchQuery],
    queryFn: async () => {
      const result = await commands.searchCommits(searchQuery, SEARCH_LIMIT);
      if (result.status === "ok") {
        return result.data;
      }
      throw new Error(
        result.error && "message" in result.error
          ? String(result.error.message)
          : "Unknown error",
      );
    },
    enabled: !!searchQuery,
  });

  // Determine which data to show
  const isSearching = !!searchQuery;
  const allCommits = isSearching
    ? (searchQueryResult.data ?? [])
    : (historyQuery.data?.pages.flat() ?? []);
  const isLoading = isSearching
    ? searchQueryResult.isLoading
    : historyQuery.isLoading;
  const error = isSearching ? searchQueryResult.error : historyQuery.error;

  // Sync external contributor selection from insights dashboard
  useEffect(() => {
    if (externalContributor) {
      const match = allCommits.find(
        (c) => c.authorEmail === externalContributor,
      );
      if (match) {
        setAuthorFilter(`${match.authorName} <${match.authorEmail}>`);
      } else {
        setAuthorFilter(externalContributor);
      }
    } else {
      setAuthorFilter("");
    }
  }, [externalContributor, allCommits]);

  // Apply author filter
  const commits = useMemo(() => {
    if (!authorFilter) return allCommits;
    return allCommits.filter(
      (c) =>
        `${c.authorName} <${c.authorEmail}>` === authorFilter ||
        c.authorEmail === authorFilter,
    );
  }, [allCommits, authorFilter]);

  // Auto-select first commit when data loads and no selection exists (old mode only)
  useEffect(() => {
    if (
      onSelectCommit &&
      !onCommitSelect &&
      commits.length > 0 &&
      !selectedOid
    ) {
      onSelectCommit(commits[0]);
    }
  }, [commits, selectedOid, onSelectCommit, onCommitSelect]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Search and filters */}
      <div className="px-2 py-2 border-b border-ctp-surface0 space-y-1.5">
        <CommitSearch value={searchQuery} onChange={handleSearchChange} />
        <AuthorFilter
          commits={allCommits}
          value={authorFilter}
          onChange={setAuthorFilter}
        />
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="flex items-start gap-2 px-3 py-2"
              >
                <Skeleton className="w-4 h-4 rounded-full shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-ctp-red text-sm">
            Failed to load history
          </div>
        ) : commits.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={<GitCommit className="w-full h-full" />}
              title={
                isSearching || authorFilter
                  ? "No matching commits"
                  : "Fresh start!"
              }
              description={
                isSearching || authorFilter
                  ? "Try a different search term or author filter."
                  : "Make your first commit and it will appear here."
              }
            />
          </div>
        ) : (
          <Virtuoso
            data={commits}
            endReached={() => {
              if (
                !isSearching &&
                historyQuery.hasNextPage &&
                !historyQuery.isFetchingNextPage
              ) {
                historyQuery.fetchNextPage();
              }
            }}
            itemContent={(_, commit) => (
              <button
                type="button"
                key={commit.oid}
                onClick={() => {
                  if (onCommitSelect) {
                    onCommitSelect(commit.oid);
                  } else if (onSelectCommit) {
                    onSelectCommit(commit);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  useContextMenuRegistry.getState().showMenu(
                    { x: e.clientX, y: e.clientY },
                    "commit-list",
                    { location: "commit-list", commitOid: commit.oid },
                  );
                }}
                className={cn(
                  "w-full text-left px-3 py-2 cursor-pointer border-b border-ctp-surface0",
                  "hover:bg-ctp-surface0/50 transition-colors",
                  selectedOid === commit.oid && "bg-ctp-blue/20",
                )}
              >
                <div className="flex items-start gap-2">
                  <GravatarAvatar
                    email={commit.authorEmail}
                    name={commit.authorName}
                    size="sm"
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ctp-subtext1 truncate">
                      {commit.messageSubject}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-ctp-overlay0">
                      <span className="font-mono">{commit.shortOid}</span>
                      <span>{commit.authorName}</span>
                      <span>{formatTimestamp(commit.timestampMs)}</span>
                    </div>
                  </div>
                </div>
              </button>
            )}
            components={{
              Footer: () =>
                !isSearching && historyQuery.isFetchingNextPage ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-ctp-subtext0" />
                  </div>
                ) : null,
            }}
          />
        )}
      </div>
    </div>
  );
}

function formatTimestamp(timestampMs: number): string {
  const date = new Date(timestampMs);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}
