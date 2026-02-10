/**
 * GitHub extension entry point.
 *
 * Registers blades, commands, and toolbar actions through ExtensionAPI.
 * All GitHub UI is contributed through the extension system -- zero
 * GitHub-specific code in core UI files.
 */

import { createElement } from "react";
import { Github } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { openBlade } from "../../lib/bladeOpener";
import { useGitHubStore, cancelGitHubPolling } from "./githubStore";
import { useRepositoryStore } from "../../stores/repository";

// Module-level unsubscribe for repo change listener
let unsubRepoWatch: (() => void) | null = null;

// Lazy imports for blade components (avoid circular deps and code splitting)
let GitHubAuthBlade: React.ComponentType<any> | null = null;
let GitHubAccountBlade: React.ComponentType<any> | null = null;
let GitHubStatusButton: React.ComponentType<any> | null = null;

async function ensureComponents(): Promise<void> {
  if (!GitHubAuthBlade) {
    const authMod = await import("./blades/GitHubAuthBlade");
    GitHubAuthBlade = authMod.GitHubAuthBlade;
  }
  if (!GitHubAccountBlade) {
    const accountMod = await import("./blades/GitHubAccountBlade");
    GitHubAccountBlade = accountMod.GitHubAccountBlade;
  }
  if (!GitHubStatusButton) {
    const statusMod = await import("./components/GitHubStatusButton");
    GitHubStatusButton = statusMod.GitHubStatusButton;
  }
}

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Ensure all components are loaded before registration
  await ensureComponents();

  // Register blades
  api.registerBlade({
    type: "sign-in",
    title: "GitHub Sign In",
    component: GitHubAuthBlade!,
    singleton: true,
    wrapInPanel: true,
    showBack: true,
  });

  api.registerBlade({
    type: "account",
    title: "GitHub Account",
    component: GitHubAccountBlade!,
    singleton: true,
    wrapInPanel: true,
    showBack: true,
  });

  // Register commands
  api.registerCommand({
    id: "sign-in",
    title: "Sign in to GitHub",
    category: "GitHub",
    icon: Github,
    action: () => openBlade("ext:github:sign-in", {}),
    enabled: () => !useGitHubStore.getState().isAuthenticated,
  });

  api.registerCommand({
    id: "sign-out",
    title: "Sign out of GitHub",
    category: "GitHub",
    action: () => useGitHubStore.getState().signOut(),
    enabled: () => useGitHubStore.getState().isAuthenticated,
  });

  // Contribute toolbar
  api.contributeToolbar({
    id: "github-status",
    label: "GitHub",
    icon: Github,
    group: "app",
    priority: 60,
    execute: () => {
      const { isAuthenticated } = useGitHubStore.getState();
      if (isAuthenticated) {
        openBlade("ext:github:account", {});
      } else {
        openBlade("ext:github:sign-in", {});
      }
    },
    when: () => true,
    renderCustom: (_action, tabIndex) =>
      createElement(GitHubStatusButton!, { tabIndex }),
  });

  // Restore session from keychain on startup
  useGitHubStore.getState().checkAuth();

  // Subscribe to repo changes for remote auto-detection
  let prevRepoPath: string | null = useRepositoryStore.getState().repoStatus?.repoPath ?? null;
  unsubRepoWatch = useRepositoryStore.subscribe((state) => {
    const currentPath = state.repoStatus?.repoPath ?? null;
    if (currentPath !== prevRepoPath) {
      prevRepoPath = currentPath;
      if (currentPath) {
        // Repo opened -- detect remotes
        useGitHubStore.getState().detectRemotes();
      } else {
        // Repo closed -- clear remotes
        useGitHubStore.getState().resetRemotes();
      }
    }
  });

  // Also detect remotes if a repo is already open
  if (useRepositoryStore.getState().repoStatus) {
    useGitHubStore.getState().detectRemotes();
  }
}

export function onDeactivate(): void {
  // Cancel any active polling
  cancelGitHubPolling();

  // Unsubscribe from repo changes
  if (unsubRepoWatch) {
    unsubRepoWatch();
    unsubRepoWatch = null;
  }

  // Reset transient state but NOT auth state
  const state = useGitHubStore.getState();
  if (state.isAuthenticating) {
    state.cancelAuth();
  }
}
