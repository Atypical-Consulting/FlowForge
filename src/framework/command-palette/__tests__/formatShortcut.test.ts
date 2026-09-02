import { formatShortcut } from "../formatShortcut";

function setPlatform(platform: string) {
  Object.defineProperty(navigator, "platform", {
    value: platform,
    configurable: true,
  });
}

describe("formatShortcut", () => {
  const originalPlatform = navigator.platform;

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  describe("on non-Mac platforms", () => {
    beforeEach(() => setPlatform("Linux x86_64"));

    it("uppercases single-letter keys", () => {
      expect(formatShortcut("mod+n")).toBe("Ctrl+N");
      expect(formatShortcut("mod+o")).toBe("Ctrl+O");
    });

    it("renders the same output regardless of declared key casing", () => {
      expect(formatShortcut("mod+shift+n")).toBe("Ctrl+Shift+N");
      expect(formatShortcut("mod+shift+N")).toBe("Ctrl+Shift+N");
    });

    it("leaves punctuation and digits untouched", () => {
      expect(formatShortcut("mod+,")).toBe("Ctrl+,");
      expect(formatShortcut("mod+\\")).toBe("Ctrl+\\");
      expect(formatShortcut("mod+1")).toBe("Ctrl+1");
    });

    it("capitalises multi-character key names", () => {
      expect(formatShortcut("mod+enter")).toBe("Ctrl+Enter");
      expect(formatShortcut("alt+f5")).toBe("Alt+F5");
    });

    it("matches modifier tokens case-insensitively", () => {
      expect(formatShortcut("Mod+Shift+a")).toBe("Ctrl+Shift+A");
    });
  });

  describe("on Mac", () => {
    beforeEach(() => setPlatform("MacIntel"));

    it("uses symbols and drops the separators", () => {
      expect(formatShortcut("mod+shift+o")).toBe("⌘⇧O");
      expect(formatShortcut("alt+n")).toBe("⌥N");
      expect(formatShortcut("mod+,")).toBe("⌘,");
    });
  });
});
