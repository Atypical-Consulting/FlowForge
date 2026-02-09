import { render } from "../../test-utils/render";

const mockCommands = vi.hoisted(() => ({
  readRepoFile: vi.fn().mockResolvedValue({
    status: "ok",
    data: { content: "console.log('hello');", isBinary: false, size: 22 },
  }),
}));

vi.mock("../../bindings", () => ({
  commands: mockCommands,
}));

vi.mock("@monaco-editor/react", () => ({
  default: () => <div data-testid="mock-monaco-editor" />,
  Editor: () => <div data-testid="mock-monaco-editor" />,
  loader: {
    config: vi.fn(),
    init: vi.fn().mockResolvedValue({ editor: { defineTheme: vi.fn() } }),
  },
}));

import { ViewerCodeBlade } from "./ViewerCodeBlade";

describe("ViewerCodeBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<ViewerCodeBlade filePath="test.ts" />);
    expect(container.firstChild).not.toBeNull();
  });
});
