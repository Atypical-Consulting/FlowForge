import { useInfiniteQuery } from "@tanstack/react-query";
import { GitCommit, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import { type CommitSummary, commands } from "../../bindings";
import { cn } from "../../lib/utils";

interface CommitHistoryProps {
  onSelectCommit: (commit: CommitSummary) => void;
  selectedOid: string | null;
}

const PAGE_SIZE = 50;

export function CommitHistory({
  onSelectCommit,
  selectedOid,
}: CommitHistoryProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
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
  });

  const commits = data?.pages.flat() ?? [];

  // Auto-select first commit when data loads and no selection exists
  useEffect(() => {
    if (commits.length > 0 && !selectedOid) {
      onSelectCommit(commits[0]);
    }
  }, [commits, selectedOid, onSelectCommit]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-sm">
        Failed to load history
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        No commits yet
      </div>
    );
  }

  return (
    <Virtuoso
      data={commits}
      endReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
      itemContent={(_, commit) => (
        <button
          type="button"
          key={commit.oid}
          onClick={() => onSelectCommit(commit)}
          className={cn(
            "w-full text-left px-3 py-2 cursor-pointer border-b border-gray-800",
            "hover:bg-gray-800/50 transition-colors",
            selectedOid === commit.oid && "bg-blue-900/30",
          )}
        >
          <div className="flex items-start gap-2">
            <GitCommit className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 truncate">
                {commit.messageSubject}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
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
          isFetchingNextPage ? (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          ) : null,
      }}
    />
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
