import { lazy } from "react";
import { registerBlade } from "@/framework/layout/bladeRegistry";

const ExtensionManagerBlade = lazy(() =>
  import("./ExtensionManagerBlade").then((m) => ({ default: m.ExtensionManagerBlade })),
);

registerBlade({
  type: "extension-manager",
  defaultTitle: "Extension Manager",
  component: ExtensionManagerBlade,
  lazy: true,
  singleton: true,
});
