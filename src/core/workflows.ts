import { registerWorkflow } from "@/framework/layout/navigation/workflowRegistry";

// Ensure blade type augmentation is loaded
import "./stores/bladeTypes";

registerWorkflow({
  id: "staging",
  label: "Staging",
  rootBlade: {
    type: "staging-changes",
    title: "Changes",
    props: {} as Record<string, never>,
  },
});

registerWorkflow({
  id: "topology",
  label: "Topology",
  rootBlade: {
    type: "topology-graph",
    title: "Topology",
    props: {} as Record<string, never>,
  },
  fallbackBlade: {
    type: "commit-list-fallback",
    title: "History",
    props: {} as Record<string, never>,
  },
});
