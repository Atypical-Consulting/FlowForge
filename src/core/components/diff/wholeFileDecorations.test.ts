import { describe, expect, it } from "vitest";
import { buildWholeFileDecorations } from "./wholeFileDecorations";

describe("buildWholeFileDecorations", () => {
  it("marks every line of a new file as added with Monaco's own diff classes", () => {
    const decorations = buildWholeFileDecorations(3, "added");

    expect(decorations).toHaveLength(1);
    const [decoration] = decorations;
    expect(decoration.range).toEqual({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 3,
      endColumn: 1,
    });
    expect(decoration.options.isWholeLine).toBe(true);
    expect(decoration.options.className).toBe("line-insert");
    expect(decoration.options.marginClassName).toBe("gutter-insert");
    expect(decoration.options.linesDecorationsClassName).toContain(
      "insert-sign",
    );
    expect(decoration.options.linesDecorationsClassName).toContain(
      "codicon-diff-insert",
    );
  });

  it("marks every line of a deleted file as removed", () => {
    const [decoration] = buildWholeFileDecorations(2, "deleted");

    expect(decoration.range.endLineNumber).toBe(2);
    expect(decoration.options.className).toBe("line-delete");
    expect(decoration.options.marginClassName).toBe("gutter-delete");
    expect(decoration.options.linesDecorationsClassName).toContain(
      "delete-sign",
    );
    expect(decoration.options.linesDecorationsClassName).toContain(
      "codicon-diff-remove",
    );
  });

  it("covers a single-line file (the untracked 'tmp' case) with exactly one added line", () => {
    const [decoration] = buildWholeFileDecorations(1, "added");

    expect(decoration.range.startLineNumber).toBe(1);
    expect(decoration.range.endLineNumber).toBe(1);
  });

  it("returns nothing for a document without lines", () => {
    expect(buildWholeFileDecorations(0, "added")).toEqual([]);
    expect(buildWholeFileDecorations(-1, "deleted")).toEqual([]);
  });
});
