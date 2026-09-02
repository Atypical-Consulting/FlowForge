import { getMonacoTheme, MONACO_THEMES } from "../monacoConfig";

describe("monacoConfig", () => {
  it("maps the light flavour to the light Monaco theme", () => {
    expect(getMonacoTheme("latte")).toBe("flowforge-light");
  });

  it("maps the dark flavour to the dark Monaco theme", () => {
    expect(getMonacoTheme("mocha")).toBe("flowforge-dark");
  });

  it("registers a distinct theme name per flavour", () => {
    expect(MONACO_THEMES.latte).not.toBe(MONACO_THEMES.mocha);
  });
});
