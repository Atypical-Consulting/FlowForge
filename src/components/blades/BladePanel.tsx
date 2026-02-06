import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

interface BladePanelProps {
  children: ReactNode;
  title: string;
  onBack?: () => void;
  showBack?: boolean;
}

export function BladePanel({ children, title, onBack, showBack }: BladePanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-10 px-3 flex items-center gap-2 border-b border-ctp-surface0 bg-ctp-crust shrink-0">
        {showBack && (
          <button
            onClick={onBack}
            className="p-1 rounded hover:bg-ctp-surface0 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4 text-ctp-subtext1" />
          </button>
        )}
        <span className="text-sm font-medium text-ctp-subtext1 truncate">
          {title}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
