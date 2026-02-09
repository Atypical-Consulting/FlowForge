import { lazy } from "react";
import { registerBlade } from "../../lib/bladeRegistry";
import { renderPathBreadcrumb } from "../../lib/bladeUtils";

const Viewer3dBlade = lazy(() =>
  import("./Viewer3dBlade").then((m) => ({
    default: m.Viewer3dBlade,
  })),
);

registerBlade<{ filePath: string }>({
  type: "viewer-3d",
  defaultTitle: (props) => props.filePath.split("/").pop() || "3D Model",
  component: Viewer3dBlade,
  lazy: true,
  renderTitleContent: (props) => renderPathBreadcrumb(props.filePath),
});
