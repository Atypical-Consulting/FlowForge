import { FLOWFORGE_DARK_THEME, FLOWFORGE_LIGHT_THEME } from "../monacoTheme";

describe("monacoTheme", () => {
  it("builds the dark theme on Monaco's dark base", () => {
    expect(FLOWFORGE_DARK_THEME.base).toBe("vs-dark");
    // Catppuccin Mocha crust
    expect(FLOWFORGE_DARK_THEME.colors["editor.background"]).toBe("#11111b");
  });

  it("builds the light theme on Monaco's light base", () => {
    expect(FLOWFORGE_LIGHT_THEME.base).toBe("vs");
    // Catppuccin Latte base
    expect(FLOWFORGE_LIGHT_THEME.colors["editor.background"]).toBe("#eff1f5");
  });

  it("defines the same color keys for both flavours", () => {
    expect(Object.keys(FLOWFORGE_LIGHT_THEME.colors).sort()).toEqual(
      Object.keys(FLOWFORGE_DARK_THEME.colors).sort(),
    );
    expect(FLOWFORGE_LIGHT_THEME.rules.map((r) => r.token)).toEqual(
      FLOWFORGE_DARK_THEME.rules.map((r) => r.token),
    );
  });
});
