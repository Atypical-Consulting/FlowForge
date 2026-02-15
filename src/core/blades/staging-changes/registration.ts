import { registerBlade } from "@/framework/layout/bladeRegistry";
import { StagingChangesBlade } from "./StagingChangesBlade";

registerBlade({
  type: "staging-changes",
  defaultTitle: "Changes",
  component: StagingChangesBlade,
  wrapInPanel: false,
  showBack: false,
});
