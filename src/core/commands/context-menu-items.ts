/**
 * Core context menu item registrations.
 *
 * This file is a side-effect barrel — importing it registers all core context
 * menu items via useContextMenuRegistry.getState().register().
 *
 * Import this file at app startup (e.g., from App.tsx).
 */

import { Copy } from "lucide-react";
import { useContextMenuRegistry } from "../lib/contextMenuRegistry";
import { toast } from "@/framework/stores/toast";

// --- commit-list: Copy SHA ---

useContextMenuRegistry.getState().register({
  id: "core:copy-sha",
  label: "Copy SHA",
  icon: Copy,
  location: "commit-list",
  group: "clipboard",
  priority: 100,
  when: (ctx) => !!ctx.commitOid,
  execute: async (ctx) => {
    if (!ctx.commitOid) return;
    await navigator.clipboard.writeText(ctx.commitOid);
    toast.success("SHA copied to clipboard");
  },
});
