import { lazy } from "react";
import { registerBlade } from "../../../lib/bladeRegistry";

const ViewerMarkdownBlade = lazy(() =>
  import("../ViewerMarkdownBlade").then((m) => ({
    default: m.ViewerMarkdownBlade,
  })),
);

registerBlade<{ filePath: string }>({
  type: "viewer-markdown",
  defaultTitle: (props) => props.filePath.split("/").pop() || "Markdown",
  component: ViewerMarkdownBlade,
  lazy: true,
});
