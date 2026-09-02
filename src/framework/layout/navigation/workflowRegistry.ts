import type { TypedBlade } from "../bladeTypes";

export interface WorkflowConfig {
  id: string;
  label: string;
  rootBlade: Omit<TypedBlade, "id">;
  /** If the root blade type isn't registered, use this fallback */
  fallbackBlade?: Omit<TypedBlade, "id">;
}

export type WorkflowRegistryListener = () => void;

/** Default workflow ID (first registered workflow) */
let defaultWorkflowId: string | null = null;

const workflows = new Map<string, WorkflowConfig>();
const listeners = new Set<WorkflowRegistryListener>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function registerWorkflow(config: WorkflowConfig): void {
  workflows.set(config.id, config);
  if (!defaultWorkflowId) defaultWorkflowId = config.id;
  notify();
}

export function getWorkflow(id: string): WorkflowConfig | undefined {
  return workflows.get(id);
}

export function getDefaultWorkflowId(): string {
  return defaultWorkflowId ?? "";
}

export function getAllWorkflows(): WorkflowConfig[] {
  return Array.from(workflows.values());
}

/**
 * Subscribe to registry changes (register/clear).
 *
 * The navigation actor uses this to heal itself when workflows are registered
 * after it was created: in production the actor's shared chunk can be
 * evaluated before the entry chunk that registers the workflows, so the
 * registry must never be assumed to be populated at actor creation time.
 */
export function subscribeWorkflows(
  listener: WorkflowRegistryListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reset all workflows. Only for testing. */
export function clearWorkflows(): void {
  workflows.clear();
  defaultWorkflowId = null;
  notify();
}
