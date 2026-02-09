import { lazy } from "react";
import { registerBlade } from "../../lib/bladeRegistry";
import { renderPathBreadcrumb } from "../../lib/bladeUtils";

const ViewerCodeBlade = lazy(() =>
  import("./ViewerCodeBlade").then((m) => ({
    default: m.ViewerCodeBlade,
  })),
);

registerBlade<{ filePath: string }>({
  type: "viewer-code",
  defaultTitle: (props) => props.filePath.split("/").pop() || "Code",
  component: ViewerCodeBlade,
  lazy: true,
  renderTitleContent: (props) => renderPathBreadcrumb(props.filePath),
});
