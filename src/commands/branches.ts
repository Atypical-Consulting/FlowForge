import { GitBranch } from "lucide-react";
import { registerCommand } from "../lib/commandRegistry";
import { useRepositoryStore } from "../stores/repository";

registerCommand({
  id: "create-branch",
  title: "Create Branch",
  description: "Create a new Git branch",
  category: "Branches",
  icon: GitBranch,
  action: () => {
    document.dispatchEvent(new CustomEvent("create-branch-dialog"));
  },
  enabled: () => !!useRepositoryStore.getState().status,
});
