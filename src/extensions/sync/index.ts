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
import { queryClient } from "../../core/lib/queryClient";
import {
  isRepositoryOpen,
  useGitOpsStore as useRepositoryStore,
} from "../../core/stores/domain/git-ops";
import {
  describeSyncResult,
  formatSyncException,
  type SyncOperation,
} from "./lib/syncMessages";

// Module-level loading flags for sync operations.
let fetchLoading = false;
let pullLoading = false;
let pushLoading = false;

const whenRepoOpen = isRepositoryOpen;

const SYNC_COMMANDS = {
  push: tauriCommands.pushToRemote,
  pull: tauriCommands.pullFromRemote,
  fetch: tauriCommands.fetchFromRemote,
} as const;

/**
 * Run a sync operation against `remote` and toast its outcome.
 *
 * The toast text comes from the backend result (branch, remote, counts), so
 * it stays correct even when the toolbar's branch display is stale.
 * Returns true when the operation succeeded.
 */
async function runSync(
  operation: SyncOperation,
  remote = "origin",
): Promise<boolean> {
  try {
    const channel = new Channel<SyncProgress>();
    const result = await SYNC_COMMANDS[operation](remote, channel);
    const outcome = describeSyncResult(operation, result, remote);
    if (outcome.ok) {
      toast.success(outcome.message);
    } else {
      toast.error(outcome.message);
    }
    return outcome.ok;
  } catch (error) {
    toast.error(formatSyncException(operation, error));
    return false;
  }
}

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
      await runSync("push");
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
      await runSync("pull");
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
      await runSync("fetch");
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
    commandId: "ext:sync:push",
    when: whenRepoOpen,
    isLoading: () => pushLoading,
    execute: async () => {
      pushLoading = true;
      try {
        if (await runSync("push")) {
          gitHookBus.emitDid("push");
        }
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
    commandId: "ext:sync:pull",
    when: whenRepoOpen,
    isLoading: () => pullLoading,
    execute: async () => {
      pullLoading = true;
      try {
        if (await runSync("pull")) {
          gitHookBus.emitDid("pull");
        }
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
    commandId: "ext:sync:fetch",
    when: whenRepoOpen,
    isLoading: () => fetchLoading,
    execute: async () => {
      fetchLoading = true;
      try {
        if (await runSync("fetch")) {
          gitHookBus.emitDid("fetch");
        }
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
      isRepositoryOpen() && !!useRepositoryStore.getState().undoInfo?.canUndo,
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
