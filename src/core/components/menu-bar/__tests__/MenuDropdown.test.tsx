import { render, screen } from "@testing-library/react";
import { GitBranch } from "lucide-react";
import { MenuDropdown } from "../MenuDropdown";
import type { MenuEntryDef } from "../menu-definitions";

vi.mock("@/framework/command-palette/commandRegistry", () => ({
  getCommandById: () => ({ id: "create-branch" }),
}));

const items: MenuEntryDef[] = [
  {
    type: "action",
    id: "branch-new",
    label: "New Branch...",
    icon: GitBranch,
    shortcut: "mod+shift+n",
    commandId: "create-branch",
  },
];

describe("MenuDropdown", () => {
  it("sizes the dropdown to its content so labels never wrap", () => {
    render(
      <MenuDropdown
        items={items}
        highlightedIndex={-1}
        onItemClick={() => {}}
        onKeyDown={() => {}}
        onSetHighlightedIndex={() => {}}
      />,
    );

    expect(screen.getByRole("menu")).toHaveClass("w-max");
    expect(screen.getByText("New Branch...")).toHaveClass("whitespace-nowrap");
  });
});
