import { lazy } from "react";
import { registerBlade } from "../../lib/bladeRegistry";
import { renderPathBreadcrumb } from "../../lib/bladeUtils";

const ViewerPlaintextBlade = lazy(() =>
  import("./ViewerPlaintextBlade").then((m) => ({
    default: m.ViewerPlaintextBlade,
  })),
);

registerBlade<{ filePath: string }>({
  type: "viewer-plaintext",
  defaultTitle: (props) => props.filePath.split("/").pop() || "Plain Text",
  component: ViewerPlaintextBlade,
  lazy: true,
  renderTitleContent: (props) => renderPathBreadcrumb(props.filePath),
});
