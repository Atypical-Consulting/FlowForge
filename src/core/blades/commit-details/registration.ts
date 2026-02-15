import { lazy } from "react";
import { registerBlade } from "@/framework/layout/bladeRegistry";

const CommitDetailsBlade = lazy(() =>
  import("./CommitDetailsBlade").then((m) => ({
    default: m.CommitDetailsBlade,
  })),
);

registerBlade<{ oid: string }>({
  type: "commit-details",
  defaultTitle: "Commit",
  component: CommitDetailsBlade,
  lazy: true,
});
