import { Files, Network } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useSelector } from "@xstate/react";
import { useNavigationActorRef } from "../../machines/navigation/context";
import { selectActiveProcess } from "../../machines/navigation/selectors";
import type { ProcessType } from "../../machines/navigation/types";
import { useBladeRegistry } from "../../lib/bladeRegistry";
import { cn } from "../../lib/utils";

const ALL_PROCESSES = [
  { id: "staging" as ProcessType, label: "Staging", icon: Files },
  { id: "topology" as ProcessType, label: "Topology", icon: Network },
];

interface ProcessNavigationProps {
  className?: string;
}

export function ProcessNavigation({ className }: ProcessNavigationProps) {
  const actorRef = useNavigationActorRef();
  const activeProcess = useSelector(actorRef, selectActiveProcess);

  const blades = useBladeRegistry((s) => s.blades);
  const visibleProcesses = useMemo(
    () => ALL_PROCESSES.filter((p) => p.id === "staging" || blades.has("topology-graph")),
    [blades],
  );

  useEffect(() => {
    if (activeProcess === "topology" && !blades.has("topology-graph")) {
      actorRef.send({ type: "SWITCH_PROCESS", process: "staging" });
    }
  }, [activeProcess, blades, actorRef]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {visibleProcesses.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => actorRef.send({ type: "SWITCH_PROCESS", process: id })}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors",
            activeProcess === id
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
