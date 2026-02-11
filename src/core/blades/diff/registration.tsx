import { lazy } from "react";
import { registerBlade } from "../../lib/bladeRegistry";
import { renderPathBreadcrumb } from "../../lib/bladeUtils";
import type { DiffSource } from "./types";

const DiffBlade = lazy(() =>
  import("./DiffBlade").then((m) => ({ default: m.DiffBlade })),
);

registerBlade<{ source: DiffSource }>({
  type: "diff",
  defaultTitle: "Diff",
  component: DiffBlade,
  lazy: true,
  renderTitleContent: (props) => {
    const filePath =
      "filePath" in props.source ? props.source.filePath : "Diff";
    return renderPathBreadcrumb(filePath);
  },
});
