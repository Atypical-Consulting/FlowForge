import { registerBlade } from "@/framework/layout/bladeRegistry";
import { CommitListFallbackBlade } from "./CommitListFallbackBlade";

registerBlade({
  type: "commit-list-fallback",
  defaultTitle: "History",
  component: CommitListFallbackBlade,
  wrapInPanel: false,
  showBack: false,
});
