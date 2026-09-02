import { fireEvent, render, screen } from "@testing-library/react";
import { GitBranch } from "lucide-react";
import type { ToolbarAction } from "@/framework/extension-system/toolbarRegistry";
import { ToolbarOverflowMenu } from "../ToolbarOverflowMenu";

const actions: ToolbarAction[] = [
  {
    id: "tb:create-branch",
    label: "Create Branch",
    icon: GitBranch,
    group: "git-actions",
    priority: 1,
    shortcut: "mod+shift+b",
    execute: () => {},
  },
];

describe("ToolbarOverflowMenu", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "platform", {
      value: "Linux x86_64",
      configurable: true,
    });
  });

  it("sizes the menu to its content and keeps labels on one line", () => {
    render(<ToolbarOverflowMenu actions={actions} count={1} />);
    fireEvent.click(screen.getByRole("button", { name: "1 more actions" }));

    expect(screen.getByRole("menu")).toHaveClass("w-max");
    expect(screen.getByText("Create Branch")).toHaveClass("whitespace-nowrap");
    expect(screen.getByText("Ctrl+Shift+B")).toHaveClass(
      "ml-8",
      "shrink-0",
      "whitespace-nowrap",
    );
  });
});
