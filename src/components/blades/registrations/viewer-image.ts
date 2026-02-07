import { registerBlade } from "../../../lib/bladeRegistry";
import { renderPathTitle } from "../../../lib/bladeUtils";
import { ViewerImageBlade } from "../ViewerImageBlade";

registerBlade<{ filePath: string; oid?: string }>({
  type: "viewer-image",
  defaultTitle: (props) => props.filePath.split("/").pop() || "Image",
  component: ViewerImageBlade,
  renderTitleContent: (props) => renderPathTitle(props.filePath),
});
