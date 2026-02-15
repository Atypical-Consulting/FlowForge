import { Maximize2, PanelLeft, RotateCcw } from "lucide-react";
import { registerCommand } from "@/framework/command-palette/commandRegistry";
import { LAYOUT_PRESETS } from "@/framework/layout/layoutPresets";
import { usePreferencesStore } from "../stores/domain/preferences";
import { useGitOpsStore as useRepositoryStore } from "../stores/domain/git-ops";

// Register one command per layout preset
for (const preset of LAYOUT_PRESETS) {
  registerCommand({
    id: `layout-preset-${preset.id}`,
    title: `Layout: ${preset.label}`,
    description: preset.description,
    category: "Navigation",
    icon: preset.icon,
    action: () => {
      usePreferencesStore.getState().setActivePreset(preset.id);
    },
  });
}

registerCommand({
  id: "toggle-sidebar",
  title: "Toggle Sidebar",
  description: "Show or hide the sidebar panel",
  category: "Navigation",
  icon: PanelLeft,
  shortcut: "mod+\\",
  action: () => {
    usePreferencesStore.getState().togglePanel("sidebar");
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});

registerCommand({
  id: "reset-layout",
  title: "Reset Layout to Default",
  description: "Reset the workspace layout to the default Review preset",
  category: "Navigation",
  icon: RotateCcw,
  action: () => {
    usePreferencesStore.getState().resetLayout();
  },
});

registerCommand({
  id: "toggle-focus-mode",
  title: "Toggle Focus Mode",
  description: "Maximize the blade area or exit focus mode",
  category: "Navigation",
  icon: Maximize2,
  action: () => {
    const { layoutState, enterFocusMode, exitFocusMode } =
      usePreferencesStore.getState();
    if (layoutState.focusedPanel) {
      exitFocusMode();
    } else {
      enterFocusMode("blades");
    }
  },
  enabled: () => !!useRepositoryStore.getState().repoStatus,
});
