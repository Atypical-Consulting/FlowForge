import { render } from "../../test-utils/render";

const mockCommands = vi.hoisted(() => ({
  getCommitDetails: vi.fn().mockResolvedValue({
    status: "ok",
    data: {
      oid: "abc1234567890abcdef1234567890abcdef123456",
      shortOid: "abc1234",
      message: "feat: test commit",
      authorName: "Test",
      authorEmail: "test@test.com",
      authorTimestampMs: Date.now(),
      committerName: "Test",
      committerEmail: "test@test.com",
      committerTimestampMs: Date.now(),
      parentOids: [],
      filesChanged: [],
    },
  }),
  getCommitFileDiff: vi.fn().mockResolvedValue({
    status: "ok",
    data: { path: "", oldContent: "", newContent: "", hunks: [], isBinary: false, language: "text" },
  }),
}));

vi.mock("../../bindings", () => ({
  commands: mockCommands,
}));

import { CommitDetailsBlade } from "./CommitDetailsBlade";

describe("CommitDetailsBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<CommitDetailsBlade oid="abc1234" />);
    expect(container.firstChild).not.toBeNull();
  });
});
