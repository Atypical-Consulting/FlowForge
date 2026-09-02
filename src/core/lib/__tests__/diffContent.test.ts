import { describe, expect, it } from "vitest";
import {
  classifyDiffContent,
  hasTrailingNewline,
  prepareDiffContent,
  stripTrailingNewline,
} from "../diffContent";

/** Split the way Monaco's text model does: every separator starts a new line. */
const monacoLines = (text: string): string[] => text.split(/\r?\n/);

describe("prepareDiffContent", () => {
  describe("untracked (new) file", () => {
    it("renders a single-line file with a trailing newline as exactly one added line", () => {
      const { original, modified, kind } = prepareDiffContent("", "tmp\n");

      // No phantom removed line: the original side must be an empty document.
      expect(original).toBe("");
      // No phantom trailing added line: exactly one line on the modified side.
      expect(monacoLines(modified)).toEqual(["tmp"]);
      // Monaco cannot represent an empty original without a phantom deleted
      // line, so the diff must be flagged for single-sided rendering.
      expect(kind).toBe("added");
    });

    it("keeps a new file without a trailing newline as-is", () => {
      const { original, modified } = prepareDiffContent("", "tmp");

      expect(original).toBe("");
      expect(monacoLines(modified)).toEqual(["tmp"]);
    });

    it("keeps interior empty lines and strips only the final terminator", () => {
      const { modified } = prepareDiffContent("", "a\n\nb\n\n");

      expect(monacoLines(modified)).toEqual(["a", "", "b", ""]);
    });
  });

  describe("deleted file", () => {
    it("renders as removed lines with an empty modified document", () => {
      const { original, modified, kind } = prepareDiffContent("gone\n", "");

      expect(monacoLines(original)).toEqual(["gone"]);
      expect(modified).toBe("");
      expect(kind).toBe("deleted");
    });
  });

  describe("kind classification", () => {
    it("flags a two-sided diff as modified", () => {
      expect(prepareDiffContent("a\n", "b\n").kind).toBe("modified");
      expect(classifyDiffContent("a", "b")).toBe("modified");
    });

    it("treats two empty sides as modified (nothing single-sided to show)", () => {
      expect(classifyDiffContent("", "")).toBe("modified");
    });

    it("distinguishes an absent file from a real one-line empty document", () => {
      // "" is zero bytes: the file does not exist on that side.
      expect(classifyDiffContent("", "tmp\n")).toBe("added");
      // "\n" is a real file holding one empty line: git reports a line
      // replaced by "tmp", so this must stay a two-sided diff.
      expect(classifyDiffContent("\n", "tmp\n")).toBe("modified");
    });

    it("flags a new file even when it only contains an empty line", () => {
      const { modified, kind } = prepareDiffContent("", "\n");

      expect(kind).toBe("added");
      expect(monacoLines(modified)).toEqual([""]);
    });
  });

  describe("modified file", () => {
    it("does not add an empty last line when both sides end with a newline", () => {
      const oldText = "line 1\nline 2\n";
      const newText = "line 1\nline 2\nline 3\n";

      const { original, modified } = prepareDiffContent(oldText, newText);

      expect(monacoLines(original)).toEqual(["line 1", "line 2"]);
      expect(monacoLines(modified)).toEqual(["line 1", "line 2", "line 3"]);
      expect(modified.endsWith("\n")).toBe(false);
    });

    it("handles CRLF line endings the same way", () => {
      const { original, modified } = prepareDiffContent(
        "a\r\nb\r\n",
        "a\r\nb\r\nc\r\n",
      );

      expect(monacoLines(original)).toEqual(["a", "b"]);
      expect(monacoLines(modified)).toEqual(["a", "b", "c"]);
    });

    it("leaves both sides untouched when neither ends with a newline", () => {
      const { original, modified } = prepareDiffContent("a\nb", "a\nb\nc");

      expect(original).toBe("a\nb");
      expect(modified).toBe("a\nb\nc");
    });

    it('preserves "\\ No newline at end of file" differences (newline removed)', () => {
      const { original, modified } = prepareDiffContent("a\nb\n", "a\nb");

      // The trailing newline state differs, so nothing is stripped and Monaco
      // still shows the change at the end of the file.
      expect(original).toBe("a\nb\n");
      expect(modified).toBe("a\nb");
      expect(original).not.toBe(modified);
    });

    it('preserves "\\ No newline at end of file" differences (newline added)', () => {
      const { original, modified } = prepareDiffContent("a\nb", "a\nb\n");

      expect(original).toBe("a\nb");
      expect(modified).toBe("a\nb\n");
    });
  });

  describe("empty and whitespace-only documents", () => {
    it("returns empty documents for two empty inputs", () => {
      expect(prepareDiffContent("", "")).toEqual({
        original: "",
        modified: "",
        kind: "modified",
      });
    });

    it("keeps a file made of a single empty line as one line", () => {
      // git counts "\n" as one (empty) line; Monaco must agree.
      const { original, modified } = prepareDiffContent("\n", "\n");

      expect(monacoLines(original)).toEqual([""]);
      expect(monacoLines(modified)).toEqual([""]);
    });
  });
});

describe("hasTrailingNewline", () => {
  it("detects LF and CRLF terminators", () => {
    expect(hasTrailingNewline("a\n")).toBe(true);
    expect(hasTrailingNewline("a\r\n")).toBe(true);
    expect(hasTrailingNewline("a")).toBe(false);
    expect(hasTrailingNewline("")).toBe(false);
  });
});

describe("stripTrailingNewline", () => {
  it("removes exactly one terminator", () => {
    expect(stripTrailingNewline("a\n")).toBe("a");
    expect(stripTrailingNewline("a\r\n")).toBe("a");
    expect(stripTrailingNewline("a\n\n")).toBe("a\n");
    expect(stripTrailingNewline("a")).toBe("a");
    expect(stripTrailingNewline("")).toBe("");
  });
});
