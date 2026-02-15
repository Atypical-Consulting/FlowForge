import { Files, Network } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useSelector } from "@xstate/react";
import { useNavigationActorRef } from "@/framework/layout/navigation/context";
import { selectActiveWorkflow } from "@/framework/layout/navigation/selectors";
import type { WorkflowType } from "@/framework/layout/navigation/types";
import { useBladeRegistry } from "@/framework/layout/bladeRegistry";
import { cn } from "../../lib/utils";

const ALL_WORKFLOWS = [
  { id: "staging" as WorkflowType, label: "Staging", icon: Files },
  { id: "topology" as WorkflowType, label: "Topology", icon: Network },
];

interface WorkflowNavigationProps {
  className?: string;
}

export function WorkflowNavigation({ className }: WorkflowNavigationProps) {
  const actorRef = useNavigationActorRef();
  const activeWorkflow = useSelector(actorRef, selectActiveWorkflow);

  const blades = useBladeRegistry((s) => s.items);
  const visibleWorkflows = useMemo(
    () => ALL_WORKFLOWS.filter((p) => p.id === "staging" || blades.has("topology-graph")),
    [blades],
  );

  useEffect(() => {
    if (activeWorkflow === "topology" && !blades.has("topology-graph")) {
      actorRef.send({ type: "SWITCH_WORKFLOW", workflow: "staging" });
    }
  }, [activeWorkflow, blades, actorRef]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {visibleWorkflows.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => actorRef.send({ type: "SWITCH_WORKFLOW", workflow: id })}
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
      ))}
    </div>
  );
}
