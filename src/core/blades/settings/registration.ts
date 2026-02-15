import { lazy } from "react";
import { registerBlade } from "@/framework/layout/bladeRegistry";

const SettingsBlade = lazy(() =>
  import("./SettingsBlade").then((m) => ({ default: m.SettingsBlade })),
);

registerBlade({
  type: "settings",
  defaultTitle: "Settings",
  component: SettingsBlade,
  lazy: true,
  singleton: true,
});
