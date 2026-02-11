import { render } from "../../../core/test-utils/render";

const mockCommands = vi.hoisted(() => ({
  readRepoFile: vi.fn().mockResolvedValue({
    status: "ok",
    data: { content: "", isBinary: true, size: 0 },
  }),
}));

vi.mock("../../../bindings", () => ({
  commands: mockCommands,
}));

import { ViewerNupkgBlade } from "./ViewerNupkgBlade";

describe("ViewerNupkgBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<ViewerNupkgBlade filePath="test.nupkg" />);
    expect(container.firstChild).not.toBeNull();
  });
});
