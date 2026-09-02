import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  type ContextMenuItem,
  useContextMenuRegistry,
} from "@/framework/extension-system/contextMenuRegistry";
import { ContextMenuPortal, clampMenuPosition } from "./ContextMenu";

const makeItem = (
  overrides: Partial<ContextMenuItem> & { id: string },
): ContextMenuItem => ({
  label: overrides.id,
  location: "file-tree",
  execute: () => {},
  ...overrides,
});

function openMenu(position = { x: 10, y: 10 }) {
  act(() => {
    useContextMenuRegistry
      .getState()
      .showMenu(position, "file-tree", { location: "file-tree" });
  });
}

describe("ContextMenuPortal", () => {
  beforeEach(() => {
    useContextMenuRegistry.setState({ items: new Map(), activeMenu: null });
    useContextMenuRegistry
      .getState()
      .register(makeItem({ id: "one", label: "First" }));
  });

  it("renders nothing when no menu is active", () => {
    render(<ContextMenuPortal />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders the active menu items", () => {
    render(<ContextMenuPortal />);
    openMenu();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "First" })).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<ContextMenuPortal />);
    openMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(useContextMenuRegistry.getState().activeMenu).toBeNull();
  });

  it("closes on click outside (backdrop)", () => {
    render(<ContextMenuPortal />);
    openMenu();
    const menu = screen.getByRole("menu");
    const backdrop = menu.parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("stays open when clicking inside the menu surface", () => {
    render(<ContextMenuPortal />);
    openMenu();
    fireEvent.click(screen.getByRole("menu"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("closes on scroll anywhere in the document", () => {
    render(<ContextMenuPortal />);
    openMenu();
    const scroller = document.createElement("div");
    document.body.appendChild(scroller);
    act(() => {
      scroller.dispatchEvent(new Event("scroll", { bubbles: false }));
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    scroller.remove();
  });

  it("closes on window resize", () => {
    render(<ContextMenuPortal />);
    openMenu();
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("executes the item with the active context and closes", () => {
    const execute = vi.fn();
    useContextMenuRegistry
      .getState()
      .register(makeItem({ id: "two", label: "Second", execute }));
    render(<ContextMenuPortal />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Second" }));
    expect(execute).toHaveBeenCalledWith({ location: "file-tree" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("never positions the menu past the viewport edge", () => {
    render(<ContextMenuPortal />);
    openMenu({ x: window.innerWidth + 500, y: window.innerHeight + 500 });
    const menu = screen.getByRole("menu");
    const left = Number.parseFloat(menu.style.left);
    const top = Number.parseFloat(menu.style.top);
    expect(left).toBeLessThan(window.innerWidth);
    expect(top).toBeLessThan(window.innerHeight);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
  });
});

describe("clampMenuPosition", () => {
  const viewport = { width: 1000, height: 800 };
  const size = { width: 200, height: 100 };

  it("keeps a position that already fits", () => {
    expect(clampMenuPosition({ x: 100, y: 100 }, size, viewport)).toEqual({
      left: 100,
      top: 100,
    });
  });

  it("shifts the menu back inside when it would overflow", () => {
    expect(clampMenuPosition({ x: 950, y: 780 }, size, viewport)).toEqual({
      left: 1000 - 200 - 8,
      top: 800 - 100 - 8,
    });
  });

  it("never returns a negative offset", () => {
    const huge = { width: 2000, height: 2000 };
    expect(clampMenuPosition({ x: 0, y: 0 }, huge, viewport)).toEqual({
      left: 8,
      top: 8,
    });
  });
});
