import { render } from "../../../core/test-utils/render";

const mockCommands = vi.hoisted(() => ({
  getFileBase64: vi.fn().mockResolvedValue({
    status: "ok",
    data: "data:image/png;base64,iVBOR",
  }),
}));

vi.mock("../../../bindings", () => ({
  commands: mockCommands,
}));

import { ViewerImageBlade } from "./ViewerImageBlade";

describe("ViewerImageBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<ViewerImageBlade filePath="test.png" />);
    expect(container.firstChild).not.toBeNull();
  });
});
