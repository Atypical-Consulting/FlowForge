import { render } from "../../../../test-utils/render";

const mockCommands = vi.hoisted(() => ({
  generateChangelogCmd: vi.fn().mockResolvedValue({
    status: "ok",
    data: { markdown: "", commitCount: 0, groups: [] },
  }),
}));

vi.mock("../../../../bindings", () => ({
  commands: mockCommands,
}));

import { ChangelogBlade } from "./ChangelogBlade";

describe("ChangelogBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<ChangelogBlade />);
    expect(container.firstChild).not.toBeNull();
  });
});
