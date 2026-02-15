import { FileText, GitBranch, History, Search } from "lucide-react";
import { registerCommand } from "@/framework/command-palette/commandRegistry";
import { useBladeRegistry } from "@/framework/layout/bladeRegistry";
import { getNavigationActor } from "@/framework/layout/navigation/context";
import { useGitOpsStore as useRepositoryStore } from "../stores/domain/git-ops";
import { usePreferencesStore } from "../stores/domain/preferences";
import { usePaletteStore as useCommandPaletteStore } from "@/framework/command-palette/paletteStore";

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
    getNavigationActor().send({ type: "SWITCH_PROCESS", process: "staging" });
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});

registerCommand({
  id: "show-history",
  title: "Show History",
  description: "Switch to the topology (history) view",
  category: "Navigation",
  shortcut: "mod+2",
  icon: History,
  action: () => {
    const hasTopology = useBladeRegistry.getState().blades.has("topology-graph");
    if (hasTopology) {
      getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
    }
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});

registerCommand({
  id: "show-branches",
  title: "Show Branches",
  description: "Toggle the branches dropdown",
  category: "Navigation",
  shortcut: "mod+b",
  icon: GitBranch,
  action: () => {
    usePreferencesStore.getState().toggleNavBranchDropdown();
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});

registerCommand({
  id: "open-branch-manager",
  title: "Open Branch Manager",
  description: "Open the branch management blade",
  category: "Navigation",
  shortcut: "mod+shift+b",
  icon: GitBranch,
  action: () => {
    getNavigationActor().send({
      type: "PUSH_BLADE",
      bladeType: "branch-manager" as const,
      title: "Branch Manager",
      props: {},
    });
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});
