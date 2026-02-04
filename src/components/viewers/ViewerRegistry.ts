import type { FileChange } from "../../bindings";
import type { ComponentType } from "react";

export interface ViewerProps {
  file: FileChange;
  section: "staged" | "unstaged" | "untracked" | null;
}

type ViewerMatcher = (file: FileChange) => boolean;

interface RegisteredViewer {
  matcher: ViewerMatcher;
  component: ComponentType<ViewerProps>;
  priority: number; // Higher priority checked first
}

const viewers: RegisteredViewer[] = [];

export function registerViewer(
  matcher: ViewerMatcher,
  component: ComponentType<ViewerProps>,
  priority: number = 0
) {
  viewers.push({ matcher, component, priority });
  viewers.sort((a, b) => b.priority - a.priority);
}

export function getViewerForFile(
  file: FileChange
): ComponentType<ViewerProps> | null {
  for (const viewer of viewers) {
    if (viewer.matcher(file)) {
      return viewer.component;
    }
  }
  return null;
}
