import { useBladeRegistry } from "../bladeRegistry";
import { getWorkflow, getDefaultWorkflowId } from "./workflowRegistry";
import type { WorkflowType, TypedBlade } from "./types";

export function rootBladeForWorkflow(workflow: WorkflowType): TypedBlade {
  const config = getWorkflow(workflow);
  if (!config) {
    // Fallback to first registered workflow
    const fallbackId = getDefaultWorkflowId();
    const fallback = getWorkflow(fallbackId);
    if (fallback) {
      return { id: "root", ...fallback.rootBlade } as TypedBlade;
    }
    return { id: "root", type: "empty" as any, title: "Empty", props: {} } as TypedBlade;
  }

  // Check if fallback needed (root blade not registered)
  if (
    config.fallbackBlade &&
    !useBladeRegistry.getState().items.has(config.rootBlade.type as string)
  ) {
    return { id: "root", ...config.fallbackBlade } as TypedBlade;
  }

  return { id: "root", ...config.rootBlade } as TypedBlade;
}
