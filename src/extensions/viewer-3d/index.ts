import { lazy } from "react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { renderPathBreadcrumb } from "../../core/lib/bladeUtils";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const Viewer3dBlade = lazy(() =>
    import("./blades/Viewer3dBlade").then((m) => ({
      default: m.Viewer3dBlade,
    })),
  );

  api.registerBlade({
    type: "viewer-3d",
    title: (props: any) => props.filePath?.split("/").pop() || "3D Model",
    component: Viewer3dBlade,
    lazy: true,
    coreOverride: true,
    renderTitleContent: (props: any) => renderPathBreadcrumb(props.filePath),
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed — api.cleanup() handles blade unregistration
}
