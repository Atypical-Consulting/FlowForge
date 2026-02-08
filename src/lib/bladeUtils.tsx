import type { ReactNode } from "react";
import { BladeBreadcrumb } from "../components/blades/BladeBreadcrumb";

/**
 * Renders a file path as a split path/filename display for blade headers.
 *
 * Example: "src/components/App.tsx" renders as:
 *   <span class="text-ctp-overlay1">src/components/</span>
 *   <span class="font-semibold text-ctp-text">App.tsx</span>
 *
 * Extracted from registrations/diff.tsx for reuse across viewer blade registrations.
 */
export function renderPathTitle(filePath: string): ReactNode {
  const lastSlash = filePath.lastIndexOf("/");
  if (lastSlash === -1) {
    return (
      <span className="text-sm font-semibold text-ctp-text truncate">
        {filePath}
      </span>
    );
  }
  return (
    <span className="text-sm truncate">
      <span className="text-ctp-overlay1">
        {filePath.slice(0, lastSlash + 1)}
      </span>
      <span className="font-semibold text-ctp-text">
        {filePath.slice(lastSlash + 1)}
      </span>
    </span>
  );
}

/**
 * Renders a file path as a clickable breadcrumb for blade headers.
 *
 * Clicking a parent segment navigates to repo-browser at that directory.
 * The final segment (file or dir name) is rendered as bold, non-clickable text.
 */
export function renderPathBreadcrumb(filePath: string): ReactNode {
  return <BladeBreadcrumb path={filePath} />;
}
