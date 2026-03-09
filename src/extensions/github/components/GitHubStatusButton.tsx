/**
 * GitHub toolbar status button with rate limit badge.
 *
 * Custom toolbar widget rendered via renderCustom.
 * Shows GitHub icon with colored dot indicating rate limit status:
 * - Green: >50% remaining
 * - Yellow: 10-50% remaining
 * - Red: <10% remaining
 */

import { Github } from "lucide-react";
import { openBlade } from "@/framework/layout/bladeOpener";
import { Button } from "../../../core/components/ui/button";
import { ShortcutTooltip } from "../../../core/components/ui/ShortcutTooltip";
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
