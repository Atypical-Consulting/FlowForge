import { registerBlade } from "../../../lib/bladeRegistry";
import { renderPathBreadcrumb } from "../../../lib/bladeUtils";
import { ViewerNupkgBlade } from "../ViewerNupkgBlade";

registerBlade<{ filePath: string }>({
  type: "viewer-nupkg",
  defaultTitle: (props) => props.filePath.split("/").pop() || "Package",
  component: ViewerNupkgBlade,
  renderTitleContent: (props) => renderPathBreadcrumb(props.filePath),
});
