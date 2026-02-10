/**
 * GitHub extension Zustand store.
 *
 * Manages authentication state, device flow, rate limits,
 * and detected GitHub remotes. This store is NOT registered
 * for reset -- auth persists across repo switches. Only
 * detectedRemotes is reset on repo change.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { commands } from "../../bindings";
import { toast } from "../../stores/toast";
import { openBlade } from "../../lib/bladeOpener";
import type { AuthStep } from "./types";

// Module-level poll timeout ID (NOT in Zustand state -- non-serializable)
let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;

interface GitHubRemote {
  remoteName: string;
  owner: string;
  repo: string;
  url: string;
}

interface RateLimit {
  remaining: number;
  limit: number;
  reset: number;
  used: number;
}

interface GitHubState {
  // Auth state
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authStep: AuthStep;
  username: string | null;
  avatarUrl: string | null;
  scopes: string[];

  // Device flow state
  userCode: string | null;
  verificationUri: string | null;
  deviceCode: string | null;
  expiresAt: number | null;
  pollInterval: number;
  authError: string | null;

  // Rate limits
  rateLimit: RateLimit | null;
  lastRateLimitWarning: number;

  // Detected remotes
  detectedRemotes: GitHubRemote[];

  // Actions
  startDeviceFlow: (selectedScopes: string[]) => Promise<void>;
  pollForAuth: () => Promise<void>;
  cancelAuth: () => void;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  checkRateLimit: () => Promise<void>;
  checkRateLimitWarning: () => void;
  detectRemotes: () => Promise<void>;
  resetRemotes: () => void;
}

export const useGitHubStore = create<GitHubState>()(
  devtools(
    (set, get) => ({
      // Auth state defaults
      isAuthenticated: false,
      isAuthenticating: false,
      authStep: "scopes" as AuthStep,
      username: null,
      avatarUrl: null,
      scopes: [],

      // Device flow defaults
      userCode: null,
      verificationUri: null,
      deviceCode: null,
      expiresAt: null,
      pollInterval: 5,
      authError: null,

      // Rate limits
      rateLimit: null,
      lastRateLimitWarning: 0,

      // Detected remotes
      detectedRemotes: [],

      // -------------------------------------------------------------------
      // Actions
      // -------------------------------------------------------------------

      startDeviceFlow: async (selectedScopes: string[]) => {
        set(
          { isAuthenticating: true, authError: null },
          false,
          "github/start-device-flow",
        );

        try {
          const result = await commands.githubStartDeviceFlow(selectedScopes);
          if (result.status === "error") {
            const errMsg = "message" in result.error ? result.error.message : result.error.type;
            set(
              { authError: errMsg, authStep: "error", isAuthenticating: false },
              false,
              "github/device-flow-error",
            );
            return;
          }

          const data = result.data;
          set(
            {
              userCode: data.userCode,
              verificationUri: data.verificationUri,
              deviceCode: data.deviceCode,
              expiresAt: Date.now() + data.expiresIn * 1000,
              pollInterval: data.interval,
              authStep: "device-code",
              scopes: selectedScopes,
            },
            false,
            "github/device-flow-started",
          );

          // Start polling
          get().pollForAuth();
        } catch (e) {
          set(
            {
              authError: e instanceof Error ? e.message : String(e),
              authStep: "error",
              isAuthenticating: false,
            },
            false,
            "github/device-flow-error",
          );
        }
      },

      pollForAuth: async () => {
        const { deviceCode, pollInterval } = get();
        if (!deviceCode) return;

        try {
          const result = await commands.githubPollAuth(deviceCode, pollInterval);

          if (result.status === "error") {
            const err = result.error;
            switch (err.type) {
              case "AuthorizationPending":
                // Continue polling with setTimeout chain
                pollTimeoutId = setTimeout(
                  () => get().pollForAuth(),
                  get().pollInterval * 1000,
                );
                return;

              case "SlowDown":
                // Increase interval by 5 seconds per GitHub spec
                set(
                  (state) => ({ pollInterval: state.pollInterval + 5 }),
                  false,
                  "github/slow-down",
                );
                pollTimeoutId = setTimeout(
                  () => get().pollForAuth(),
                  get().pollInterval * 1000,
                );
                return;

              case "ExpiredToken":
                set(
                  {
                    authError: "Device code expired. Please try again.",
                    authStep: "error",
                    isAuthenticating: false,
                  },
                  false,
                  "github/expired-token",
                );
                return;

              case "AccessDenied":
                set(
                  {
                    authError: "Authorization was denied.",
                    authStep: "error",
                    isAuthenticating: false,
                  },
                  false,
                  "github/access-denied",
                );
                return;

              default: {
                const errMsg = "message" in err ? err.message : err.type;
                set(
                  {
                    authError: errMsg,
                    authStep: "error",
                    isAuthenticating: false,
                  },
                  false,
                  "github/poll-error",
                );
                return;
              }
            }
          }

          // Success
          const data = result.data;
          set(
            {
              isAuthenticated: true,
              isAuthenticating: false,
              username: data.username,
              avatarUrl: data.avatarUrl,
              scopes: data.scopes.length > 0 ? data.scopes : get().scopes,
              authStep: "success",
              // Clear device flow state
              deviceCode: null,
              userCode: null,
              verificationUri: null,
              expiresAt: null,
              authError: null,
            },
            false,
            "github/auth-success",
          );

          // Check rate limit after successful auth
          get().checkRateLimit();
        } catch (e) {
          set(
            {
              authError: e instanceof Error ? e.message : String(e),
              authStep: "error",
              isAuthenticating: false,
            },
            false,
            "github/poll-error",
          );
        }
      },

      cancelAuth: () => {
        if (pollTimeoutId) {
          clearTimeout(pollTimeoutId);
          pollTimeoutId = null;
        }
        set(
          {
            isAuthenticating: false,
            authStep: "scopes",
            deviceCode: null,
            userCode: null,
            verificationUri: null,
            expiresAt: null,
            authError: null,
            pollInterval: 5,
          },
          false,
          "github/cancel-auth",
        );
      },

      signOut: async () => {
        try {
          const result = await commands.githubSignOut();
          if (result.status === "error") {
            const errMsg = "message" in result.error ? result.error.message : result.error.type;
            toast.error(`Sign out failed: ${errMsg}`);
            return;
          }

          set(
            {
              isAuthenticated: false,
              isAuthenticating: false,
              authStep: "scopes",
              username: null,
              avatarUrl: null,
              scopes: [],
              rateLimit: null,
              deviceCode: null,
              userCode: null,
              verificationUri: null,
              expiresAt: null,
              authError: null,
            },
            false,
            "github/sign-out",
          );

          toast.success("Signed out of GitHub");
        } catch (e) {
          toast.error(`Sign out failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      },

      checkAuth: async () => {
        try {
          const result = await commands.githubGetAuthStatus();
          if (result.status === "error") return;

          const data = result.data;
          if (data.authenticated) {
            set(
              {
                isAuthenticated: true,
                username: data.username,
                avatarUrl: data.avatarUrl,
                scopes: data.scopes.length > 0 ? data.scopes : get().scopes,
              },
              false,
              "github/check-auth-restored",
            );

            // Check rate limit on restore
            get().checkRateLimit();
          }
        } catch {
          // Silent fail on startup auth check
        }
      },

      checkRateLimit: async () => {
        try {
          const result = await commands.githubCheckRateLimit();
          if (result.status === "error") return;

          set(
            { rateLimit: result.data },
            false,
            "github/rate-limit-updated",
          );

          get().checkRateLimitWarning();
        } catch {
          // Silent fail
        }
      },

      checkRateLimitWarning: () => {
        const { rateLimit, lastRateLimitWarning } = get();
        if (!rateLimit) return;

        const THRESHOLD = 500; // 10% of 5000
        const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

        if (
          rateLimit.remaining < THRESHOLD &&
          Date.now() - lastRateLimitWarning > DEBOUNCE_MS
        ) {
          set(
            { lastRateLimitWarning: Date.now() },
            false,
            "github/rate-limit-warning",
          );

          toast.warning(
            `GitHub API rate limit low: ${rateLimit.remaining}/${rateLimit.limit} remaining`,
            {
              label: "View Details",
              onClick: () => openBlade("ext:github:account", {}),
            },
          );
        }
      },

      detectRemotes: async () => {
        try {
          const result = await commands.githubDetectRemotes();
          if (result.status === "error") return;

          set(
            { detectedRemotes: result.data },
            false,
            "github/remotes-detected",
          );

          // Show info toast if remotes found and authenticated
          if (result.data.length > 0 && get().isAuthenticated) {
            const first = result.data[0];
            toast.info(`Linked to github.com/${first.owner}/${first.repo}`);
          }
        } catch {
          // Silent fail
        }
      },

      resetRemotes: () => {
        set({ detectedRemotes: [] }, false, "github/reset-remotes");
      },
    }),
    { name: "github-auth", enabled: import.meta.env.DEV },
  ),
);

/**
 * Cancel any active polling. Called from extension onDeactivate
 * and when navigating away from the auth blade.
 */
export function cancelGitHubPolling(): void {
  if (pollTimeoutId) {
    clearTimeout(pollTimeoutId);
    pollTimeoutId = null;
  }
}
