import { registerBlade } from "../../../lib/bladeRegistry";
import { renderPathBreadcrumb } from "../../../lib/bladeUtils";
import { ViewerImageBlade } from "../ViewerImageBlade";

registerBlade<{ filePath: string; oid?: string }>({
  type: "viewer-image",
  defaultTitle: (props) => props.filePath.split("/").pop() || "Image",
  component: ViewerImageBlade,
  renderTitleContent: (props) => renderPathBreadcrumb(props.filePath),
});
