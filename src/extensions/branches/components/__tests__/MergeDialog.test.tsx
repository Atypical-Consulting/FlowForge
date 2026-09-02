import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MergeResult } from "../../../../bindings";

const mockOpenBlade = vi.hoisted(() => vi.fn());

vi.mock("../../../../bindings", () => ({ commands: {} }));
vi.mock("@/framework/layout/bladeOpener", () => ({
  openBlade: mockOpenBlade,
}));

import { MergeDialog } from "../MergeDialog";

const conflictedResult: MergeResult = {
  success: false,
  analysis: "normal",
  commitOid: null,
  fastForwarded: false,
  hasConflicts: true,
  conflictedFiles: ["README.md"],
};

const cleanResult: MergeResult = {
  success: true,
  analysis: "normal",
  commitOid: "abc123",
  fastForwarded: false,
  hasConflicts: false,
  conflictedFiles: [],
};

describe("MergeDialog conflict result", () => {
  beforeEach(() => {
    mockOpenBlade.mockReset();
  });

  it("lists the conflicted files and offers the conflict resolver next to Abort Merge", () => {
    render(
      <MergeDialog
        sourceBranch="conflict-a"
        result={conflictedResult}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Merge conflicts detected")).toBeInTheDocument();
    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open conflict resolver/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /abort merge/i }),
    ).toBeInTheDocument();
  });

  it("opens the conflict-resolution blade and closes the dialog", async () => {
    const onClose = vi.fn();
    render(
      <MergeDialog
        sourceBranch="conflict-a"
        result={conflictedResult}
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /open conflict resolver/i }),
    );

    expect(mockOpenBlade).toHaveBeenCalledWith("conflict-resolution", {});
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not offer the resolver after a clean merge", () => {
    render(
      <MergeDialog
        sourceBranch="feature"
        result={cleanResult}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/merged successfully/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /open conflict resolver/i }),
    ).not.toBeInTheDocument();
  });
});
