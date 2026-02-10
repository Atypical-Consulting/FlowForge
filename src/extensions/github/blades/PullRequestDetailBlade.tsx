/**
 * Pull request detail blade with header, markdown body, and comments.
 *
 * Displays full PR detail including status, branch info, diff stats,
 * labels, description rendered as markdown, and a comments timeline.
 * Includes a link to open the PR on GitHub in an external browser.
 */

import { useState, useEffect } from "react";
import { ExternalLink, GitMerge } from "lucide-react";
import { usePullRequestDetail } from "../hooks/useGitHubQuery";
import { useMergePullRequest } from "../hooks/useGitHubMutation";
import { BladeContentError } from "../../../blades/_shared/BladeContentError";
import { BladeContentLoading } from "../../../blades/_shared/BladeContentLoading";
import { MarkdownRenderer } from "../../../components/markdown/MarkdownRenderer";
import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../components/StatusBadge";
import { LabelPill } from "../components/LabelPill";
import { TimeAgo } from "../components/TimeAgo";
import { CommentCard } from "../components/CommentCard";
import { MergeConfirmDialog } from "../components/MergeConfirmDialog";

interface PullRequestDetailBladeProps {
  owner: string;
  repo: string;
  number: number;
}

export function PullRequestDetailBlade({ owner, repo, number }: PullRequestDetailBladeProps) {
  const { data, isLoading, error, refetch } = usePullRequestDetail(owner, repo, number);
  const mergeMutation = useMergePullRequest(owner, repo);
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  // Close dialog on merge success
  useEffect(() => {
    if (mergeMutation.isSuccess) {
      setShowMergeDialog(false);
    }
  }, [mergeMutation.isSuccess]);

  if (isLoading) return <BladeContentLoading />;

  if (error || !data) {
    return (
      <BladeContentError
        message="Failed to load pull request"
        detail={error instanceof Error ? error.message : "Unknown error"}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header section */}
      <div className="px-4 py-4 border-b border-ctp-surface0">
        <h2 className="text-base font-semibold text-ctp-text">{data.title}</h2>

        {/* Status row */}
        <div className="flex items-center gap-2 mt-2">
          <StatusBadge state={data.state} merged={data.merged} draft={data.draft} />
          <span className="text-xs text-ctp-subtext0">#{number}</span>
          <span className="text-xs text-ctp-overlay0">{data.authorLogin}</span>
          <TimeAgo date={data.createdAt} />
        </div>

        {/* Branch info */}
        <div className="mt-2 text-xs text-ctp-overlay0">
          <span className="font-mono bg-ctp-surface0 px-1.5 py-0.5 rounded text-ctp-subtext1">
            {data.headRef}
          </span>
          <span className="mx-1.5">&rarr;</span>
          <span className="font-mono bg-ctp-surface0 px-1.5 py-0.5 rounded text-ctp-subtext1">
            {data.baseRef}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="text-ctp-green">+{data.additions}</span>
          <span className="text-ctp-red">-{data.deletions}</span>
          <span className="text-ctp-overlay0">{data.changedFiles} files</span>
          <span className="text-ctp-overlay0">{data.commits} commits</span>
        </div>

        {/* Labels row */}
        {data.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {data.labels.map((label) => (
              <LabelPill key={label.name} name={label.name} color={label.color} />
            ))}
          </div>
        )}

        {/* Merge action -- only for open, non-draft PRs */}
        {data.state === "open" && !data.draft && (
          <div className="mt-3">
            <Button
              onClick={() => setShowMergeDialog(true)}
              className="bg-ctp-green text-ctp-base hover:bg-ctp-green/90"
              size="sm"
            >
              <GitMerge className="w-3.5 h-3.5 mr-1.5" />
              Merge
            </Button>
          </div>
        )}
      </div>

      {/* Description section */}
      <div className="px-4 py-4 border-b border-ctp-surface0">
        {data.body ? (
          <MarkdownRenderer content={data.body} />
        ) : (
          <p className="text-sm text-ctp-overlay0 italic">No description provided.</p>
        )}
      </div>

      {/* Comments section */}
      <div className="px-4 py-4">
        <h3 className="text-sm font-medium text-ctp-subtext1 mb-3">
          Comments ({data.comments.length})
        </h3>
        {data.comments.length > 0 ? (
          <div className="space-y-3">
            {data.comments.map((comment) => (
              <CommentCard
                key={comment.id}
                authorLogin={comment.authorLogin}
                authorAvatarUrl={comment.authorAvatarUrl}
                body={comment.body}
                createdAt={comment.createdAt}
                htmlUrl={comment.htmlUrl}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ctp-overlay0">No comments yet.</p>
        )}
      </div>

      {/* Open on GitHub */}
      <div className="px-4 pb-4">
        <a
          href={data.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-ctp-blue hover:text-ctp-sapphire transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open on GitHub
        </a>
      </div>

      {/* Merge dialog */}
      <MergeConfirmDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        prNumber={number}
        prTitle={data.title}
        headRef={data.headRef}
        baseRef={data.baseRef}
        isPending={mergeMutation.isPending}
        onMerge={(method, commitTitle, commitMessage) => {
          mergeMutation.mutate({
            pullNumber: number,
            mergeMethod: method,
            commitTitle,
            commitMessage,
            sha: data.headSha,
          });
        }}
      />
    </div>
  );
}
