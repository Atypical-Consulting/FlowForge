import { lazy } from "react";
import { registerBlade } from "../../../lib/bladeRegistry";

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
  renderTitleContent: (props) => {
    if (!props.path) return null;
    const path = props.path;
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) {
      return (
        <span className="text-sm font-semibold text-ctp-text truncate">
          {path}
        </span>
      );
    }
    return (
      <span className="text-sm truncate">
        <span className="text-ctp-overlay1">
          {path.slice(0, lastSlash + 1)}
        </span>
        <span className="font-semibold text-ctp-text">
          {path.slice(lastSlash + 1)}
        </span>
      </span>
    );
  },
});
