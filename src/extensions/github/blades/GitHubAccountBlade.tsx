/**
 * GitHub account management blade.
 *
 * Shows authenticated user info, granted scopes, rate limits,
 * linked repositories, and a sign-out action.
 * When not authenticated, shows an empty state with sign-in button.
 */

import { useEffect } from "react";
import { Github, LogOut, UserCircle, ExternalLink } from "lucide-react";
import { Button } from "../../../core/components/ui/button";
import { openBlade } from "@/framework/layout/bladeOpener";
import { useGitHubStore } from "../githubStore";
import { RateLimitBar } from "../components/RateLimitBar";

export function GitHubAccountBlade() {
  const isAuthenticated = useGitHubStore((s) => s.isAuthenticated);
  const username = useGitHubStore((s) => s.username);
  const avatarUrl = useGitHubStore((s) => s.avatarUrl);
  const scopes = useGitHubStore((s) => s.scopes);
  const rateLimit = useGitHubStore((s) => s.rateLimit);
  const detectedRemotes = useGitHubStore((s) => s.detectedRemotes);
  const signOut = useGitHubStore((s) => s.signOut);
  const checkRateLimit = useGitHubStore((s) => s.checkRateLimit);

  // Refresh rate limit data on blade mount
  useEffect(() => {
    if (isAuthenticated) {
      checkRateLimit();
    }
  }, [isAuthenticated, checkRateLimit]);

  // Not authenticated: empty state
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <Github className="w-12 h-12 text-ctp-overlay1" />
        <h3 className="text-lg font-medium text-ctp-text">Not signed in</h3>
        <p className="text-sm text-ctp-subtext0 max-w-xs">
          Sign in to GitHub to access repositories, view rate limits, and manage your account.
        </p>
        <Button
          variant="default"
          onClick={() => openBlade("ext:github:sign-in", {})}
        >
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Account header */}
      <div className="px-6 py-5 border-b border-ctp-surface0">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={username ?? "GitHub avatar"}
              className="w-14 h-14 rounded-full border-2 border-ctp-surface1"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                // Show fallback icon
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  const fallback = document.createElement("div");
                  fallback.className = "w-14 h-14 rounded-full bg-ctp-surface0 flex items-center justify-center";
                  fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ctp-overlay1"><path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/></svg>';
                  parent.insertBefore(fallback, e.target as HTMLImageElement);
                }
              }}
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-ctp-surface0 flex items-center justify-center">
              <UserCircle className="w-7 h-7 text-ctp-overlay1" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-ctp-text">@{username}</h2>
            <p className="text-sm text-ctp-subtext0">
              {scopes.length} permission{scopes.length !== 1 ? "s" : ""} granted
            </p>
          </div>
        </div>
      </div>

      {/* Permissions */}
      {scopes.length > 0 && (
        <div className="px-6 py-4 border-b border-ctp-surface0">
          <h3 className="text-sm font-medium text-ctp-subtext1 mb-3">
            Permissions
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {scopes.map((scope) => (
              <span
                key={scope}
                className="px-2.5 py-1 text-xs bg-ctp-surface0 text-ctp-subtext1 rounded-full"
              >
                {scope}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rate Limits */}
      {rateLimit && (
        <div className="px-6 py-4 border-b border-ctp-surface0">
          <h3 className="text-sm font-medium text-ctp-subtext1 mb-3">
            Rate Limits
          </h3>
          <RateLimitBar
            label="Core API"
            remaining={rateLimit.remaining}
            limit={rateLimit.limit}
            reset={rateLimit.reset}
          />
        </div>
      )}

      {/* Linked Repositories */}
      {detectedRemotes.length > 0 && (
        <div className="px-6 py-4 border-b border-ctp-surface0">
          <h3 className="text-sm font-medium text-ctp-subtext1 mb-3">
            Linked Repositories
          </h3>
          <div className="space-y-2">
            {detectedRemotes.map((remote) => (
              <div
                key={remote.url}
                className="flex items-center gap-3 p-2.5 bg-ctp-surface0 rounded-lg"
              >
                <Github className="w-4 h-4 text-ctp-overlay1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ctp-text truncate">
                    {remote.owner}/{remote.repo}
                  </p>
                  <p className="text-xs text-ctp-overlay0 truncate">
                    {remote.remoteName}
                  </p>
                </div>
                <a
                  href={`https://github.com/${remote.owner}/${remote.repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ctp-blue hover:text-ctp-sapphire"
                  onClick={async (e) => {
                    e.preventDefault();
                    try {
                      const { openUrl } = await import("@tauri-apps/plugin-opener");
                      await openUrl(`https://github.com/${remote.owner}/${remote.repo}`);
                    } catch {
                      window.open(`https://github.com/${remote.owner}/${remote.repo}`, "_blank");
                    }
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sign Out */}
      <div className="mt-auto px-6 py-4 border-t border-ctp-surface0">
        <div className="p-4 bg-ctp-red/5 border border-ctp-red/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-ctp-red">Sign Out</h3>
              <p className="text-xs text-ctp-subtext0 mt-0.5">
                Remove your GitHub token from this device
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={signOut}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
