import { render, screen } from "../../test-utils/render";

const mockCommands = vi.hoisted(() => ({
  readRepoFile: vi.fn(),
}));

vi.mock("../../../bindings", () => ({
  commands: mockCommands,
}));

import { ViewerPlaintextBlade } from "./ViewerPlaintextBlade";

describe("ViewerPlaintextBlade", () => {
  it("renders text content", async () => {
    mockCommands.readRepoFile.mockResolvedValue({
      status: "ok",
      data: { content: "hello world", isBinary: false, size: 11 },
    });

    render(<ViewerPlaintextBlade filePath="test.txt" />);
    expect(await screen.findByText("hello world")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    // Never resolve to keep loading
    mockCommands.readRepoFile.mockReturnValue(new Promise(() => {}));

    const { container } = render(<ViewerPlaintextBlade filePath="test.txt" />);
    expect(container.firstChild).not.toBeNull();
  });

  it("shows binary placeholder", async () => {
    mockCommands.readRepoFile.mockResolvedValue({
      status: "ok",
      data: { content: "", isBinary: true, size: 1024 },
    });

    render(<ViewerPlaintextBlade filePath="image.exe" />);
    expect(await screen.findByText("Binary file")).toBeInTheDocument();
  });
});
