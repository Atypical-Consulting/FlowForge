import { registerBlade } from "../../../lib/bladeRegistry";
import { InitRepoBlade } from "../InitRepoBlade";

registerBlade<{ directoryPath: string }>({
  type: "init-repo",
  defaultTitle: "Initialize Repository",
  component: InitRepoBlade,
  singleton: true,
});
