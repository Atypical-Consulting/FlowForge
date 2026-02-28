import { Maximize2 } from "lucide-react";
import type { ComponentType } from "react";

interface NonTextPlaceholderProps {
  icon: ComponentType<{ className?: string }>;
  message: string;
  onExpand: () => void;
}

export function NonTextPlaceholder({
  icon: Icon,
  message,
  onExpand,
}: NonTextPlaceholderProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-ctp-mantle">
      <Icon className="w-10 h-10 text-ctp-overlay1" />
      <p className="text-sm text-ctp-overlay1">{message}</p>
      <button
        type="button"
        onClick={onExpand}
        className="px-3 py-1.5 text-sm rounded bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text transition-colors flex items-center gap-1.5"
      >
        <Maximize2 className="w-3.5 h-3.5" />
        Open in Full View
      </button>
    </div>
  );
}
