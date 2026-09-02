import { render, screen } from "@testing-library/react";
import { MenuItem } from "../MenuItem";

describe("MenuItem", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "platform", {
      value: "Linux x86_64",
      configurable: true,
    });
  });

  it("keeps the label on a single line when a shortcut is shown", () => {
    render(
      <MenuItem
        label="Clone Repository..."
        shortcut="mod+shift+o"
        onClick={() => {}}
        onMouseEnter={() => {}}
      />,
    );

    expect(screen.getByText("Clone Repository...")).toHaveClass(
      "whitespace-nowrap",
    );
  });

  it("renders the shortcut with normalised casing and a fixed gap", () => {
    render(
      <MenuItem
        label="New Branch..."
        shortcut="mod+shift+n"
        onClick={() => {}}
        onMouseEnter={() => {}}
      />,
    );

    const shortcut = screen.getByText("Ctrl+Shift+N");
    expect(shortcut).toHaveClass("ml-8", "shrink-0", "whitespace-nowrap");
  });

  it("does not invoke onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <MenuItem
        label="Disabled"
        disabled
        onClick={onClick}
        onMouseEnter={() => {}}
      />,
    );

    screen.getByRole("menuitem").click();
    expect(onClick).not.toHaveBeenCalled();
  });
});
