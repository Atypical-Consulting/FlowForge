import { registerBlade } from "../../../lib/bladeRegistry";
import { TopologyRootBlade } from "../TopologyRootBlade";

registerBlade({
  type: "topology-graph",
  defaultTitle: "Topology",
  component: TopologyRootBlade,
  wrapInPanel: false,
  showBack: false,
});
