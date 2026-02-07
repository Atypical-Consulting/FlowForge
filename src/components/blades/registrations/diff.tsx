import { lazy } from "react";
import { registerBlade } from "../../../lib/bladeRegistry";
import { renderPathTitle } from "../../../lib/bladeUtils";
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
    return renderPathTitle(filePath);
  },
});
