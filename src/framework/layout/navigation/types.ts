import type {
  BladePropsMap,
  BladeType,
  CoreBladeType,
  ExtensionBladeType,
  TypedBlade,
} from "../bladeTypes";

export type {
  BladePropsMap,
  BladeType,
  CoreBladeType,
  ExtensionBladeType,
  TypedBlade,
};

export type WorkflowType = string;

export type LastAction = "push" | "pop" | "replace" | "reset" | "init";

export interface NavigationContext {
  activeWorkflow: WorkflowType;
  bladeStack: TypedBlade[];
  dirtyBladeIds: Record<string, true>;
  lastAction: LastAction;
  maxStackDepth: number;
  pendingEvent: NavigationEvent | null;
}

export type NavigationEvent =
  | {
      type: "PUSH_BLADE";
      bladeType: BladeType;
      title: string;
      props: Record<string, unknown>;
    }
  | { type: "POP_BLADE" }
  | { type: "POP_TO_INDEX"; index: number }
  | {
      type: "REPLACE_BLADE";
      bladeType: BladeType;
      title: string;
      props: Record<string, unknown>;
    }
  | { type: "RESET_STACK" }
  | { type: "SWITCH_WORKFLOW"; workflow: WorkflowType }
  /**
   * Sent by the navigation context whenever the workflow registry changes.
   * Heals an actor whose active workflow is not registered (or whose root is
   * the "empty" placeholder) — e.g. when the actor was created before the
   * workflows were registered because of production chunk evaluation order.
   */
  | { type: "WORKFLOWS_CHANGED" }
  | { type: "MARK_DIRTY"; bladeId: string }
  | { type: "MARK_CLEAN"; bladeId: string }
  | { type: "CONFIRM_DISCARD" }
  | { type: "CANCEL_DISCARD" };
