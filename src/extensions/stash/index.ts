import { Download, Play, Trash2 } from "lucide-react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Stash components are used directly by RepositoryView sidebar.
  // The row supplies its own apply/pop/drop callbacks through
  // `ctx.actions`, so these items reuse the exact handlers (and the drop
  // confirmation) that the hover buttons already go through.

  api.contributeContextMenu({
    id: "apply",
    label: "Apply (keep stash)",
    icon: Download,
    location: "stash-list",
    group: "1-stash",
    priority: 100,
    when: (ctx) => !!ctx.actions?.apply,
    execute: (ctx) => ctx.actions?.apply?.(),
  });

  api.contributeContextMenu({
    id: "pop",
    label: "Pop (apply and remove)",
    icon: Play,
    location: "stash-list",
    group: "1-stash",
    priority: 90,
    when: (ctx) => !!ctx.actions?.pop,
    execute: (ctx) => ctx.actions?.pop?.(),
  });

  api.contributeContextMenu({
    id: "drop",
    label: "Drop (discard)",
    icon: Trash2,
    location: "stash-list",
    group: "2-danger",
    priority: 100,
    when: (ctx) => !!ctx.actions?.drop,
    execute: (ctx) => ctx.actions?.drop?.(),
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
