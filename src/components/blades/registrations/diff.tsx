import { lazy } from "react";
import { registerBlade } from "../../../lib/bladeRegistry";
import type { DiffSource } from "../DiffBlade";

const DiffBlade = lazy(() =>
  import("../DiffBlade").then((m) => ({ default: m.DiffBlade })),
);

registerBlade<{ source: DiffSource }>({
  type: "diff",
  defaultTitle: "Diff",
  component: DiffBlade,
  lazy: true,
  renderTitleContent: (props) => {
    const filePath =
      "filePath" in props.source ? props.source.filePath : "Diff";
    const lastSlash = filePath.lastIndexOf("/");
    if (lastSlash === -1) {
      return (
        <span className="text-sm font-semibold text-ctp-text truncate">
          {filePath}
        </span>
      );
    }
    return (
      <span className="text-sm truncate">
        <span className="text-ctp-overlay1">
          {filePath.slice(0, lastSlash + 1)}
        </span>
        <span className="font-semibold text-ctp-text">
          {filePath.slice(lastSlash + 1)}
        </span>
      </span>
    );
  },
});
