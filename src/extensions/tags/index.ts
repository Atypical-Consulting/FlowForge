import { Copy, Trash2 } from "lucide-react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { toast } from "@/framework/stores/toast";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Tag components are used directly by RepositoryView sidebar.
  // The row supplies its own delete callback through `ctx.actions`, so the
  // menu goes through the same confirmation as the hover button.

  api.contributeContextMenu({
    id: "copy-name",
    label: "Copy tag name",
    icon: Copy,
    location: "tag-list",
    group: "1-clipboard",
    priority: 100,
    when: (ctx) => !!ctx.tagName,
    execute: async (ctx) => {
      if (!ctx.tagName) return;
      await navigator.clipboard.writeText(ctx.tagName);
      toast.success("Tag name copied to clipboard");
    },
  });

  api.contributeContextMenu({
    id: "delete",
    label: "Delete tag",
    icon: Trash2,
    location: "tag-list",
    group: "2-danger",
    priority: 100,
    when: (ctx) => !!ctx.actions?.delete,
    execute: (ctx) => ctx.actions?.delete?.(),
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
