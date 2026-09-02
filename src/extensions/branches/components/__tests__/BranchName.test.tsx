import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BranchName, splitBranchName } from "../BranchName";

describe("splitBranchName", () => {
  it("keeps names without a slash as the leaf", () => {
    expect(splitBranchName("main")).toEqual({ prefix: "", leaf: "main" });
  });

  it("splits on the last slash", () => {
    expect(splitBranchName("feature/login")).toEqual({
      prefix: "feature/",
      leaf: "login",
    });
    expect(splitBranchName("origin/feature/login")).toEqual({
      prefix: "origin/feature/",
      leaf: "login",
    });
  });

  it("does not produce an empty leaf for a trailing slash", () => {
    expect(splitBranchName("weird/")).toEqual({ prefix: "", leaf: "weird/" });
  });
});

describe("BranchName", () => {
  it("fills the row, can shrink, and exposes the full name as a tooltip", () => {
    render(<BranchName name="origin/feature/login" />);

    const name = screen.getByTestId("branch-name");
    expect(name).toHaveAttribute("title", "origin/feature/login");
    expect(name).toHaveClass("flex", "min-w-0", "flex-1", "overflow-hidden");
  });

  it("truncates the prefix before the last segment", () => {
    render(<BranchName name="origin/feature/login" />);

    const prefix = screen.getByTestId("branch-name-prefix");
    const leaf = screen.getByTestId("branch-name-leaf");

    expect(prefix).toHaveTextContent("origin/feature/");
    expect(prefix).toHaveAttribute("dir", "rtl");
    expect(prefix).toHaveClass("truncate", "min-w-0", "shrink-[1000]");
    expect(leaf).toHaveTextContent("login");
    expect(leaf).toHaveClass("truncate", "min-w-0");
  });

  it("renders no prefix element for simple names", () => {
    render(<BranchName name="develop" />);

    expect(screen.queryByTestId("branch-name-prefix")).not.toBeInTheDocument();
    expect(screen.getByTestId("branch-name-leaf")).toHaveTextContent("develop");
    expect(screen.getByTestId("branch-name")).toHaveAttribute(
      "title",
      "develop",
    );
  });
});
