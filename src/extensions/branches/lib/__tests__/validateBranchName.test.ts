import { describe, expect, it } from "vitest";
import { validateBranchName } from "../validateBranchName";

describe("validateBranchName", () => {
  it.each([
    "main",
    "feature/my-feature",
    "release/1.2.3",
    "fix-123",
    "user@host",
    "a.b/c.d",
    "feature/UPPER_case",
  ])("accepts '%s'", (name) => {
    expect(validateBranchName(name)).toBeNull();
  });

  it.each([
    ["", "Branch name cannot be empty"],
    [
      "bad name..with spaces",
      "Branch name cannot contain spaces or control characters",
    ],
    ["tab\tname", "Branch name cannot contain spaces or control characters"],
    ["a~b", "Branch name cannot contain ~ ^ : ? * [ or \\"],
    ["a^b", "Branch name cannot contain ~ ^ : ? * [ or \\"],
    ["a:b", "Branch name cannot contain ~ ^ : ? * [ or \\"],
    ["a?b", "Branch name cannot contain ~ ^ : ? * [ or \\"],
    ["a*b", "Branch name cannot contain ~ ^ : ? * [ or \\"],
    ["a[b", "Branch name cannot contain ~ ^ : ? * [ or \\"],
    ["a\\b", "Branch name cannot contain ~ ^ : ? * [ or \\"],
    ["a..b", "Branch name cannot contain '..'"],
    ["a@{b", "Branch name cannot contain '@{'"],
    ["@", "'@' is not a valid branch name"],
    ["-dash", "Branch name cannot start with '-'"],
    ["/leading", "Branch name cannot start or end with '/' or contain '//'"],
    ["trailing/", "Branch name cannot start or end with '/' or contain '//'"],
    ["a//b", "Branch name cannot start or end with '/' or contain '//'"],
    ["ends.", "Branch name cannot end with '.'"],
    [
      ".hidden",
      "Branch name segments cannot start with '.' or end with '.lock'",
    ],
    [
      "feature/.hidden",
      "Branch name segments cannot start with '.' or end with '.lock'",
    ],
    [
      "a.lock",
      "Branch name segments cannot start with '.' or end with '.lock'",
    ],
    [
      "a.lock/b",
      "Branch name segments cannot start with '.' or end with '.lock'",
    ],
  ])("rejects '%s'", (name, reason) => {
    expect(validateBranchName(name)).toBe(reason);
  });
});
