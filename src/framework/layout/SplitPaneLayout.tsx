import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import {
  ResizablePanel,
  ResizablePanelLayout,
  ResizeHandle,
} from "./ResizablePanelLayout";

interface SplitPaneLayoutProps {
  autoSaveId: string;
  primaryDefaultSize?: number;
  primaryMinSize?: number;
  primaryMaxSize?: number;
  detailMinSize?: number;
  primary: ReactNode;
  detail: ReactNode;
  className?: string;
}

export function SplitPaneLayout({
  autoSaveId,
  primaryDefaultSize = 40,
  primaryMinSize = 20,
  primaryMaxSize = 60,
  detailMinSize = 30,
  primary,
  detail,
  className,
}: SplitPaneLayoutProps) {
  return (
    <div className={cn("h-full w-full", className)}>
      <ResizablePanelLayout autoSaveId={autoSaveId} direction="horizontal">
        <ResizablePanel
          id={`${autoSaveId}-primary`}
          defaultSize={primaryDefaultSize}
          minSize={primaryMinSize}
          maxSize={primaryMaxSize}
        >
          {primary}
        </ResizablePanel>
        <ResizeHandle />
        <ResizablePanel
          id={`${autoSaveId}-detail`}
          defaultSize={100 - primaryDefaultSize}
          minSize={detailMinSize}
        >
          {detail}
        </ResizablePanel>
      </ResizablePanelLayout>
    </div>
  );
}
