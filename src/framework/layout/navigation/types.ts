import type {
  BladePropsMap,
  BladeType,
  CoreBladeType,
  ExtensionBladeType,
  TypedBlade,
} from "../bladeTypes";

export type {
  TypedBlade,
  BladeType,
  BladePropsMap,
  CoreBladeType,
  ExtensionBladeType,
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
  | { type: "MARK_DIRTY"; bladeId: string }
  | { type: "MARK_CLEAN"; bladeId: string }
  | { type: "CONFIRM_DISCARD" }
  | { type: "CANCEL_DISCARD" };
