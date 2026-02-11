/**
 * Comment card for GitHub PR and issue comments.
 *
 * Renders a comment with avatar, author name, timestamp,
 * and markdown body using the shared MarkdownRenderer component.
 */

import { MarkdownRenderer } from "../../../core/components/markdown/MarkdownRenderer";
import { UserAvatar } from "./UserAvatar";
import { TimeAgo } from "./TimeAgo";

interface CommentCardProps {
  /** GitHub username of the comment author */
  authorLogin: string;
  /** Avatar URL of the comment author */
  authorAvatarUrl: string;
  /** Markdown body of the comment */
  body: string;
  /** ISO 8601 timestamp when the comment was created */
  createdAt: string;
  /** URL to the comment on GitHub */
  htmlUrl: string;
}

export function CommentCard({
  authorLogin,
  authorAvatarUrl,
  body,
  createdAt,
}: CommentCardProps) {
  return (
    <div className="bg-ctp-surface0/30 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <UserAvatar login={authorLogin} avatarUrl={authorAvatarUrl} size="sm" />
        <span className="text-sm font-medium text-ctp-text">{authorLogin}</span>
        <TimeAgo date={createdAt} />
      </div>
      <div className="prose-sm">
        <MarkdownRenderer content={body} />
      </div>
    </div>
  );
}
