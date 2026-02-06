import { Files, Network } from "lucide-react";
import { useBladeStore } from "../../stores/blades";
import type { ProcessType } from "../../stores/blades";
import { cn } from "../../lib/utils";

const PROCESSES = [
  { id: "staging" as ProcessType, label: "Staging", icon: Files },
  { id: "topology" as ProcessType, label: "Topology", icon: Network },
] as const;

interface ProcessNavigationProps {
  className?: string;
}

export function ProcessNavigation({ className }: ProcessNavigationProps) {
  const { activeProcess, setProcess } = useBladeStore();

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {PROCESSES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setProcess(id)}
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
