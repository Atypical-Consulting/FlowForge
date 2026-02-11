import { lazy } from "react";
import { registerBlade } from "../../lib/bladeRegistry";

const BranchManagerBlade = lazy(() =>
  import("./BranchManagerBlade").then((m) => ({ default: m.BranchManagerBlade })),
);

registerBlade({
  type: "branch-manager",
  defaultTitle: "Branch Manager",
  component: BranchManagerBlade,
  lazy: true,
  singleton: true,
});
