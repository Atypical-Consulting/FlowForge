import { render } from "../../test-utils/render";

const mockCommands = vi.hoisted(() => ({
  getStagingStatus: vi.fn().mockResolvedValue({
    status: "ok",
    data: { staged: [], unstaged: [], untracked: [] },
  }),
  getFileDiff: vi.fn().mockResolvedValue({
    status: "ok",
    data: { path: "", oldContent: "", newContent: "", hunks: [], isBinary: false, language: "text" },
  }),
  stageFile: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  unstageFile: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  stageAll: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  unstageAll: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  suggestCommitType: vi.fn().mockResolvedValue({
    status: "ok",
    data: { suggestedType: "feat", confidence: "medium", reason: "" },
  }),
  getScopeSuggestions: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
  inferScopeFromStaged: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  createCommit: vi.fn().mockResolvedValue({
    status: "ok",
    data: { oid: "abc", shortOid: "abc", message: "" },
  }),
  validateConventionalCommit: vi.fn().mockResolvedValue({
    isValid: true,
    errors: [],
    warnings: [],
  }),
  getLastCommitMessage: vi.fn().mockResolvedValue({
    status: "ok",
    data: { subject: "", body: null, fullMessage: "" },
  }),
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

import { StagingChangesBlade } from "./StagingChangesBlade";

describe("StagingChangesBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<StagingChangesBlade />);
    expect(container.firstChild).not.toBeNull();
  });
});
