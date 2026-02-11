import { registerBlade } from "../../lib/bladeRegistry";
import { StagingChangesBlade } from "./StagingChangesBlade";

registerBlade({
  type: "staging-changes",
  defaultTitle: "Changes",
  component: StagingChangesBlade,
  wrapInPanel: false,
  showBack: false,
});
