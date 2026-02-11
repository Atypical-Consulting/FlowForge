import type { ReactNode } from "react";

interface ToolbarGroupProps {
  children: ReactNode;
  showDivider?: boolean;
}

/**
 * Visual group wrapper with optional divider.
 * The divider is purely visual -- NOT a toolbar item, no data-toolbar-item.
 */
export function ToolbarGroup({ children, showDivider }: ToolbarGroupProps) {
  return (
    <div className="flex items-center gap-1">
      {showDivider && (
        <div className="w-px h-5 bg-ctp-surface1 mx-1" aria-hidden="true" />
      )}
      {children}
    </div>
  );
}
