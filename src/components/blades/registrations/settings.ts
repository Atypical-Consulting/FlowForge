import { registerBlade } from "../../../lib/bladeRegistry";
import { SettingsBlade } from "../SettingsBlade";

registerBlade({
  type: "settings",
  defaultTitle: "Settings",
  component: SettingsBlade,
});
