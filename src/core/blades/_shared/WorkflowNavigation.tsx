import { useSelector } from "@xstate/react";
import type { LucideIcon } from "lucide-react";
import { Files, Network } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useBladeRegistry } from "@/framework/layout/bladeRegistry";
import { useNavigationActorRef } from "@/framework/layout/navigation/context";
import { selectActiveWorkflow } from "@/framework/layout/navigation/selectors";
import { getAllWorkflows } from "@/framework/layout/navigation/workflowRegistry";
import { cn } from "../../lib/utils";

/** Map workflow IDs to icons. Falls back to Files for unknown workflows. */
const WORKFLOW_ICONS: Record<string, LucideIcon> = {
  staging: Files,
  topology: Network,
};

interface WorkflowNavigationProps {
  className?: string;
}

export function WorkflowNavigation({ className }: WorkflowNavigationProps) {
  const actorRef = useNavigationActorRef();
  const activeWorkflow = useSelector(actorRef, selectActiveWorkflow);

  const blades = useBladeRegistry((s) => s.items);
  const allWorkflows = getAllWorkflows();

  const visibleWorkflows = useMemo(
    () =>
      allWorkflows.filter((w) => {
        // Always show workflows whose root blade is registered
        return (
          blades.has(w.rootBlade.type as string) ||
          (w.fallbackBlade && blades.has(w.fallbackBlade.type as string))
        );
      }),
    [blades, allWorkflows],
  );

  useEffect(() => {
    // If the active workflow's root blade is not registered and has no fallback, switch to first available
    const active = allWorkflows.find((w) => w.id === activeWorkflow);
    if (
      active &&
      !blades.has(active.rootBlade.type as string) &&
      !active.fallbackBlade
    ) {
      const firstAvailable = visibleWorkflows[0];
      if (firstAvailable && firstAvailable.id !== activeWorkflow) {
        actorRef.send({ type: "SWITCH_WORKFLOW", workflow: firstAvailable.id });
      }
    }
  }, [activeWorkflow, blades, actorRef, allWorkflows, visibleWorkflows]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {visibleWorkflows.map(({ id, label }) => {
        const Icon = WORKFLOW_ICONS[id] ?? Files;
        return (
          <button
            key={id}
            onClick={() =>
              actorRef.send({ type: "SWITCH_WORKFLOW", workflow: id })
            }
            className={cn(
              "px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors",
              activeWorkflow === id
                ? "bg-ctp-surface0 text-ctp-text"
                : "text-ctp-subtext0 hover:text-ctp-subtext1 hover:bg-ctp-surface0/50",
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
