import { Home } from "lucide-react";
import { useBladeStore } from "../../stores/blades";

interface BladeBreadcrumbProps {
  /** Full file/directory path, e.g. "src/components/App.tsx" */
  path: string;
  /** When true, clicking a segment navigates to repo-browser at that directory. */
  navigable?: boolean;
}

/**
 * Shared breadcrumb for blade headers. Shows Home icon + clickable path segments.
 *
 * When `navigable` is true (default), clicking a parent segment replaces the
 * current blade with a repo-browser at that directory path.
 */
export function BladeBreadcrumb({ path, navigable = true }: BladeBreadcrumbProps) {
  const store = useBladeStore();
  const segments = path ? path.split("/").filter(Boolean) : [];

  const navigateTo = (dirPath: string) => {
    if (!navigable) return;
    const stack = store.bladeStack;
    // Find the last repo-browser ancestor (excluding current top blade)
    let repoBrowserIndex = -1;
    for (let i = stack.length - 2; i >= 0; i--) {
      if (stack[i].type === "repo-browser") {
        repoBrowserIndex = i;
        break;
      }
    }
    if (repoBrowserIndex >= 0) {
      // Pop to ancestor, then replace it atomically
      store.popToIndex(repoBrowserIndex);
      store.replaceBlade({
        type: "repo-browser",
        title: dirPath.split("/").pop() || "Repository Browser",
        props: { path: dirPath },
      });
    } else {
      store.replaceBlade({
        type: "repo-browser",
        title: dirPath.split("/").pop() || "Repository Browser",
        props: { path: dirPath },
      });
    }
  };

  const navigateToRoot = () => {
    if (!navigable) return;
    const stack = store.bladeStack;
    let repoBrowserIndex = -1;
    for (let i = stack.length - 2; i >= 0; i--) {
      if (stack[i].type === "repo-browser") {
        repoBrowserIndex = i;
        break;
      }
    }
    if (repoBrowserIndex >= 0) {
      store.popToIndex(repoBrowserIndex);
      store.replaceBlade({
        type: "repo-browser",
        title: "Repository Browser",
        props: { path: "" },
      });
    } else {
      store.replaceBlade({
        type: "repo-browser",
        title: "Repository Browser",
        props: { path: "" },
      });
    }
  };

  return (
    <nav aria-label="File path" className="flex-1 min-w-0">
      <ol className="flex items-center gap-0.5 text-sm overflow-x-auto scrollbar-none">
        <li className="shrink-0">
          {navigable ? (
            <button
              type="button"
              onClick={navigateToRoot}
              className="flex items-center text-ctp-overlay1 hover:text-ctp-text transition-colors"
              aria-label="Repository root"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="flex items-center text-ctp-overlay1">
              <Home className="w-3.5 h-3.5" />
            </span>
          )}
        </li>

        {segments.map((segment, index) => {
          const segmentPath = segments.slice(0, index + 1).join("/");
          const isLast = index === segments.length - 1;

          return (
            <li key={segmentPath} className="flex items-center gap-0.5 min-w-0">
              <span aria-hidden="true" className="text-ctp-overlay0 shrink-0">
                /
              </span>
              {isLast ? (
                <span className="font-semibold text-ctp-text truncate">
                  {segment}
                </span>
              ) : navigable ? (
                <button
                  type="button"
                  onClick={() => navigateTo(segmentPath)}
                  className="text-ctp-overlay1 hover:text-ctp-text hover:underline truncate transition-colors"
                >
                  {segment}
                </button>
              ) : (
                <span className="text-ctp-overlay1 truncate">{segment}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
