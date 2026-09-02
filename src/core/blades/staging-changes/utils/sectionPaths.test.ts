import { describe, expect, it } from "vitest";
import { createFileChange } from "../../../test-utils/mocks/tauri-commands";
import { getSectionPaths } from "./sectionPaths";

describe("getSectionPaths", () => {
  it("returns the path of each file", () => {
    const paths = getSectionPaths([
      createFileChange({ path: "src/a.ts" }),
      createFileChange({ path: "src/b.ts", status: "deleted" }),
      createFileChange({ path: "src/c.ts", status: "untracked" }),
    ]);
    expect(paths).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
  });

  it("includes the old path of renamed files", () => {
    const paths = getSectionPaths([
      createFileChange({
        path: "src/new.ts",
        status: { renamed: { old_path: "src/old.ts" } },
      }),
    ]);
    expect(paths).toEqual(["src/new.ts", "src/old.ts"]);
  });

  it("deduplicates paths", () => {
    const paths = getSectionPaths([
      createFileChange({ path: "src/a.ts" }),
      createFileChange({ path: "src/a.ts", status: "deleted" }),
    ]);
    expect(paths).toEqual(["src/a.ts"]);
  });

  it("returns an empty list for no files", () => {
    expect(getSectionPaths([])).toEqual([]);
  });
});
