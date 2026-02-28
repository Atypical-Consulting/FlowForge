import { useCallback, useState } from "react";

/**
 * ARIA roving tabindex keyboard navigation for toolbar pattern.
 *
 * Returns `activeIndex`, `getTabIndex(i)`, and `handleKeyDown`.
 * Arrow Left/Right wrap around. Home/End jump to first/last.
 * Tab/Shift+Tab exit the toolbar naturally (no prevention).
 */
export function useRovingTabindex(itemCount: number) {
  const [activeIndex, setActiveIndex] = useState(0);

  const getTabIndex = useCallback(
    (index: number): 0 | -1 => (index === activeIndex ? 0 : -1),
    [activeIndex],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (itemCount === 0) return;

      let newIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          newIndex = (activeIndex + 1) % itemCount;
          break;
        case "ArrowLeft":
          e.preventDefault();
          newIndex = (activeIndex - 1 + itemCount) % itemCount;
          break;
        case "Home":
          e.preventDefault();
          newIndex = 0;
          break;
        case "End":
          e.preventDefault();
          newIndex = itemCount - 1;
          break;
        default:
          return;
      }

      setActiveIndex(newIndex);

      // Focus the element at the new index
      const items = e.currentTarget.querySelectorAll<HTMLElement>(
        "[data-toolbar-item]",
      );
      items[newIndex]?.focus();
    },
    [activeIndex, itemCount],
  );

  return { activeIndex, getTabIndex, handleKeyDown };
}
