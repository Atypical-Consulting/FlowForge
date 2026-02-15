import {
  Group,
  Panel,
  Separator,
  type GroupImperativeHandle,
  type PanelImperativeHandle,
  type Layout,
  type PanelSize,
} from "react-resizable-panels";
import type { ReactNode, Ref } from "react";
import { cn } from "../lib/utils";

interface ResizablePanelLayoutProps {
  autoSaveId: string;
  direction?: "horizontal" | "vertical";
  children: ReactNode;
  groupRef?: Ref<GroupImperativeHandle | null>;
  onLayoutChanged?: (layout: Layout) => void;
}

export function ResizablePanelLayout({
  autoSaveId,
  direction = "horizontal",
  children,
  groupRef,
  onLayoutChanged,
}: ResizablePanelLayoutProps) {
  return (
    <Group
      id={autoSaveId}
      orientation={direction}
      className="h-full w-full"
      groupRef={groupRef}
      onLayoutChanged={onLayoutChanged}
    >
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
  panelRef?: Ref<PanelImperativeHandle | null>;
  collapsible?: boolean;
  collapsedSize?: number;
  onResize?: (
    panelSize: PanelSize,
    id: string | number | undefined,
    prevPanelSize: PanelSize | undefined,
  ) => void;
}

export function ResizablePanel({
  id,
  defaultSize,
  minSize = 10,
  maxSize,
  children,
  className,
  panelRef,
  collapsible,
  collapsedSize,
  onResize,
}: ResizablePanelProps) {
  // In v4, numeric values are interpreted as pixels, so we convert to percentage strings
  const defaultSizeStr =
    defaultSize !== undefined ? `${defaultSize}%` : undefined;
  const minSizeStr = `${minSize}%`;
  const maxSizeStr = maxSize !== undefined ? `${maxSize}%` : undefined;
  const collapsedSizeStr =
    collapsedSize !== undefined ? `${collapsedSize}%` : undefined;

  return (
    <Panel
      id={id}
      defaultSize={defaultSizeStr}
      minSize={minSizeStr}
      maxSize={maxSizeStr}
      className={cn("overflow-clip", className)}
      panelRef={panelRef}
      collapsible={collapsible}
      collapsedSize={collapsedSizeStr}
      onResize={onResize}
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
        "data-[separator='hover']:bg-ctp-blue data-[separator='active']:bg-ctp-blue",
        className,
      )}
    />
  );
}
