import { lazy } from "react";
import { registerBlade } from "../../../lib/bladeRegistry";

const GitflowCheatsheetBlade = lazy(() =>
  import("../GitflowCheatsheetBlade").then((m) => ({
    default: m.GitflowCheatsheetBlade,
  })),
);

registerBlade({
  type: "gitflow-cheatsheet",
  defaultTitle: "Gitflow Guide",
  component: GitflowCheatsheetBlade,
  lazy: true,
});
