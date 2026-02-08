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
  return {
    id: "root",
    type: "topology-graph",
    title: "Topology",
    props: {} as Record<string, never>,
  };
}
