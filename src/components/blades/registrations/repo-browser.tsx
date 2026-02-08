import { lazy } from "react";
import { registerBlade } from "../../../lib/bladeRegistry";
import { BladeBreadcrumb } from "../BladeBreadcrumb";

const RepoBrowserBlade = lazy(() =>
  import("../RepoBrowserBlade").then((m) => ({
    default: m.RepoBrowserBlade,
  })),
);

registerBlade<{ path?: string }>({
  type: "repo-browser",
  defaultTitle: (props) => {
    if (!props.path) return "Repository Browser";
    return props.path.split("/").pop() || "Repository Browser";
  },
  component: RepoBrowserBlade,
  lazy: true,
  renderTitleContent: (props) => (
    <BladeBreadcrumb path={props.path || ""} />
  ),
});
