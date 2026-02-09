import { lazy } from "react";
import { registerBlade } from "../../lib/bladeRegistry";
import { renderPathBreadcrumb } from "../../lib/bladeUtils";

const ViewerImageBlade = lazy(() =>
  import("./ViewerImageBlade").then((m) => ({
    default: m.ViewerImageBlade,
  })),
);

registerBlade<{ filePath: string; oid?: string }>({
  type: "viewer-image",
  defaultTitle: (props) => props.filePath.split("/").pop() || "Image",
  component: ViewerImageBlade,
  lazy: true,
  renderTitleContent: (props) => renderPathBreadcrumb(props.filePath),
});
