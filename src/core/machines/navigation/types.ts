import type { BladeType, BladePropsMap, TypedBlade, CoreBladeType, ExtensionBladeType } from "../../stores/bladeTypes";

export type { TypedBlade, BladeType, BladePropsMap, CoreBladeType, ExtensionBladeType };

export type ProcessType = "staging" | "topology";

export type LastAction = "push" | "pop" | "replace" | "reset" | "init";

export interface NavigationContext {
  activeProcess: ProcessType;
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
  | { type: "SWITCH_PROCESS"; process: ProcessType }
  | { type: "MARK_DIRTY"; bladeId: string }
  | { type: "MARK_CLEAN"; bladeId: string }
  | { type: "CONFIRM_DISCARD" }
  | { type: "CANCEL_DISCARD" };
