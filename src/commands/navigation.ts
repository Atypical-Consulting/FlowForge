import { Search } from "lucide-react";
import { registerCommand } from "../lib/commandRegistry";
import { useCommandPaletteStore } from "../stores/commandPalette";

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
