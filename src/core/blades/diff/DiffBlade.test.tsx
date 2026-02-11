import { render } from "../../test-utils/render";

const mockCommands = vi.hoisted(() => ({
  getFileDiff: vi.fn().mockResolvedValue({
    status: "ok",
    data: { path: "test.ts", oldContent: "", newContent: "", hunks: [], isBinary: false, language: "typescript" },
  }),
  getCommitFileDiff: vi.fn().mockResolvedValue({
    status: "ok",
    data: { path: "test.ts", oldContent: "", newContent: "", hunks: [], isBinary: false, language: "typescript" },
  }),
  getStagingStatus: vi.fn().mockResolvedValue({
    status: "ok",
    data: { staged: [], unstaged: [], untracked: [] },
  }),
  stageFile: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  unstageFile: vi.fn().mockResolvedValue({ status: "ok", data: null }),
}));

vi.mock("../../../bindings", () => ({
  commands: mockCommands,
}));

vi.mock("@monaco-editor/react", () => ({
  DiffEditor: () => <div data-testid="mock-diff-editor" />,
  default: () => <div data-testid="mock-editor" />,
  loader: {
    config: vi.fn(),
    init: vi.fn().mockResolvedValue({ editor: { defineTheme: vi.fn() } }),
  },
}));

import { DiffBlade } from "./DiffBlade";

describe("DiffBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <DiffBlade source={{ mode: "staging", filePath: "test.ts", staged: false }} />,
    );
    expect(container.firstChild).not.toBeNull();
  });
});
