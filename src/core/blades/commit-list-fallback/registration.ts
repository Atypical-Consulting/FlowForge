import { registerBlade } from "../../lib/bladeRegistry";
import { CommitListFallbackBlade } from "./CommitListFallbackBlade";

registerBlade({
  type: "commit-list-fallback",
  defaultTitle: "History",
  component: CommitListFallbackBlade,
  wrapInPanel: false,
  showBack: false,
});
