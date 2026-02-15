import { lazy } from "react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { renderPathBreadcrumb } from "../../core/lib/bladeUtils";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const ViewerNupkgBlade = lazy(() =>
    import("./blades/ViewerNupkgBlade").then((m) => ({
      default: m.ViewerNupkgBlade,
    })),
  );

  api.registerBlade({
    type: "viewer-nupkg",
    title: (props: any) => props.filePath?.split("/").pop() || "Package",
    component: ViewerNupkgBlade,
    lazy: true,
    coreOverride: true,
    renderTitleContent: (props: any) => renderPathBreadcrumb(props.filePath),
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed — api.cleanup() handles blade unregistration
}
