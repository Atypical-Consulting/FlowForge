import { lazy } from "react";
import { registerBlade } from "../../../lib/bladeRegistry";

const RepoBrowserBlade = lazy(() =>
  import("../RepoBrowserBlade").then((m) => ({
    default: m.RepoBrowserBlade,
  })),
);

registerBlade<{ path?: string }>({
  type: "repo-browser",
  defaultTitle: "Repository Browser",
  component: RepoBrowserBlade,
  lazy: true,
});
