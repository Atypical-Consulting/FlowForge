import { lazy } from "react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { renderPathBreadcrumb } from "../../core/lib/bladeUtils";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const ViewerMarkdownBlade = lazy(() =>
    import("./blades/ViewerMarkdownBlade").then((m) => ({
      default: m.ViewerMarkdownBlade,
    })),
  );

  api.registerBlade({
    type: "viewer-markdown",
    title: (props: any) => props.filePath?.split("/").pop() || "Markdown",
    component: ViewerMarkdownBlade,
    lazy: true,
    coreOverride: true,
    renderTitleContent: (props: any) => renderPathBreadcrumb(props.filePath),
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed — api.cleanup() handles blade unregistration
}
