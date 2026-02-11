import { render } from "../../test-utils/render";

const mockCommands = vi.hoisted(() => ({
  listRepoFiles: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
}));

vi.mock("../../../bindings", () => ({
  commands: mockCommands,
}));

import { RepoBrowserBlade } from "./RepoBrowserBlade";

describe("RepoBrowserBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<RepoBrowserBlade />);
    expect(container.firstChild).not.toBeNull();
  });
});
