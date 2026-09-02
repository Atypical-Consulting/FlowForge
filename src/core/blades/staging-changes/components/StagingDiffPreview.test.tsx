import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFileChange } from "../../../test-utils/mocks/tauri-commands";
import { render } from "../../../test-utils/render";

const mockOpenBlade = vi.hoisted(() => vi.fn());

vi.mock("@/framework/layout/bladeOpener", () => ({
  openBlade: mockOpenBlade,
}));

vi.mock("./InlineDiffViewer", () => ({
  InlineDiffViewer: ({ filePath }: { filePath: string }) => (
    <div data-testid="mock-inline-diff">{filePath}</div>
  ),
}));

import { StagingDiffPreview } from "./StagingDiffPreview";

describe("StagingDiffPreview conflict affordance", () => {
  beforeEach(() => {
    mockOpenBlade.mockReset();
  });

  it("offers to open the conflict resolver for a conflicted file", async () => {
    const file = createFileChange({ path: "README.md", status: "conflicted" });
    render(
      <StagingDiffPreview file={file} section="unstaged" onExpand={vi.fn()} />,
    );

    const button = screen.getByRole("button", {
      name: "Open conflict resolver",
    });
    expect(button).toBeInTheDocument();
    // The raw marker diff is still shown underneath
    expect(screen.getByTestId("mock-inline-diff")).toHaveTextContent(
      "README.md",
    );

    await userEvent.click(button);

    expect(mockOpenBlade).toHaveBeenCalledWith("conflict-resolution", {
      filePath: "README.md",
    });
  });

  it("does not show the affordance for a regular change", () => {
    const file = createFileChange({ path: "README.md", status: "modified" });
    render(
      <StagingDiffPreview file={file} section="unstaged" onExpand={vi.fn()} />,
    );

    expect(
      screen.queryByRole("button", { name: "Open conflict resolver" }),
    ).not.toBeInTheDocument();
  });
});
