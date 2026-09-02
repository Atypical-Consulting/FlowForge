import { useBladeRegistry } from "../bladeRegistry";
import type { TypedBlade, WorkflowType } from "./types";
import { getDefaultWorkflowId, getWorkflow } from "./workflowRegistry";

/**
 * Blade type of the placeholder root used when *no* workflow is registered.
 *
 * This is strictly a last resort: as soon as any workflow is registered the
 * navigation actor receives WORKFLOWS_CHANGED and replaces this root with the
 * default workflow's root blade (see context.tsx).
 */
export const EMPTY_BLADE_TYPE = "empty";

/**
 * Resolve a workflow id to one that is actually registered.
 *
 * Unknown ids — "" when the actor was created before any workflow was
 * registered, or a persisted workflow whose extension is no longer available —
 * fall back to the default workflow. Returns "" only when nothing is
 * registered at all.
 */
export function resolveWorkflowId(workflow: WorkflowType): WorkflowType {
  return getWorkflow(workflow) ? workflow : getDefaultWorkflowId();
}

/** True when the blade is the placeholder root created with no workflows registered. */
export function isEmptyRootBlade(blade: TypedBlade | undefined): boolean {
  return !blade || (blade.type as string) === EMPTY_BLADE_TYPE;
}

export function rootBladeForWorkflow(workflow: WorkflowType): TypedBlade {
  const config = getWorkflow(resolveWorkflowId(workflow));
  if (!config) {
    // Nothing registered yet — placeholder until WORKFLOWS_CHANGED heals it.
    return {
      id: "root",
      type: EMPTY_BLADE_TYPE as any,
      title: "Empty",
      props: {},
    } as TypedBlade;
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
