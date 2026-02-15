import { useMemo } from "react";
import { useStatusBarRegistry, getLeftItems, getRightItems } from "@/framework/extension-system/statusBarRegistry";
import type { StatusBarItem } from "@/framework/extension-system/statusBarRegistry";

function StatusBarWidget({ item }: { item: StatusBarItem }) {
  const content = item.renderCustom();

  if (item.execute) {
    return (
      <button
        type="button"
        onClick={item.execute}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0 transition-colors cursor-pointer"
        title={item.tooltip}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className="flex items-center gap-1 px-1.5 py-0.5 text-ctp-subtext0"
      title={item.tooltip}
    >
      {content}
    </span>
  );
}

export function StatusBar() {
  const items = useStatusBarRegistry((s) => s.items);
  const visibilityTick = useStatusBarRegistry((s) => s.visibilityTick);

  const leftItems = useMemo(
    () => getLeftItems(),
    [items, visibilityTick],
  );
  const rightItems = useMemo(
    () => getRightItems(),
    [items, visibilityTick],
  );

  if (leftItems.length === 0 && rightItems.length === 0) return null;

  return (
    <footer
      role="status"
      aria-label="Status bar"
      className="flex items-center justify-between h-6 px-3 text-xs bg-ctp-mantle border-t border-ctp-surface0 select-none"
    >
      <div className="flex items-center gap-2">
        {leftItems.map((item) => (
          <StatusBarWidget key={item.id} item={item} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        {rightItems.map((item) => (
          <StatusBarWidget key={item.id} item={item} />
        ))}
      </div>
    </footer>
  );
}
