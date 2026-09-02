import { act, render, screen } from "@testing-library/react";
import { useToolbarOverflow } from "../useToolbarOverflow";

/**
 * jsdom has no layout engine, so the toolbar geometry is simulated:
 * - the container's clientWidth is `containerWidth`
 * - every top-level `[data-toolbar-item]` is `data-w` px wide, laid out left
 *   to right with the toolbar's 4px gap
 * - a nested `[data-toolbar-item]` reports its wrapper's rectangle
 */
const ITEM = "[data-toolbar-item]";
const GAP = 4;
let containerWidth = 300;
let resizeCallback: ResizeObserverCallback | null = null;

function topLevelItems(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(ITEM)).filter(
    (el) => !el.parentElement?.closest(ITEM),
  );
}

function widthOf(el: HTMLElement): number {
  return Number(el.dataset.w ?? 0);
}

const zeroRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.testid === "toolbar" ? containerWidth : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return widthOf(this);
    },
  });
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value(this: HTMLElement): DOMRect {
      const container = this.closest("[data-testid='toolbar']");
      if (!container) return zeroRect;
      const items = topLevelItems(container);
      const self = items.includes(this)
        ? this
        : (this.parentElement?.closest<HTMLElement>(ITEM) ?? null);
      const index = self ? items.indexOf(self) : -1;
      if (index < 0 || !self) return zeroRect;
      let left = 0;
      for (let i = 0; i < index; i++) left += widthOf(items[i]) + GAP;
      const width = widthOf(self);
      return { ...zeroRect, x: left, left, width, right: left + width };
    },
  });
  globalThis.ResizeObserver = class {
    constructor(cb: ResizeObserverCallback) {
      resizeCallback = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterAll(() => {
  // biome-ignore lint/performance/noDelete: restore jsdom's prototype accessors
  delete (HTMLElement.prototype as Partial<HTMLElement>).clientWidth;
  // biome-ignore lint/performance/noDelete: restore jsdom's prototype accessors
  delete (HTMLElement.prototype as Partial<HTMLElement>).offsetWidth;
  // biome-ignore lint/performance/noDelete: restore jsdom's prototype accessors
  delete (HTMLElement.prototype as Partial<HTMLElement>).getBoundingClientRect;
});

beforeEach(() => {
  containerWidth = 300;
  resizeCallback = null;
});

interface HarnessProps {
  ids: string[];
  itemWidth?: number;
  nestedFirst?: boolean;
}

/** Mirrors how Toolbar.tsx consumes the hook. */
function Harness({ ids, itemWidth = 40, nestedFirst = false }: HarnessProps) {
  const actions = ids.map((id) => ({ id }));
  const { containerRef, visibleCount } = useToolbarOverflow(actions);
  const inline = actions.slice(0, visibleCount);
  const overflowed =
    visibleCount < actions.length ? actions.slice(visibleCount) : [];

  return (
    <div ref={containerRef} data-testid="toolbar">
      {inline.map((action, i) =>
        nestedFirst && i === 0 ? (
          <div key={action.id} data-toolbar-item data-w={itemWidth}>
            <button type="button" data-toolbar-item data-w={itemWidth}>
              {action.id}
            </button>
          </div>
        ) : (
          <button
            key={action.id}
            type="button"
            data-toolbar-item
            data-w={itemWidth}
          >
            {action.id}
          </button>
        ),
      )}
      {overflowed.length > 0 && (
        <button
          type="button"
          data-toolbar-item
          data-toolbar-overflow-trigger
          data-w={40}
        >
          more
        </button>
      )}
      <output data-testid="visible">{String(visibleCount)}</output>
      <output data-testid="overflowed">{overflowed.length}</output>
    </div>
  );
}

const ids = (count: number) => Array.from({ length: count }, (_, i) => `a${i}`);

function expectLayout(visible: string, overflowed: number) {
  expect(screen.getByTestId("visible")).toHaveTextContent(visible);
  expect(screen.getByTestId("overflowed")).toHaveTextContent(
    String(overflowed),
  );
}

function resizeTo(width: number) {
  containerWidth = width;
  act(() => {
    resizeCallback?.(
      [{ contentRect: { width } } as ResizeObserverEntry],
      {} as ResizeObserver,
    );
  });
}

describe("useToolbarOverflow", () => {
  it("keeps every action inline when they all fit", () => {
    // 5 x 40px + 4 gaps = 216px <= 300px
    render(<Harness ids={ids(5)} />);
    expectLayout("Infinity", 0);
  });

  it("collapses trailing actions and reserves room for the trigger", () => {
    containerWidth = 200;
    // item i ends at 44i + 40; with the 44px trigger reserve, i <= 2 fits.
    render(<Harness ids={ids(5)} />);
    expectLayout("3", 2);
  });

  it("re-measures when the action list changes instead of reusing a stale count", () => {
    const { rerender } = render(<Harness ids={ids(5)} />);
    expectLayout("Infinity", 0);

    // More actions appear (e.g. extensions activate after a repository opens).
    rerender(<Harness ids={ids(10)} />);
    // 10 x 44 - 4 = 436px > 300px; 44i + 84 <= 300 -> i <= 4 -> 5 inline.
    expectLayout("5", 5);

    // Fewer actions again: everything fits, no trigger.
    rerender(<Harness ids={ids(3)} />);
    expectLayout("Infinity", 0);
  });

  it("re-measures when the list grows from the welcome-screen set to the full repository set", () => {
    // Welcome screen: 3 core actions fit (3 x 44 - 4 = 128px <= 300px).
    const { rerender } = render(<Harness ids={ids(3)} />);
    expectLayout("Infinity", 0);

    // Repository opens: every extension action's when() flips to true.
    rerender(<Harness ids={ids(17)} />);
    // 17 x 44 - 4 = 744px > 300px; 44i + 84 <= 300 -> i <= 4 -> 5 inline.
    expectLayout("5", 12);
  });

  it("brings collapsed actions back when the container grows and collapses more when it shrinks", () => {
    containerWidth = 200;
    render(<Harness ids={ids(5)} />);
    expectLayout("3", 2);

    resizeTo(300);
    expectLayout("Infinity", 0);

    resizeTo(150);
    // 44i + 84 <= 150 -> i <= 1 -> 2 inline.
    expectLayout("2", 3);
  });

  it("does not count the overflow trigger or nested items as actions", () => {
    containerWidth = 200;
    render(<Harness ids={ids(5)} nestedFirst />);
    expectLayout("3", 2);
  });
});
