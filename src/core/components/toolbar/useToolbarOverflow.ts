import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** `gap-1` between the last inline item and the overflow trigger. */
const TOOLBAR_GAP = 4;
/** Width of the overflow trigger before it has been rendered (Button size="sm" + icon). */
const DEFAULT_TRIGGER_WIDTH = 40;

const ITEM_SELECTOR = "[data-toolbar-item]";
const TRIGGER_SELECTOR = "[data-toolbar-overflow-trigger]";

/**
 * Top-level toolbar items in DOM order: the overflow trigger and any
 * `data-toolbar-item` nested inside a custom widget are excluded so an item
 * is never counted twice.
 */
function getMeasurableItems(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(ITEM_SELECTOR),
  ).filter((item) => {
    if (item.matches(TRIGGER_SELECTOR)) return false;
    const outer = item.parentElement?.closest(ITEM_SELECTOR);
    return !outer || !container.contains(outer);
  });
}

/**
 * Overflow detection for the toolbar.
 *
 * Returns how many of `actions` fit inline in the container, reserving room
 * for the overflow trigger when not everything fits. `Infinity` means every
 * action is inline and no trigger is needed.
 *
 * Measurement rules:
 * - The container must get its width from its parent (e.g. `flex-1 min-w-0`),
 *   never from its content, otherwise the measurement is self-referential and
 *   the toolbar collapses items it had room for.
 * - Items are measured by their right edge relative to the first item, so
 *   group dividers and gaps are accounted for exactly.
 * - Whenever the action list changes, every action is rendered again and
 *   re-measured; a count computed for a previous list is never reused (that
 *   is how a stale count from the welcome screen used to hide 16 actions
 *   once a repository had opened).
 * - When the container grows, every action is rendered again so the
 *   measurement can see the widths of actions that were collapsed.
 */
export function useToolbarOverflow(actions: ReadonlyArray<{ id: string }>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(Infinity);
  const prevWidthRef = useRef(0);

  const totalCount = actions.length;
  const actionsKey = actions.map((a) => a.id).join(" ");

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = getMeasurableItems(container);
    if (items.length === 0) {
      setVisibleCount(Infinity);
      return;
    }

    const available = container.clientWidth;
    const start = items[0].getBoundingClientRect().left;
    const rightEdge = (index: number) =>
      items[index].getBoundingClientRect().right - start;
    const trigger = container.querySelector<HTMLElement>(TRIGGER_SELECTOR);
    const reserve =
      (trigger?.offsetWidth || DEFAULT_TRIGGER_WIDTH) + TOOLBAR_GAP;

    const everythingRendered = items.length >= totalCount;
    const renderedWidth = rightEdge(items.length - 1);

    if (everythingRendered && renderedWidth <= available) {
      // Everything fits without a trigger.
      setVisibleCount(Infinity);
      return;
    }

    if (!everythingRendered && renderedWidth + reserve <= available) {
      // Only a subset is rendered and it fits: render every action so the
      // next measurement can decide how many really fit now.
      setVisibleCount(Infinity);
      return;
    }

    let count = 0;
    for (let i = 0; i < items.length; i++) {
      if (rightEdge(i) + reserve > available) break;
      count++;
    }
    setVisibleCount(count);
  }, [totalCount]);

  // A new action list invalidates the previous count: render everything so
  // the measurement below sees every action.
  // biome-ignore lint/correctness/useExhaustiveDependencies: actionsKey is the trigger, not a value used inside
  useLayoutEffect(() => {
    setVisibleCount(Infinity);
  }, [actionsKey]);

  // Right after a full render, decide how many actions fit. Runs before paint
  // so the intermediate "everything inline" state is never visible.
  // biome-ignore lint/correctness/useExhaustiveDependencies: actionsKey re-runs the measurement when the list changes
  useLayoutEffect(() => {
    if (visibleCount === Infinity) measure();
  }, [visibleCount, measure, actionsKey]);

  // Re-measure when the available width changes (window resize, header
  // content changes). Only width changes matter; height-only notifications
  // are ignored so the observer cannot feed back into itself.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (Math.abs(width - prevWidthRef.current) < 1) continue;
        prevWidthRef.current = width;
        measure();
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  return { containerRef, visibleCount };
}
