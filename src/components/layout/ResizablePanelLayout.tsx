import { Group, Panel, Separator } from "react-resizable-panels";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface ResizablePanelLayoutProps {
  autoSaveId: string;
  direction?: "horizontal" | "vertical";
  children: ReactNode;
}

export function ResizablePanelLayout({
  autoSaveId,
  direction = "horizontal",
  children,
}: ResizablePanelLayoutProps) {
  return (
    <Group id={autoSaveId} orientation={direction} className="h-full w-full">
      {children}
    </Group>
  );
}

interface ResizablePanelProps {
  id?: string;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  children: ReactNode;
  className?: string;
}

export function ResizablePanel({
  id,
  defaultSize,
  minSize = 10,
  maxSize,
  children,
  className,
}: ResizablePanelProps) {
  // In v4, numeric values are interpreted as pixels, so we convert to percentage strings
  const defaultSizeStr =
    defaultSize !== undefined ? `${defaultSize}%` : undefined;
  const minSizeStr = `${minSize}%`;
  const maxSizeStr = maxSize !== undefined ? `${maxSize}%` : undefined;

  return (
    <Panel
      id={id}
      defaultSize={defaultSizeStr}
      minSize={minSizeStr}
      maxSize={maxSizeStr}
      className={cn("overflow-clip", className)}
    >
      {children}
    </Panel>
  );
}

export function ResizeHandle({ className }: { className?: string }) {
  return (
    <Separator
      className={cn(
        "w-1 bg-ctp-surface0 transition-colors cursor-col-resize",
        "[&[data-separator='hover']]:bg-ctp-blue [&[data-separator='active']]:bg-ctp-blue",
        className,
      )}
    />
  );
}
