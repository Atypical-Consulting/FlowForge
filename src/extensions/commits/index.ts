import { lazy } from "react";
import { Copy } from "lucide-react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { toast } from "@/framework/stores/toast";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy component import -- loaded on first blade render, not during activation
  const CommitDetailsBlade = lazy(() =>
    import("./blades/CommitDetailsBlade").then((m) => ({
      default: m.CommitDetailsBlade,
    }))
  );

  // Register blade type with coreOverride to preserve existing blade type name
  api.registerBlade({
    type: "commit-details",
    title: "Commit",
    component: CommitDetailsBlade,
    lazy: true,
    coreOverride: true,
  });

  // Contribute context menu item: Copy SHA (commit-list)
  api.contributeContextMenu({
    id: "copy-sha",
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
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
