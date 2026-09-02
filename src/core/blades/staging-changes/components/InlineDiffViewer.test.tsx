import { act, screen, waitFor } from "@testing-library/react";
import { usePreferencesStore } from "../../../stores/domain/preferences";
import { render } from "../../../test-utils/render";

const mockCommands = vi.hoisted(() => ({
  getFileDiff: vi.fn().mockResolvedValue({
    status: "ok",
    data: {
      path: "package.json",
      oldContent: '{"name":"demo","version":"1.0.0"}\n',
      newContent: '{"name":"demo","version":"1.0.0"}\nmodified\n',
      hunks: [],
      isBinary: false,
      language: "json",
    },
  }),
}));

vi.mock("../../../../bindings", () => ({
  commands: mockCommands,
}));

const diffEditorProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@monaco-editor/react", () => ({
  DiffEditor: (props: Record<string, unknown>) => {
    diffEditorProps.current = props;
    return (
      <div data-testid="mock-diff-editor" data-theme={props.theme as string} />
    );
  },
  default: () => <div data-testid="mock-editor" />,
  loader: {
    config: vi.fn(),
    init: vi.fn().mockResolvedValue({ editor: { defineTheme: vi.fn() } }),
  },
}));

import { INLINE_DIFF_OPTIONS, InlineDiffViewer } from "./InlineDiffViewer";

describe("InlineDiffViewer", () => {
  beforeEach(() => {
    diffEditorProps.current = null;
  });

  describe("gutter layout", () => {
    it("reserves room between the line numbers and the code for +/- indicators", () => {
      // Monaco draws the +/- change indicators in the line-decorations area,
      // which sits between the line numbers and the content. A width of 0
      // hides the indicators and glues the numbers to the code.
      expect(INLINE_DIFF_OPTIONS.renderIndicators).toBe(true);
      expect(typeof INLINE_DIFF_OPTIONS.lineDecorationsWidth).toBe("number");
      expect(INLINE_DIFF_OPTIONS.lineDecorationsWidth).toBeGreaterThanOrEqual(
        10,
      );
    });

    it("keeps fixed-width line-number columns", () => {
      expect(INLINE_DIFF_OPTIONS.lineNumbers).toBe("on");
      expect(INLINE_DIFF_OPTIONS.lineNumbersMinChars).toBeGreaterThanOrEqual(3);
    });

    it("passes the gutter options to the diff editor", async () => {
      render(<InlineDiffViewer filePath="package.json" staged={false} />);
      await screen.findByTestId("mock-diff-editor");
      expect(diffEditorProps.current?.options).toBe(INLINE_DIFF_OPTIONS);
    });
  });

  describe("theme", () => {
    it("uses the light Monaco theme when the app theme resolves to latte", async () => {
      act(() => {
        usePreferencesStore.setState({ themeResolved: "latte" });
      });
      render(<InlineDiffViewer filePath="package.json" staged={false} />);
      const editor = await screen.findByTestId("mock-diff-editor");
      expect(editor).toHaveAttribute("data-theme", "flowforge-light");
    });

    it("uses the dark Monaco theme when the app theme resolves to mocha", async () => {
      act(() => {
        usePreferencesStore.setState({ themeResolved: "mocha" });
      });
      render(<InlineDiffViewer filePath="package.json" staged={false} />);
      const editor = await screen.findByTestId("mock-diff-editor");
      expect(editor).toHaveAttribute("data-theme", "flowforge-dark");
    });

    it("switches the Monaco theme when the app theme changes", async () => {
      act(() => {
        usePreferencesStore.setState({ themeResolved: "mocha" });
      });
      render(<InlineDiffViewer filePath="package.json" staged={false} />);
      const editor = await screen.findByTestId("mock-diff-editor");
      expect(editor).toHaveAttribute("data-theme", "flowforge-dark");

      act(() => {
        usePreferencesStore.setState({ themeResolved: "latte" });
      });
      await waitFor(() => {
        expect(screen.getByTestId("mock-diff-editor")).toHaveAttribute(
          "data-theme",
          "flowforge-light",
        );
      });
    });
  });
});
