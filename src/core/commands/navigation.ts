import { FileText, History, Search } from "lucide-react";
import { registerCommand } from "@/framework/command-palette/commandRegistry";
import { usePaletteStore as useCommandPaletteStore } from "@/framework/command-palette/paletteStore";
import { getNavigationActor } from "@/framework/layout/navigation/context";
import { showTopologyView } from "../lib/topologyNavigation";
import { useGitOpsStore as useRepositoryStore } from "../stores/domain/git-ops";

registerCommand({
  id: "command-palette",
  title: "Command Palette",
  description: "Open the command palette",
  category: "Navigation",
  shortcut: "mod+k",
  icon: Search,
  action: () => {
    useCommandPaletteStore.getState().togglePalette();
  },
});

registerCommand({
  id: "show-changes",
  title: "Show Changes",
  description: "Switch to the staging (changes) view",
  category: "Navigation",
  shortcut: "mod+1",
  icon: FileText,
  action: () => {
    getNavigationActor().send({ type: "SWITCH_WORKFLOW", workflow: "staging" });
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});

registerCommand({
  id: "show-history",
  title: "Show History",
  description:
    "Switch to the topology view on its History tab (Ctrl/Cmd+2; Ctrl/Cmd+1 shows Changes)",
  category: "Navigation",
  shortcut: "mod+2",
  icon: History,
  action: () => {
    showTopologyView("history");
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});
