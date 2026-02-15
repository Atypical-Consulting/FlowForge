/**
 * Core toolbar action registrations.
 *
 * This file is a side-effect barrel — importing it registers all core toolbar
 * actions via useToolbarRegistry.getState().registerMany().
 *
 * Actions for repository, branches, sync, and diff are now registered by their
 * respective extensions under src/extensions/.
 *
 * Import this file at app startup (e.g., from App.tsx or commands/index.ts).
 */

import { createElement } from "react";
import {
  Palette,
  Search,
  Settings,
} from "lucide-react";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { openBlade } from "@/framework/layout/bladeOpener";
import type { ToolbarAction } from "@/framework/extension-system/toolbarRegistry";
import { useToolbarRegistry } from "@/framework/extension-system/toolbarRegistry";
import { usePaletteStore as useCommandPaletteStore } from "@/framework/command-palette/paletteStore";

// --- Core Actions ---

const coreActions: ToolbarAction[] = [
  // ──────────────────────────────────────────────
  // App group
  // ──────────────────────────────────────────────

  {
    id: "tb:settings",
    label: "Settings",
    icon: Settings,
    group: "app",
    priority: 90,
    shortcut: "mod+,",
    source: "core",
    execute: () => {
      openBlade("settings", {} as Record<string, never>);
    },
  },

  {
    id: "tb:command-palette",
    label: "Command Palette",
    icon: Search,
    group: "app",
    priority: 80,
    shortcut: "mod+shift+P",
    source: "core",
    execute: () => {
      useCommandPaletteStore.getState().togglePalette();
    },
  },

  {
    id: "tb:theme-toggle",
    label: "Theme",
    icon: Palette,
    group: "app",
    priority: 70,
    source: "core",
    execute: () => {},
    renderCustom: () => createElement(ThemeToggle),
  },
];

// --- Register all core actions in a single batch ---

useToolbarRegistry.getState().registerMany(coreActions);
