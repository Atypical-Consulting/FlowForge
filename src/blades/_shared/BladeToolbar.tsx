import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface BladeToolbarProps {
  children: ReactNode;
  className?: string;
}

/**
 * Sub-header toolbar strip for blades that need controls below the BladePanel header.
 * Matches the existing DiffBlade toolbar pattern (border-b, bg-ctp-crust).
 *
 * Used by: DiffBlade (inline/side-by-side toggle), RepoBrowserBlade (breadcrumbs).
 */
export function BladeToolbar({ children, className }: BladeToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1 border-b border-ctp-surface0 bg-ctp-crust shrink-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
