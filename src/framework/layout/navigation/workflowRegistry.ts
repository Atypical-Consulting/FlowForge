import type { TypedBlade } from "../bladeTypes";

export interface WorkflowConfig {
  id: string;
  label: string;
  rootBlade: Omit<TypedBlade, "id">;
  /** If the root blade type isn't registered, use this fallback */
  fallbackBlade?: Omit<TypedBlade, "id">;
}

/** Default workflow ID (first registered workflow) */
let defaultWorkflowId: string | null = null;

const workflows = new Map<string, WorkflowConfig>();

export function registerWorkflow(config: WorkflowConfig): void {
  workflows.set(config.id, config);
  if (!defaultWorkflowId) defaultWorkflowId = config.id;
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

/** Reset all workflows. Only for testing. */
export function clearWorkflows(): void {
  workflows.clear();
  defaultWorkflowId = null;
}
