import { render } from "../../test-utils/render";

const mockCommands = vi.hoisted(() => ({
  readRepoFile: vi.fn().mockResolvedValue({
    status: "ok",
    data: { content: "# Hello World", isBinary: false, size: 13 },
  }),
}));

vi.mock("../../bindings", () => ({
  commands: mockCommands,
}));

import { ViewerMarkdownBlade } from "./ViewerMarkdownBlade";

describe("ViewerMarkdownBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<ViewerMarkdownBlade filePath="README.md" />);
    expect(container.firstChild).not.toBeNull();
  });
});
