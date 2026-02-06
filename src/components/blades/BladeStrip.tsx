import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

interface BladeStripProps {
  title: string;
  icon?: ReactNode;
  onExpand: () => void;
}

export function BladeStrip({ title, onExpand }: BladeStripProps) {
  return (
    <button
      onClick={onExpand}
      className="w-10 shrink-0 border-r border-ctp-surface0 bg-ctp-base hover:bg-ctp-surface0 transition-colors flex flex-col items-center py-3 gap-2"
      aria-label={`Expand ${title} panel`}
    >
      <ChevronLeft className="w-4 h-4 text-ctp-overlay1" />
      <span className="text-xs text-ctp-subtext0 [writing-mode:vertical-lr] rotate-180">
        {title}
      </span>
    </button>
  );
}
