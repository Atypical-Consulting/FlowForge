import { lazy } from "react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { renderPathBreadcrumb } from "../../core/lib/bladeUtils";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const ViewerImageBlade = lazy(() =>
    import("./blades/ViewerImageBlade").then((m) => ({
      default: m.ViewerImageBlade,
    })),
  );

  api.registerBlade({
    type: "viewer-image",
    title: (props: any) => props.filePath?.split("/").pop() || "Image",
    component: ViewerImageBlade,
    lazy: true,
    coreOverride: true,
    renderTitleContent: (props: any) => renderPathBreadcrumb(props.filePath),
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed — api.cleanup() handles blade unregistration
}
