import { Channel } from "@tauri-apps/api/core";
import {
  ArrowDown,
  ArrowUp,
  CloudDownload,
  FileCheck,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { gitHookBus } from "@/core/services/gitHookBus";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { toast } from "@/framework/stores/toast";
import type { SyncProgress } from "../../bindings";
import { commands as tauriCommands } from "../../bindings";
import { getErrorMessage } from "../../core/lib/errors";
import { queryClient } from "../../core/lib/queryClient";
import { useGitOpsStore as useRepositoryStore } from "../../core/stores/domain/git-ops";

// Module-level loading flags for sync operations.
let fetchLoading = false;
let pullLoading = false;
let pushLoading = false;

const whenRepoOpen = (): boolean => !!useRepositoryStore.getState().repoStatus;

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // ── Commands ──────────────────────────────────────────────

  api.registerCommand({
    id: "push",
    title: "Push",
    description: "Push commits to remote",
    category: "Sync",
    shortcut: "mod+shift+u",
    icon: ArrowUp,
    action: async () => {
      try {
        const channel = new Channel<SyncProgress>();
        const result = await tauriCommands.pushToRemote("origin", channel);
        if (result.status === "error") {
          toast.error(`Push failed: ${getErrorMessage(result.error)}`);
          return;
        }
        if (!result.data.success) {
          toast.error(`Push failed: ${result.data.message}`);
          return;
        }
        toast.success("Pushed to origin");
      } catch (error) {
        toast.error(`Push failed: ${String(error)}`);
      }
    },
    enabled: whenRepoOpen,
  });

  api.registerCommand({
    id: "pull",
    title: "Pull",
    description: "Pull changes from remote",
    category: "Sync",
    shortcut: "mod+shift+l",
    icon: ArrowDown,
    action: async () => {
      try {
        const channel = new Channel<SyncProgress>();
        const result = await tauriCommands.pullFromRemote("origin", channel);
        if (result.status === "error") {
          toast.error(`Pull failed: ${getErrorMessage(result.error)}`);
          return;
        }
        if (!result.data.success) {
          toast.error(`Pull failed: ${result.data.message}`);
          return;
        }
        toast.success("Pulled from origin");
      } catch (error) {
        toast.error(`Pull failed: ${String(error)}`);
      }
    },
    enabled: whenRepoOpen,
  });

  api.registerCommand({
    id: "fetch",
    title: "Fetch",
    description: "Fetch updates from remote",
    category: "Sync",
    shortcut: "mod+shift+f",
    icon: CloudDownload,
    action: async () => {
      try {
        const channel = new Channel<SyncProgress>();
        const result = await tauriCommands.fetchFromRemote("origin", channel);
        if (result.status === "error") {
          toast.error(`Fetch failed: ${getErrorMessage(result.error)}`);
          return;
        }
        if (!result.data.success) {
          toast.error(`Fetch failed: ${result.data.message}`);
          return;
        }
        toast.success("Fetched from origin");
      } catch (error) {
        toast.error(`Fetch failed: ${String(error)}`);
      }
    },
    enabled: whenRepoOpen,
  });

  api.registerCommand({
    id: "stage-all",
    title: "Stage All",
    description: "Stage all changes for commit",
    category: "Sync",
    shortcut: "mod+shift+a",
    icon: FileCheck,
    action: async () => {
      try {
        await tauriCommands.stageAll();
        toast.success("Staged all changes");
      } catch (error) {
        toast.error(`Failed to stage: ${String(error)}`);
      }
    },
    enabled: whenRepoOpen,
  });

  api.registerCommand({
    id: "toggle-amend",
    title: "Toggle Amend",
    description: "Toggle amend mode for next commit",
    category: "Sync",
    shortcut: "mod+shift+m",
    icon: RotateCcw,
    action: () => {
      document.dispatchEvent(new CustomEvent("toggle-amend"));
    },
    enabled: whenRepoOpen,
  });

  // ── Toolbar Actions ───────────────────────────────────────

  api.contributeToolbar({
    id: "push",
    label: "Push",
    icon: ArrowUp,
    group: "git-actions",
    priority: 40,
    shortcut: "mod+shift+U",
    when: whenRepoOpen,
    isLoading: () => pushLoading,
    execute: async () => {
      pushLoading = true;
      try {
        const channel = new Channel<SyncProgress>();
        const result = await tauriCommands.pushToRemote("origin", channel);
        if (result.status === "error") {
          toast.error(`Push failed: ${getErrorMessage(result.error)}`);
          return;
        }
        if (!result.data.success) {
          toast.error(`Push failed: ${result.data.message}`);
          return;
        }
        gitHookBus.emitDid("push");
        toast.success("Pushed to origin");
      } catch (error) {
        toast.error(`Push failed: ${String(error)}`);
      } finally {
        pushLoading = false;
      }
    },
  });

  api.contributeToolbar({
    id: "pull",
    label: "Pull",
    icon: ArrowDown,
    group: "git-actions",
    priority: 50,
    shortcut: "mod+shift+L",
    when: whenRepoOpen,
    isLoading: () => pullLoading,
    execute: async () => {
      pullLoading = true;
      try {
        const channel = new Channel<SyncProgress>();
        const result = await tauriCommands.pullFromRemote("origin", channel);
        if (result.status === "error") {
          toast.error(`Pull failed: ${getErrorMessage(result.error)}`);
          return;
        }
        if (!result.data.success) {
          toast.error(`Pull failed: ${result.data.message}`);
          return;
        }
        gitHookBus.emitDid("pull");
        toast.success("Pulled from origin");
      } catch (error) {
        toast.error(`Pull failed: ${String(error)}`);
      } finally {
        pullLoading = false;
      }
    },
  });

  api.contributeToolbar({
    id: "fetch",
    label: "Fetch",
    icon: CloudDownload,
    group: "git-actions",
    priority: 60,
    shortcut: "mod+shift+F",
    when: whenRepoOpen,
    isLoading: () => fetchLoading,
    execute: async () => {
      fetchLoading = true;
      try {
        const channel = new Channel<SyncProgress>();
        const result = await tauriCommands.fetchFromRemote("origin", channel);
        if (result.status === "error") {
          toast.error(`Fetch failed: ${getErrorMessage(result.error)}`);
          return;
        }
        if (!result.data.success) {
          toast.error(`Fetch failed: ${result.data.message}`);
          return;
        }
        gitHookBus.emitDid("fetch");
        toast.success("Fetched from origin");
      } catch (error) {
        toast.error(`Fetch failed: ${String(error)}`);
      } finally {
        fetchLoading = false;
      }
    },
  });

  api.contributeToolbar({
    id: "undo",
    label: "Undo",
    icon: Undo2,
    group: "git-actions",
    priority: 80,
    when: () =>
      !!useRepositoryStore.getState().repoStatus &&
      !!useRepositoryStore.getState().undoInfo?.canUndo,
    isLoading: () => useRepositoryStore.getState().undoIsUndoing,
    execute: async () => {
      const { undoInfo, performUndo } = useRepositoryStore.getState();
      if (!undoInfo?.canUndo) return;

      const confirmed = window.confirm(
        `Are you sure you want to undo?\n\n${undoInfo.description}`,
      );

      if (confirmed) {
        const success = await performUndo();
        if (success) {
          queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
          queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
          queryClient.invalidateQueries({ queryKey: ["repositoryStatus"] });
        }
      }
    },
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
