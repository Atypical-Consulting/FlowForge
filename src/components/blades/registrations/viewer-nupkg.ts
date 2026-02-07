import { registerBlade } from "../../../lib/bladeRegistry";
import { ViewerNupkgBlade } from "../ViewerNupkgBlade";

registerBlade<{ filePath: string }>({
  type: "viewer-nupkg",
  defaultTitle: (props) => props.filePath.split("/").pop() || "Package",
  component: ViewerNupkgBlade,
});
