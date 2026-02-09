import { lazy } from "react";
import { registerBlade } from "../../lib/bladeRegistry";
import { BladeBreadcrumb } from "../_shared/BladeBreadcrumb";

const RepoBrowserBlade = lazy(() =>
  import("./RepoBrowserBlade").then((m) => ({
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
  singleton: true,
  renderTitleContent: (props) => (
    <BladeBreadcrumb path={props.path || ""} />
  ),
});
