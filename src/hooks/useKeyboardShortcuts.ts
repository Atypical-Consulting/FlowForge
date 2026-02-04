import { Channel } from "@tauri-apps/api/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useHotkeys } from "react-hotkeys-hook";
import { type SyncProgress, commands } from "../bindings";
import { useRepositoryStore } from "../stores/repository";

/**
 * Keyboard shortcuts for common Git operations.
 *
 * Shortcuts:
 * - Cmd/Ctrl+O: Open repository
 * - Cmd/Ctrl+Shift+A: Stage all files
 * - Cmd/Ctrl+Shift+P: Push
 * - Cmd/Ctrl+Shift+L: Pull (L for "pull Latest")
 * - Cmd/Ctrl+Shift+F: Fetch
 */
export function useKeyboardShortcuts() {
  const queryClient = useQueryClient();
  const { status } = useRepositoryStore();

  // Stage all mutation
  const stageAllMutation = useMutation({
    mutationFn: () => commands.stageAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
    },
  });

  // Push mutation
  const pushMutation = useMutation({
    mutationFn: () => {
      const channel = new Channel<SyncProgress>();
      return commands.pushToRemote("origin", channel);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
    },
  });

  // Pull mutation
  const pullMutation = useMutation({
    mutationFn: () => {
      const channel = new Channel<SyncProgress>();
      return commands.pullFromRemote("origin", channel);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
      queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
    },
  });

  // Fetch mutation
  const fetchMutation = useMutation({
    mutationFn: () => {
      const channel = new Channel<SyncProgress>();
      return commands.fetchFromRemote("origin", channel);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
    },
  });

  // Open repo shortcut - dispatches custom event
  useHotkeys(
    "mod+o",
    (e) => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent("open-repository-dialog"));
    },
    { preventDefault: true },
  );

  // Stage all shortcut - only when repo is open
  useHotkeys(
    "mod+shift+a",
    (e) => {
      e.preventDefault();
      if (status) {
        stageAllMutation.mutate();
      }
    },
    { preventDefault: true, enabled: !!status },
  );

  // Push shortcut
  useHotkeys(
    "mod+shift+p",
    (e) => {
      e.preventDefault();
      if (status) {
        pushMutation.mutate();
      }
    },
    { preventDefault: true, enabled: !!status },
  );

  // Pull shortcut (using L for "Latest")
  useHotkeys(
    "mod+shift+l",
    (e) => {
      e.preventDefault();
      if (status) {
        pullMutation.mutate();
      }
    },
    { preventDefault: true, enabled: !!status },
  );

  // Fetch shortcut
  useHotkeys(
    "mod+shift+f",
    (e) => {
      e.preventDefault();
      if (status) {
        fetchMutation.mutate();
      }
    },
    { preventDefault: true, enabled: !!status },
  );

  // Return loading states for UI feedback
  return {
    isStaging: stageAllMutation.isPending,
    isPushing: pushMutation.isPending,
    isPulling: pullMutation.isPending,
    isFetching: fetchMutation.isPending,
  };
}

/**
 * Format shortcut for display (handles Mac vs Windows)
 */
export function formatShortcut(shortcut: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return shortcut
    .replace("mod", isMac ? "⌘" : "Ctrl")
    .replace("shift", isMac ? "⇧" : "Shift")
    .replace("alt", isMac ? "⌥" : "Alt")
    .replace(/\+/g, isMac ? "" : "+");
}
