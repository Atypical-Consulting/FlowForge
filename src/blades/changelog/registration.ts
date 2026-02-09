import { registerBlade } from "../../lib/bladeRegistry";
import { ChangelogBlade } from "./ChangelogBlade";

registerBlade({
  type: "changelog",
  defaultTitle: "Generate Changelog",
  component: ChangelogBlade,
  singleton: true,
});
