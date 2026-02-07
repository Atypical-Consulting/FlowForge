import { Channel } from "@tauri-apps/api/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useHotkeys } from "react-hotkeys-hook";
import { type SyncProgress, commands } from "../bindings";
import { useBladeStore } from "../stores/blades";
import { useRepositoryStore } from "../stores/repository";
import { useSettingsStore } from "../stores/settings";
import { useTopologyStore } from "../stores/topology";
import { toast } from "../stores/toast";

/**
 * Keyboard shortcuts for common Git operations.
 *
 * Shortcuts:
 * - Cmd/Ctrl+O: Open repository
 * - Cmd/Ctrl+,: Open settings
 * - Cmd/Ctrl+Shift+A: Stage all files
 * - Cmd/Ctrl+Shift+U: Push (Upload)
 * - Cmd/Ctrl+Shift+L: Pull (L for "pull Latest")
 * - Cmd/Ctrl+Shift+F: Fetch
 * - Cmd/Ctrl+Shift+M: Toggle amend commit
 */
export function useKeyboardShortcuts() {
  const queryClient = useQueryClient();
  const { status } = useRepositoryStore();
  const openSettings = useSettingsStore((s) => s.openSettings);

  // Stage all mutation
  const stageAllMutation = useMutation({
    mutationFn: () => commands.stageAll(),
    onSuccess: () => {
      toast.success("Staged all changes");
      queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
    },
    onError: (error) => {
      toast.error(`Failed to stage: ${String(error)}`);
    },
  });

  // Push mutation
  const pushMutation = useMutation({
    mutationFn: () => {
      const channel = new Channel<SyncProgress>();
      return commands.pushToRemote("origin", channel);
    },
    onSuccess: () => {
      toast.success("Pushed to origin");
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
    },
    onError: (error) => {
      toast.error(`Push failed: ${String(error)}`, {
        label: "Retry",
        onClick: () => pushMutation.mutate(),
      });
    },
  });

  // Pull mutation
  const pullMutation = useMutation({
    mutationFn: () => {
      const channel = new Channel<SyncProgress>();
      return commands.pullFromRemote("origin", channel);
    },
    onSuccess: () => {
      toast.success("Pulled from origin");
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
      queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
    },
    onError: (error) => {
      toast.error(`Pull failed: ${String(error)}`, {
        label: "Retry",
        onClick: () => pullMutation.mutate(),
      });
    },
  });

  // Fetch mutation
  const fetchMutation = useMutation({
    mutationFn: () => {
      const channel = new Channel<SyncProgress>();
      return commands.fetchFromRemote("origin", channel);
    },
    onSuccess: () => {
      toast.success("Fetched from origin");
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
    },
    onError: (error) => {
      toast.error(`Fetch failed: ${String(error)}`, {
        label: "Retry",
        onClick: () => fetchMutation.mutate(),
      });
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

  // Settings shortcut
  useHotkeys(
    "mod+,",
    (e) => {
      e.preventDefault();
      openSettings();
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

  // Push shortcut (Upload mnemonic)
  useHotkeys(
    "mod+shift+u",
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

  // Toggle amend shortcut
  useHotkeys(
    "mod+shift+m",
    (e) => {
      e.preventDefault();
      if (status) {
        document.dispatchEvent(new CustomEvent("toggle-amend"));
      }
    },
    { preventDefault: true, enabled: !!status },
  );

  // Escape - close current blade (pop blade stack)
  useHotkeys(
    "escape",
    () => {
      const bladeStore = useBladeStore.getState();
      if (bladeStore.bladeStack.length > 1) {
        bladeStore.popBlade();
      }
    },
    { enableOnFormTags: false },
  );

  // Enter - open details for selected commit in topology
  useHotkeys(
    "enter",
    () => {
      const bladeStore = useBladeStore.getState();
      const topologyStore = useTopologyStore.getState();
      if (
        bladeStore.activeProcess === "topology" &&
        topologyStore.selectedCommit &&
        bladeStore.bladeStack.length === 1
      ) {
        bladeStore.pushBlade({
          type: "commit-details",
          title: "Commit",
          props: { oid: topologyStore.selectedCommit },
        });
      }
    },
    { enableOnFormTags: false, enabled: !!status },
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
