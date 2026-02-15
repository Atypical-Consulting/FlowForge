import { lazy } from "react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { renderPathBreadcrumb } from "../../core/lib/bladeUtils";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const ViewerCodeBlade = lazy(() =>
    import("./blades/ViewerCodeBlade").then((m) => ({
      default: m.ViewerCodeBlade,
    })),
  );

  api.registerBlade({
    type: "viewer-code",
    title: (props: any) => props.filePath?.split("/").pop() || "Code",
    component: ViewerCodeBlade,
    lazy: true,
    coreOverride: true,
    renderTitleContent: (props: any) => renderPathBreadcrumb(props.filePath),
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed — api.cleanup() handles blade unregistration
}
