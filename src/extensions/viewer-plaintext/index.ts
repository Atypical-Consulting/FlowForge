import { lazy } from "react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { renderPathBreadcrumb } from "../../core/lib/bladeUtils";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const ViewerPlaintextBlade = lazy(() =>
    import("./blades/ViewerPlaintextBlade").then((m) => ({
      default: m.ViewerPlaintextBlade,
    })),
  );

  api.registerBlade({
    type: "viewer-plaintext",
    title: (props: any) => props.filePath?.split("/").pop() || "Plain Text",
    component: ViewerPlaintextBlade,
    lazy: true,
    coreOverride: true,
    renderTitleContent: (props: any) => renderPathBreadcrumb(props.filePath),
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed — api.cleanup() handles blade unregistration
}
