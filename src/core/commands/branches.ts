import { GitBranch } from "lucide-react";
import { registerCommand } from "@/framework/command-palette/commandRegistry";
import { useGitOpsStore as useRepositoryStore } from "../stores/domain/git-ops";

registerCommand({
  id: "create-branch",
  title: "Create Branch",
  description: "Create a new Git branch",
  category: "Branches",
  icon: GitBranch,
  action: () => {
    document.dispatchEvent(new CustomEvent("create-branch-dialog"));
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});
