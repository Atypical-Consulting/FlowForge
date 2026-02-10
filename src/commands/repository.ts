import {
  FolderOpen,
  GitFork,
  RefreshCw,
  X,
} from "lucide-react";
import { registerCommand } from "../lib/commandRegistry";
import { useBranchStore } from "../stores/branches";
import { useRepositoryStore } from "../stores/repository";
import { useStashStore } from "../stores/stash";
import { useTagStore } from "../stores/tags";

registerCommand({
  id: "open-repository",
  title: "Open Repository",
  description: "Open a local Git repository",
  category: "Repository",
  shortcut: "mod+o",
  icon: FolderOpen,
  action: () => {
    document.dispatchEvent(new CustomEvent("open-repository-dialog"));
  },
});

registerCommand({
  id: "close-repository",
  title: "Close Repository",
  description: "Close the current repository",
  category: "Repository",
  icon: X,
  action: () => {
    useRepositoryStore.getState().closeRepository();
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});

registerCommand({
  id: "clone-repository",
  title: "Clone Repository",
  description: "Clone a remote Git repository",
  category: "Repository",
  icon: GitFork,
  action: () => {
    document.dispatchEvent(new CustomEvent("clone-repository-dialog"));
  },
});

registerCommand({
  id: "refresh-all",
  title: "Refresh All",
  description: "Refresh branches, stashes, and tags",
  category: "Repository",
  icon: RefreshCw,
  action: () => {
    Promise.all([
      useBranchStore.getState().loadBranches(),
      useStashStore.getState().loadStashes(),
      useTagStore.getState().loadTags(),
    ]);
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});
