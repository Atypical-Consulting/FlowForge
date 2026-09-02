import { invoke } from "@tauri-apps/api/core";
import {
  applyWindowDecorations,
  isWindowDecorationsMode,
} from "../windowDecorations";

describe("windowDecorations", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("recognises the three preference values only", () => {
    expect(isWindowDecorationsMode("auto")).toBe(true);
    expect(isWindowDecorationsMode("always")).toBe(true);
    expect(isWindowDecorationsMode("never")).toBe(true);
    expect(isWindowDecorationsMode("sometimes")).toBe(false);
    expect(isWindowDecorationsMode(undefined)).toBe(false);
  });

  it("'always' forces decorations on", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await applyWindowDecorations("always");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("set_window_decorations", {
      enabled: true,
    });
  });

  it("'never' forces decorations off", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await applyWindowDecorations("never");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("set_window_decorations", {
      enabled: false,
    });
  });

  it("'auto' defers to the Rust detection", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) =>
      cmd === "get_default_window_decorations" ? true : undefined,
    );
    await applyWindowDecorations("auto");
    expect(invoke).toHaveBeenNthCalledWith(1, "get_default_window_decorations");
    expect(invoke).toHaveBeenNthCalledWith(2, "set_window_decorations", {
      enabled: true,
    });
  });
});
