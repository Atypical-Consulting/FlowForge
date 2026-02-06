import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void; icon?: ReactNode };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center",
        className,
      )}
    >
      <div className="mb-4 h-12 w-12 text-ctp-overlay0">{icon}</div>
      <p className="mb-1 text-sm font-medium text-ctp-subtext1">{title}</p>
      <p className="mb-4 max-w-[200px] text-xs text-ctp-overlay0">
        {description}
      </p>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.icon && <span className="mr-1.5">{action.icon}</span>}
          {action.label}
        </Button>
      )}
    </div>
  );
}
