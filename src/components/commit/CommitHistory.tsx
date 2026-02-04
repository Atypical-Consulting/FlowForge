import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { GitCommit, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { type CommitSummary, commands } from "../../bindings";
import { cn } from "../../lib/utils";
import { CommitSearch } from "./CommitSearch";

interface CommitHistoryProps {
  onSelectCommit: (commit: CommitSummary) => void;
  selectedOid: string | null;
}

const PAGE_SIZE = 50;
const SEARCH_LIMIT = 100;

export function CommitHistory({
  onSelectCommit,
  selectedOid,
}: CommitHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");

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
  const commits = isSearching
    ? (searchQueryResult.data ?? [])
    : (historyQuery.data?.pages.flat() ?? []);
  const isLoading = isSearching
    ? searchQueryResult.isLoading
    : historyQuery.isLoading;
  const error = isSearching ? searchQueryResult.error : historyQuery.error;

  // Auto-select first commit when data loads and no selection exists
  useEffect(() => {
    if (commits.length > 0 && !selectedOid) {
      onSelectCommit(commits[0]);
    }
  }, [commits, selectedOid, onSelectCommit]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="px-2 py-2 border-b border-ctp-surface0">
        <CommitSearch value={searchQuery} onChange={handleSearchChange} />
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-ctp-subtext0" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-ctp-red text-sm">
            Failed to load history
          </div>
        ) : commits.length === 0 ? (
          <div className="flex items-center justify-center h-full text-ctp-overlay0 text-sm">
            {isSearching ? "No matching commits" : "No commits yet"}
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
                onClick={() => onSelectCommit(commit)}
                className={cn(
                  "w-full text-left px-3 py-2 cursor-pointer border-b border-ctp-surface0",
                  "hover:bg-ctp-surface0/50 transition-colors",
                  selectedOid === commit.oid && "bg-ctp-blue/20",
                )}
              >
                <div className="flex items-start gap-2">
                  <GitCommit className="w-4 h-4 text-ctp-overlay0 mt-0.5 shrink-0" />
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
