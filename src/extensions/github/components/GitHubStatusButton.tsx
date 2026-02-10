/**
 * GitHub toolbar status button with rate limit badge.
 * Full implementation in Task 2.
 */

import { Github } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { ShortcutTooltip } from "../../../components/ui/ShortcutTooltip";
import { openBlade } from "../../../lib/bladeOpener";
import { useGitHubStore } from "../githubStore";

interface GitHubStatusButtonProps {
  tabIndex: number;
}

export function GitHubStatusButton({ tabIndex }: GitHubStatusButtonProps) {
  const isAuthenticated = useGitHubStore((s) => s.isAuthenticated);
  const username = useGitHubStore((s) => s.username);
  const rateLimit = useGitHubStore((s) => s.rateLimit);

  const handleClick = () => {
    if (isAuthenticated) {
      openBlade("ext:github:account", {});
    } else {
      openBlade("ext:github:sign-in", {});
    }
  };

  // Rate limit badge color
  let dotColor = "";
  if (isAuthenticated && rateLimit) {
    const pct = rateLimit.remaining / rateLimit.limit;
    if (pct > 0.5) dotColor = "bg-ctp-green";
    else if (pct > 0.1) dotColor = "bg-ctp-yellow";
    else dotColor = "bg-ctp-red";
  }

  const tooltip = isAuthenticated
    ? `GitHub: @${username}${rateLimit ? ` (${rateLimit.remaining} requests remaining)` : ""}`
    : "Sign in to GitHub";

  return (
    <ShortcutTooltip shortcut="" label={tooltip}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        aria-label={tooltip}
        data-toolbar-item
        tabIndex={tabIndex}
        className="relative"
      >
        <Github className="w-4 h-4" />
        {dotColor && (
          <span
            className={`absolute top-1 right-1 w-2 h-2 rounded-full ${dotColor}`}
            aria-hidden="true"
          />
        )}
      </Button>
    </ShortcutTooltip>
  );
}
