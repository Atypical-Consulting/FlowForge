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
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  children: ReactNode;
  className?: string;
}

export function ResizablePanel({
  defaultSize,
  minSize = 10,
  maxSize,
  children,
  className,
}: ResizablePanelProps) {
  return (
    <Panel
      defaultSize={defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      className={cn("overflow-hidden", className)}
    >
      {children}
    </Panel>
  );
}

export function ResizeHandle({ className }: { className?: string }) {
  return (
    <Separator
      className={cn(
        "w-1 bg-ctp-surface0 hover:bg-ctp-blue transition-colors cursor-col-resize",
        "data-[separator=active]:bg-ctp-blue",
        className,
      )}
    />
  );
}
