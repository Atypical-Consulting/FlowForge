import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "../../../core/test-utils/render";

const diffEditorProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@monaco-editor/react", () => ({
  DiffEditor: (props: Record<string, unknown>) => {
    diffEditorProps.current = props;
    return <div data-testid="mock-diff-editor" />;
  },
  default: () => <div data-testid="mock-editor" />,
  loader: {
    config: vi.fn(),
    init: vi.fn().mockResolvedValue({ editor: { defineTheme: vi.fn() } }),
  },
}));

import { ConflictDiffView } from "../blades/components/ConflictDiffView";

describe("ConflictDiffView", () => {
  beforeEach(() => {
    diffEditorProps.current = null;
  });

  it("gives the diff editor a definite height inside a resizable panel", () => {
    render(
      <ConflictDiffView
        oursContent={"Conflict line from develop\n"}
        theirsContent={"Conflict line from conflict-a\n"}
        language="markdown"
        oursName="develop"
        theirsName="conflict-a"
      />,
    );

    // The parent Panel is a flex item, not a flex container, so `flex-1`
    // alone collapsed the wrapper (and Monaco) to 0px. The wrapper must
    // claim the panel's full height explicitly.
    const wrapper = screen.getByTestId("conflict-diff-view");
    expect(wrapper).toHaveClass("h-full");
    expect(wrapper).toHaveClass("flex", "flex-col");

    const editorContainer = screen.getByTestId(
      "conflict-diff-editor-container",
    );
    expect(editorContainer).toHaveClass("flex-1", "min-h-0", "h-full");
    expect(editorContainer).toContainElement(
      screen.getByTestId("mock-diff-editor"),
    );
  });

  it("renders the branch labels and feeds ours/theirs to the diff editor", () => {
    render(
      <ConflictDiffView
        oursContent={"Conflict line from develop\n"}
        theirsContent={"Conflict line from conflict-a\n"}
        language="markdown"
        oursName="develop"
        theirsName="conflict-a"
      />,
    );

    expect(screen.getByText("develop (Ours)")).toBeInTheDocument();
    expect(screen.getByText("conflict-a (Theirs)")).toBeInTheDocument();
    // prepareDiffContent strips the single trailing newline on both sides
    expect(diffEditorProps.current?.original).toBe(
      "Conflict line from develop",
    );
    expect(diffEditorProps.current?.modified).toBe(
      "Conflict line from conflict-a",
    );
    expect(diffEditorProps.current?.language).toBe("markdown");
  });
});
