import { GitBranch, Search } from "lucide-react";
import { openBlade } from "../lib/bladeOpener";
import { registerCommand } from "../lib/commandRegistry";
import { useCommandPaletteStore } from "../stores/commandPalette";
import { useRepositoryStore } from "../stores/repository";

registerCommand({
  id: "command-palette",
  title: "Command Palette",
  description: "Open the command palette",
  category: "Navigation",
  shortcut: "mod+shift+p",
  icon: Search,
  action: () => {
    useCommandPaletteStore.getState().toggle();
  },
});

registerCommand({
  id: "open-gitflow-cheatsheet",
  title: "Gitflow Cheatsheet",
  description: "Open the Gitflow workflow guide",
  category: "Navigation",
  icon: GitBranch,
  keywords: ["gitflow", "workflow", "guide", "branching", "reference", "cheatsheet"],
  action: () => {
    openBlade("gitflow-cheatsheet", {} as Record<string, never>);
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});
