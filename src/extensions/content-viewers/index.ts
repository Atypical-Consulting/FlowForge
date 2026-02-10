import { lazy } from "react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { renderPathBreadcrumb } from "../../lib/bladeUtils";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy component imports — loaded on first blade render, not during activation
  const ViewerMarkdownBlade = lazy(() =>
    import("../../blades/viewer-markdown/ViewerMarkdownBlade").then((m) => ({
      default: m.ViewerMarkdownBlade,
    })),
  );
  const ViewerCodeBlade = lazy(() =>
    import("../../blades/viewer-code/ViewerCodeBlade").then((m) => ({
      default: m.ViewerCodeBlade,
    })),
  );
  const Viewer3dBlade = lazy(() =>
    import("../../blades/viewer-3d/Viewer3dBlade").then((m) => ({
      default: m.Viewer3dBlade,
    })),
  );

  // Register blade types with coreOverride to preserve existing blade type names
  api.registerBlade({
    type: "viewer-markdown",
    title: (props: any) => props.filePath?.split("/").pop() || "Markdown",
    component: ViewerMarkdownBlade,
    lazy: true,
    coreOverride: true,
    renderTitleContent: (props: any) => renderPathBreadcrumb(props.filePath),
  });

  api.registerBlade({
    type: "viewer-code",
    title: (props: any) => props.filePath?.split("/").pop() || "Code",
    component: ViewerCodeBlade,
    lazy: true,
    coreOverride: true,
    renderTitleContent: (props: any) => renderPathBreadcrumb(props.filePath),
  });

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
  // No custom cleanup needed — api.cleanup() handles all blade unregistrations
}
