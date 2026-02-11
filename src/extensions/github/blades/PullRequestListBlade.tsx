/**
 * Pull request list blade with state filter tabs and infinite scroll.
 *
 * Displays a paginated list of PRs for the selected GitHub remote.
 * Uses Virtuoso for efficient rendering and useInfiniteQuery for
 * automatic page fetching. State filter tabs switch between
 * open/closed/all views with stale-while-revalidate caching.
 */

import { useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { GitPullRequest, Loader2 } from "lucide-react";
import { useGitHubStore } from "../githubStore";
import { usePullRequestList } from "../hooks/useGitHubQuery";
import { useBladeNavigation } from "../../../core/hooks/useBladeNavigation";
import { BladeContentEmpty } from "../../../core/blades/_shared/BladeContentEmpty";
import { BladeContentError } from "../../../core/blades/_shared/BladeContentError";
import { BladeContentLoading } from "../../../core/blades/_shared/BladeContentLoading";
import { StatusBadge } from "../components/StatusBadge";
import { LabelPill } from "../components/LabelPill";
import { TimeAgo } from "../components/TimeAgo";

type StateFilter = "open" | "closed" | "all";

const FILTER_TABS: { label: string; value: StateFilter }[] = [
  { label: "Open", value: "open" },
  { label: "Closed", value: "closed" },
  { label: "All", value: "all" },
];

export function PullRequestListBlade() {
  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const { detectedRemotes, selectedRemoteIndex } = useGitHubStore();
  const remote = detectedRemotes[selectedRemoteIndex];
  const { openBlade } = useBladeNavigation();

  if (!remote) {
    return (
      <BladeContentEmpty
        icon={GitPullRequest}
        message="No GitHub remote detected"
        detail="Open a repository with a GitHub remote to view pull requests."
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Remote selector (only if multiple remotes) */}
      {detectedRemotes.length > 1 && (
        <div className="px-3 pt-2">
          <select
            value={selectedRemoteIndex}
            onChange={(e) =>
              useGitHubStore.getState().setSelectedRemote(Number(e.target.value))
            }
            className="w-full text-xs bg-ctp-surface0 text-ctp-text border border-ctp-surface1 rounded px-2 py-1"
          >
            {detectedRemotes.map((r, i) => (
              <option key={r.url} value={i}>
                {r.owner}/{r.repo}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filter tabs */}
      <div className="px-3 py-2" role="tablist" aria-label="Pull request state filter">
        <div className="flex gap-1 bg-ctp-mantle rounded-lg p-0.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={stateFilter === tab.value}
              onClick={() => setStateFilter(tab.value)}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                stateFilter === tab.value
                  ? "bg-ctp-surface1 text-ctp-text font-medium"
                  : "text-ctp-overlay0 hover:text-ctp-subtext1 hover:bg-ctp-surface0"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List area */}
      <div className="flex-1 min-h-0">
        <PullRequestList
          owner={remote.owner}
          repo={remote.repo}
          state={stateFilter}
          onSelect={(pr) =>
            openBlade(
              "ext:github:pull-request",
              { owner: remote.owner, repo: remote.repo, number: pr.number },
              `#${pr.number} ${pr.title}`,
            )
          }
        />
      </div>
    </div>
  );
}

interface PullRequestListInnerProps {
  owner: string;
  repo: string;
  state: StateFilter;
  onSelect: (pr: { number: number; title: string }) => void;
}

function PullRequestList({ owner, repo, state, onSelect }: PullRequestListInnerProps) {
  const query = usePullRequestList(owner, repo, state);
  const prs = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (query.isLoading) return <BladeContentLoading />;

  if (query.error) {
    return (
      <BladeContentError
        message="Failed to load pull requests"
        detail={query.error instanceof Error ? query.error.message : "Unknown error"}
        onRetry={() => query.refetch()}
      />
    );
  }

  if (prs.length === 0) {
    return (
      <BladeContentEmpty
        icon={GitPullRequest}
        message={`No ${state === "all" ? "" : state + " "}pull requests`}
      />
    );
  }

  return (
    <Virtuoso
      data={prs}
      endReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      }}
      itemContent={(_index, pr) => (
        <button
          type="button"
          onClick={() => onSelect(pr)}
          className="w-full text-left px-3 py-2.5 border-b border-ctp-surface0 hover:bg-ctp-surface0/50 transition-colors"
        >
          <div className="flex items-start gap-2">
            <div className="pt-0.5 shrink-0">
              <StatusBadge state={pr.state} merged={pr.merged} draft={pr.draft} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ctp-text truncate">{pr.title}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-ctp-overlay0">
                <span className="text-ctp-subtext0">#{pr.number}</span>
                <span>{pr.authorLogin}</span>
                <TimeAgo date={pr.createdAt} />
                {pr.labels.slice(0, 3).map((label) => (
                  <LabelPill key={label.name} name={label.name} color={label.color} />
                ))}
              </div>
            </div>
          </div>
        </button>
      )}
      components={{
        Footer: () =>
          query.isFetchingNextPage ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-ctp-overlay1" />
            </div>
          ) : null,
      }}
    />
  );
}
