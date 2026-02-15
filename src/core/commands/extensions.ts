import { Puzzle } from "lucide-react";
import { registerCommand } from "@/framework/command-palette/commandRegistry";
import { openBlade } from "../lib/bladeOpener";

registerCommand({
  id: "open-extension-manager",
  title: "Extension Manager",
  description: "Manage installed and built-in extensions",
  category: "Settings",
  icon: Puzzle,
  keywords: ["extension", "plugin", "addon", "install"],
  action: () => {
    openBlade("extension-manager", {} as Record<string, never>);
  },
});
