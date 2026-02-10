import { Search } from "lucide-react";
import { registerCommand } from "../lib/commandRegistry";
import { useUIStore as useCommandPaletteStore } from "../stores/domain/ui-state";

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
