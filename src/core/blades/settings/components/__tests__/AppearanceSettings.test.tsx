import { invoke } from "@tauri-apps/api/core";
import { usePreferencesStore } from "../../../../stores/domain/preferences";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "../../../../test-utils/render";
import { AppearanceSettings } from "../AppearanceSettings";

describe("AppearanceSettings", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  it("renders the window title bar select with the three options, defaulting to auto", () => {
    render(<AppearanceSettings />);

    const select = screen.getByLabelText(
      "Window title bar",
    ) as HTMLSelectElement;
    expect(select.value).toBe("auto");
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "Auto (hide on tiling compositors)",
      "Always show",
      "Never show",
    ]);
  });

  it("reflects the stored preference", () => {
    usePreferencesStore.setState((s) => ({
      settingsData: {
        ...s.settingsData,
        window: { decorations: "always" },
      },
    }));

    render(<AppearanceSettings />);

    expect(
      (screen.getByLabelText("Window title bar") as HTMLSelectElement).value,
    ).toBe("always");
  });

  it("changing the select updates the setting and applies it immediately", async () => {
    render(<AppearanceSettings />);

    fireEvent.change(screen.getByLabelText("Window title bar"), {
      target: { value: "never" },
    });

    await waitFor(() => {
      expect(
        usePreferencesStore.getState().settingsData.window.decorations,
      ).toBe("never");
    });
    expect(invoke).toHaveBeenCalledWith("set_window_decorations", {
      enabled: false,
    });
    expect(
      (screen.getByLabelText("Window title bar") as HTMLSelectElement).value,
    ).toBe("never");
  });
});
