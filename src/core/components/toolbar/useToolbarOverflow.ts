import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ResizeObserver hook for toolbar overflow detection.
 *
 * Measures `[data-toolbar-item]` children and returns how many fit
 * within the container width, reserving space for the overflow button.
 *
 * Uses `requestAnimationFrame` and a `prevWidth` ref to avoid the
 * well-known ResizeObserver infinite-loop pitfall (only reacts to
 * width changes, not height).
 */
export function useToolbarOverflow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(Infinity);
  const prevWidthRef = useRef(0);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = container.querySelectorAll<HTMLElement>(
      "[data-toolbar-item]",
    );
    if (items.length === 0) {
      setVisibleCount(Infinity);
      return;
    }

    const containerWidth = container.clientWidth;
    const overflowButtonWidth = 40; // px reserved for overflow trigger
    let cumulativeWidth = 0;
    let count = 0;

    for (const item of items) {
      // Use offsetWidth to include padding + border
      cumulativeWidth += item.offsetWidth + 4; // 4px for gap-1
      if (cumulativeWidth + overflowButtonWidth > containerWidth) {
        break;
      }
      count++;
    }

    // If all items fit without needing the overflow button, show all
    if (count >= items.length) {
      setVisibleCount(Infinity);
    } else {
      setVisibleCount(count);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        // Only react to width changes — skip height-only changes
        // to avoid ResizeObserver infinite loop
        if (Math.abs(newWidth - prevWidthRef.current) < 1) continue;
        prevWidthRef.current = newWidth;

        // Wrap in rAF to batch layout reads
        requestAnimationFrame(() => {
          measure();
        });
      }
    });

    observer.observe(container);

    // Initial measurement
    measure();

    return () => {
      observer.disconnect();
    };
  }, [measure]);

  return { containerRef, visibleCount };
}
