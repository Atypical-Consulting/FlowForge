import { lazy } from "react";
import { registerBlade } from "../../lib/bladeRegistry";

const ConventionalCommitBlade = lazy(() =>
  import("./ConventionalCommitBlade").then((m) => ({
    default: m.ConventionalCommitBlade,
  })),
);

registerBlade<{ amend?: boolean }>({
  type: "conventional-commit",
  defaultTitle: "Conventional Commit",
  component: ConventionalCommitBlade,
  lazy: true,
  singleton: true,
});
