import { useBladeRegistry } from "../bladeRegistry";
import type { ProcessType, TypedBlade } from "./types";

export function rootBladeForProcess(process: ProcessType): TypedBlade {
  if (process === "staging") {
    return {
      id: "root",
      type: "staging-changes",
      title: "Changes",
      props: {} as Record<string, never>,
    };
  }
  // Check if topology-graph blade is registered (extension active)
  if (useBladeRegistry.getState().blades.has("topology-graph")) {
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
