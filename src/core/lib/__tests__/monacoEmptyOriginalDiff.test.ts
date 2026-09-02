/**
 * Characterization test for the Monaco behaviour behind the "phantom removed
 * line" bug on new files.
 *
 * A Monaco text model can never have zero lines: an empty document is a single
 * empty line. `DefaultLinesDiffComputer.computeDiff` short-circuits that case
 * and maps original line 1 (the empty line) onto every modified line, i.e. it
 * reports "delete line 1 + insert lines 1..N" instead of a pure insertion. No
 * diff option changes this, which is why new/deleted files must not be shown
 * in a DiffEditor at all (see `prepareDiffContent().kind`).
 *
 * The import reaches into monaco-editor's ESM internals; if a Monaco upgrade
 * moves the module, update the path here.
 */

// monaco-editor ships no type declarations for its ESM internals.
// @ts-expect-error TS7016
import { DefaultLinesDiffComputer } from "monaco-editor/editor/common/diff/defaultLinesDiffComputer/defaultLinesDiffComputer.js";
// @ts-expect-error TS7016
import { LegacyLinesDiffComputer } from "monaco-editor/editor/common/diff/legacyLinesDiffComputer.js";
import { describe, expect, it } from "vitest";

const OPTIONS = {
  ignoreTrimWhitespace: false,
  maxComputationTimeMs: 0,
  computeMoves: false,
  extendToSubwords: false,
};

describe("Monaco DefaultLinesDiffComputer with an empty original", () => {
  it("reports a deleted original line for a new single-line file", () => {
    const computer = new DefaultLinesDiffComputer();
    const result = computer.computeDiff([""], ["tmp"], OPTIONS);

    expect(result.changes).toHaveLength(1);
    const change = result.changes[0];
    // Original line 1 is considered deleted: this is the phantom "1 —" row.
    expect(change.original.startLineNumber).toBe(1);
    expect(change.original.endLineNumberExclusive).toBe(2);
    expect(change.modified.startLineNumber).toBe(1);
    expect(change.modified.endLineNumberExclusive).toBe(2);
  });

  it("still deletes the empty original line when trim-whitespace is ignored", () => {
    const computer = new DefaultLinesDiffComputer();
    const result = computer.computeDiff([""], ["tmp"], {
      ...OPTIONS,
      ignoreTrimWhitespace: true,
    });

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].original.endLineNumberExclusive).toBe(2);
  });

  it("is no better with the legacy algorithm (one line replaced by another)", () => {
    const computer = new LegacyLinesDiffComputer();
    const result = computer.computeDiff([""], ["tmp"], {
      ...OPTIONS,
      shouldComputeCharChanges: false,
      shouldPostProcessCharChanges: false,
      shouldIgnoreTrimWhitespace: false,
      shouldMakePrettyDiff: true,
    });

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].original.startLineNumber).toBe(1);
    expect(result.changes[0].original.endLineNumberExclusive).toBe(2);
  });

  it("reports a deleted original line for a multi-line new file too", () => {
    const computer = new DefaultLinesDiffComputer();
    const result = computer.computeDiff([""], ["a", "b", "c"], OPTIONS);

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].original.endLineNumberExclusive).toBe(2);
    expect(result.changes[0].modified.endLineNumberExclusive).toBe(4);
  });
});
