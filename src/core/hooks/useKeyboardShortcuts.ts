import { Channel } from "@tauri-apps/api/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useHotkeys } from "react-hotkeys-hook";
import { type SyncProgress, commands } from "../../bindings";
import { openBlade } from "../lib/bladeOpener";
import { useBladeRegistry } from "@/framework/layout/bladeRegistry";
import { executeCommand } from "@/framework/command-palette/commandRegistry";
import { getNavigationActor } from "@/framework/layout/navigation/context";
import { useUIStore as useCommandPaletteStore } from "../stores/domain/ui-state";
import { useGitOpsStore as useRepositoryStore } from "../stores/domain/git-ops";
import { useGitOpsStore as useTopologyStore } from "../stores/domain/git-ops";
import { usePreferencesStore } from "../stores/domain/preferences";
import { toast } from "@/framework/stores/toast";

/**
 * Keyboard shortcuts for common Git operations.
 *
 * Shortcuts:
 * - Cmd/Ctrl+O: Open repository
 * - Cmd/Ctrl+,: Open settings
 * - Cmd/Ctrl+Shift+A: Stage all files
 * - Cmd/Ctrl+K: Open command palette
 * - Cmd/Ctrl+Shift+P: Open command palette
 * - Cmd/Ctrl+Shift+U: Push (Upload)
 * - Cmd/Ctrl+Shift+L: Pull (L for "pull Latest")
 * - Cmd/Ctrl+Shift+F: Fetch
 * - Cmd/Ctrl+Shift+M: Toggle amend commit
 * - Cmd/Ctrl+\: Toggle sidebar visibility
 * - Escape: Exit focus mode (if active), else pop blade
 * - Backspace: Pop blade (navigate back)
 */
export function useKeyboardShortcuts() {
  const queryClient = useQueryClient();
  const { repoStatus: status } = useRepositoryStore();

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
      openBlade("settings", {} as Record<string, never>);
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

  // Command palette shortcut
  useHotkeys(
    "mod+shift+p",
    (e) => {
      e.preventDefault();
      useCommandPaletteStore.getState().togglePalette();
    },
    { preventDefault: true },
  );

  // Command palette shortcut (discoverable alias)
  useHotkeys(
    "mod+k",
    (e) => {
      e.preventDefault();
      useCommandPaletteStore.getState().togglePalette();
    },
    { preventDefault: true },
  );

  // Escape - exit focus mode or close current blade (pop blade stack)
  useHotkeys(
    "escape",
    () => {
      // Priority 1: Don't pop blade if command palette is open
      if (useCommandPaletteStore.getState().paletteIsOpen) return;

      // Priority 2: Exit focus mode if active
      const { layoutState, exitFocusMode } = usePreferencesStore.getState();
      if (layoutState.focusedPanel) {
        exitFocusMode();
        return;
      }

      // Priority 3: Pop blade stack
      getNavigationActor().send({ type: "POP_BLADE" });
    },
    { enableOnFormTags: false },
  );

  // Backspace - navigate back (pop blade stack)
  useHotkeys(
    "backspace",
    () => {
      if (useCommandPaletteStore.getState().paletteIsOpen) return;
      getNavigationActor().send({ type: "POP_BLADE" });
    },
    { enableOnFormTags: false },
  );

  // New Repository shortcut
  useHotkeys(
    "mod+n",
    (e) => {
      e.preventDefault();
      executeCommand("ext:init-repo:init-repository");
    },
    { preventDefault: true },
  );

  // Clone Repository shortcut
  useHotkeys(
    "mod+shift+o",
    (e) => {
      e.preventDefault();
      executeCommand("clone-repository");
    },
    { preventDefault: true },
  );

  // Toggle sidebar visibility
  useHotkeys(
    "mod+\\",
    (e) => {
      e.preventDefault();
      if (status) {
        usePreferencesStore.getState().togglePanel("sidebar");
      }
    },
    { preventDefault: true, enabled: !!status },
  );

  // Show Changes (staging) shortcut
  useHotkeys(
    "mod+1",
    (e) => {
      e.preventDefault();
      if (status) {
        getNavigationActor().send({ type: "SWITCH_PROCESS", process: "staging" });
      }
    },
    { preventDefault: true, enabled: !!status },
  );

  // Show History (topology) shortcut -- only when topology extension is active
  useHotkeys(
    "mod+2",
    (e) => {
      e.preventDefault();
      if (status && useBladeRegistry.getState().blades.has("topology-graph")) {
        getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
      }
    },
    { preventDefault: true, enabled: !!status },
  );

  // Show Branches shortcut
  useHotkeys(
    "mod+b",
    (e) => {
      e.preventDefault();
      if (status) {
        executeCommand("show-branches");
      }
    },
    { preventDefault: true, enabled: !!status },
  );

  // New Branch shortcut
  useHotkeys(
    "mod+shift+n",
    (e) => {
      e.preventDefault();
      if (status) {
        executeCommand("create-branch");
      }
    },
    { preventDefault: true, enabled: !!status },
  );

  // Enter - open details for selected commit in topology (only when extension active)
  useHotkeys(
    "enter",
    () => {
      if (!useBladeRegistry.getState().blades.has("topology-graph")) return;
      const ctx = getNavigationActor().getSnapshot().context;
      const topologyStore = useTopologyStore.getState();
      if (
        ctx.activeProcess === "topology" &&
        topologyStore.topologySelectedCommit &&
        ctx.bladeStack.length === 1
      ) {
        openBlade("commit-details", { oid: topologyStore.topologySelectedCommit });
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
