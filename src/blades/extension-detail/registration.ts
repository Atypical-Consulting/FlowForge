import { lazy } from "react";
import { registerBlade } from "../../lib/bladeRegistry";

const ExtensionDetailBlade = lazy(() =>
  import("./ExtensionDetailBlade").then((m) => ({
    default: m.ExtensionDetailBlade,
  })),
);

registerBlade<{ extensionId: string }>({
  type: "extension-detail",
  defaultTitle: "Extension",
  component: ExtensionDetailBlade,
  lazy: true,
});
