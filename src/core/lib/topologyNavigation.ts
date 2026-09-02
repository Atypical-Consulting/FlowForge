import { useBladeRegistry } from "@/framework/layout/bladeRegistry";
import { getNavigationActor } from "@/framework/layout/navigation/context";
import {
  type TopologyView,
  useUIStore as useTopologyViewStore,
} from "../stores/domain/ui-state";

/**
 * Switch to the Topology workflow showing `view` ("graph" or "history").
 *
 * Shared by the "Show History" command, its menu entry, the mod+2 hotkey and
 * the default-tab setting so they all select the same tab. Returns false when
 * the topology extension has not registered its root blade.
 */
export function showTopologyView(view: TopologyView): boolean {
  if (!useBladeRegistry.getState().items.has("topology-graph")) return false;
  useTopologyViewStore.getState().setTopologyView(view);
  getNavigationActor().send({ type: "SWITCH_WORKFLOW", workflow: "topology" });
  return true;
}
