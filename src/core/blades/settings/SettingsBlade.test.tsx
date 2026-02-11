import { render } from "../../test-utils/render";
import { SettingsBlade } from "./SettingsBlade";

describe("SettingsBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<SettingsBlade />);
    expect(container.firstChild).not.toBeNull();
  });
});
