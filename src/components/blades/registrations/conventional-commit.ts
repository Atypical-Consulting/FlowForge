import { registerBlade } from "../../../lib/bladeRegistry";
import { ConventionalCommitBlade } from "../ConventionalCommitBlade";

registerBlade<{ amend?: boolean }>({
  type: "conventional-commit",
  defaultTitle: "Conventional Commit",
  component: ConventionalCommitBlade,
  singleton: true,
});
