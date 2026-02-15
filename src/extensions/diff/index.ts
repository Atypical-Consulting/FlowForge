import { lazy } from "react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { renderPathBreadcrumb } from "../../core/lib/bladeUtils";
import type { DiffSource } from "../../core/blades/diff/types";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const DiffBlade = lazy(() =>
    import("../../core/blades/diff/DiffBlade").then((m) => ({
      default: m.DiffBlade,
    }))
  );

  api.registerBlade({
    type: "diff",
    title: "Diff",
    component: DiffBlade,
    lazy: true,
    coreOverride: true,
    renderTitleContent: (props: { source: DiffSource }) => {
      const filePath =
        "filePath" in props.source ? props.source.filePath : "Diff";
      return renderPathBreadcrumb(filePath);
    },
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
