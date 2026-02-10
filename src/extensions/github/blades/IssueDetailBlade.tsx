/**
 * Issue detail blade with header, markdown body, and comments.
 *
 * Displays full issue detail including status, labels, assignees,
 * milestone, description rendered as markdown, and a comments timeline.
 * Includes a link to open the issue on GitHub in an external browser.
 */

import { ExternalLink } from "lucide-react";
import { useIssueDetail } from "../hooks/useGitHubQuery";
import { BladeContentError } from "../../../blades/_shared/BladeContentError";
import { BladeContentLoading } from "../../../blades/_shared/BladeContentLoading";
import { MarkdownRenderer } from "../../../components/markdown/MarkdownRenderer";
import { StatusBadge } from "../components/StatusBadge";
import { LabelPill } from "../components/LabelPill";
import { UserAvatar } from "../components/UserAvatar";
import { TimeAgo } from "../components/TimeAgo";
import { CommentCard } from "../components/CommentCard";

interface IssueDetailBladeProps {
  owner: string;
  repo: string;
  number: number;
}

export function IssueDetailBlade({ owner, repo, number }: IssueDetailBladeProps) {
  const { data, isLoading, error, refetch } = useIssueDetail(owner, repo, number);

  if (isLoading) return <BladeContentLoading />;

  if (error || !data) {
    return (
      <BladeContentError
        message="Failed to load issue"
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
          <StatusBadge state={data.state} type="issue" />
          <span className="text-xs text-ctp-subtext0">#{number}</span>
          <span className="text-xs text-ctp-overlay0">{data.authorLogin}</span>
          <TimeAgo date={data.createdAt} />
        </div>

        {/* Labels */}
        {data.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {data.labels.map((label) => (
              <LabelPill key={label.name} name={label.name} color={label.color} />
            ))}
          </div>
        )}

        {/* Assignees */}
        {data.assignees.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-ctp-overlay0">Assignees:</span>
            <div className="flex items-center gap-1.5">
              {data.assignees.map((assignee) => (
                <div key={assignee.login} className="flex items-center gap-1">
                  <UserAvatar
                    login={assignee.login}
                    avatarUrl={assignee.avatarUrl}
                    size="sm"
                  />
                  <span className="text-xs text-ctp-subtext1">{assignee.login}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Milestone */}
        {data.milestone && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-ctp-overlay0">Milestone:</span>
            <span className="text-xs text-ctp-subtext1 bg-ctp-surface0 px-1.5 py-0.5 rounded">
              {data.milestone.title}
            </span>
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
    </div>
  );
}
