import { Channel } from "@tauri-apps/api/core";
import {
  ArrowDown,
  ArrowUp,
  CloudDownload,
  FileCheck,
  RotateCcw,
} from "lucide-react";
import type { SyncProgress } from "../../bindings";
import { commands as tauriCommands } from "../../bindings";
import { registerCommand } from "../lib/commandRegistry";
import { useGitOpsStore as useRepositoryStore } from "../stores/domain/git-ops";
import { toast } from "../stores/toast";

registerCommand({
  id: "push",
  title: "Push",
  description: "Push commits to remote",
  category: "Sync",
  shortcut: "mod+shift+u",
  icon: ArrowUp,
  action: async () => {
    try {
      const channel = new Channel<SyncProgress>();
      await tauriCommands.pushToRemote("origin", channel);
      toast.success("Pushed to origin");
    } catch (error) {
      toast.error(`Push failed: ${String(error)}`);
    }
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});

registerCommand({
  id: "pull",
  title: "Pull",
  description: "Pull changes from remote",
  category: "Sync",
  shortcut: "mod+shift+l",
  icon: ArrowDown,
  action: async () => {
    try {
      const channel = new Channel<SyncProgress>();
      await tauriCommands.pullFromRemote("origin", channel);
      toast.success("Pulled from origin");
    } catch (error) {
      toast.error(`Pull failed: ${String(error)}`);
    }
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});

registerCommand({
  id: "fetch",
  title: "Fetch",
  description: "Fetch updates from remote",
  category: "Sync",
  shortcut: "mod+shift+f",
  icon: CloudDownload,
  action: async () => {
    try {
      const channel = new Channel<SyncProgress>();
      await tauriCommands.fetchFromRemote("origin", channel);
      toast.success("Fetched from origin");
    } catch (error) {
      toast.error(`Fetch failed: ${String(error)}`);
    }
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});

registerCommand({
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
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});

registerCommand({
  id: "toggle-amend",
  title: "Toggle Amend",
  description: "Toggle amend mode for next commit",
  category: "Sync",
  shortcut: "mod+shift+m",
  icon: RotateCcw,
  action: () => {
    document.dispatchEvent(new CustomEvent("toggle-amend"));
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});
