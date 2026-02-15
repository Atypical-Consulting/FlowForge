import { useBladeRegistry } from "../bladeRegistry";
import type { WorkflowType, TypedBlade } from "./types";

export function rootBladeForWorkflow(workflow: WorkflowType): TypedBlade {
  if (workflow === "staging") {
    return {
      id: "root",
      type: "staging-changes",
      title: "Changes",
      props: {} as Record<string, never>,
    };
  }
  // Check if topology-graph blade is registered (extension active)
  if (useBladeRegistry.getState().items.has("topology-graph")) {
    return {
      id: "root",
      type: "topology-graph",
      title: "Topology",
      props: {} as Record<string, never>,
    };
  }
  // Fallback: simple commit list when topology extension is disabled
  return {
    id: "root",
    type: "commit-list-fallback",
    title: "History",
    props: {} as Record<string, never>,
  };
}
