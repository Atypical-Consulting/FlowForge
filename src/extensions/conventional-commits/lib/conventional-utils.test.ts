import { describe, expect, it } from "vitest";
import {
  buildCommitMessage,
  type ConventionalMessageParts,
  parseConventionalMessage,
} from "./conventional-utils";

describe("buildCommitMessage", () => {
  it("returns empty string when commitType is empty", () => {
    expect(
      buildCommitMessage({
        commitType: "",
        scope: "",
        description: "add feature",
        body: "",
        isBreaking: false,
        breakingDescription: "",
      }),
    ).toBe("");
  });

  it("returns empty string when description is empty", () => {
    expect(
      buildCommitMessage({
        commitType: "feat",
        scope: "",
        description: "",
        body: "",
        isBreaking: false,
        breakingDescription: "",
      }),
    ).toBe("");
  });

  it("builds type: description", () => {
    expect(
      buildCommitMessage({
        commitType: "feat",
        scope: "",
        description: "add login flow",
        body: "",
        isBreaking: false,
        breakingDescription: "",
      }),
    ).toBe("feat: add login flow");
  });

  it("builds type(scope): description", () => {
    expect(
      buildCommitMessage({
        commitType: "fix",
        scope: "auth",
        description: "resolve token refresh",
        body: "",
        isBreaking: false,
        breakingDescription: "",
      }),
    ).toBe("fix(auth): resolve token refresh");
  });

  it("builds with body", () => {
    expect(
      buildCommitMessage({
        commitType: "docs",
        scope: "",
        description: "update README",
        body: "Added installation section",
        isBreaking: false,
        breakingDescription: "",
      }),
    ).toBe("docs: update README\n\nAdded installation section");
  });

  it("builds with breaking change indicator", () => {
    expect(
      buildCommitMessage({
        commitType: "feat",
        scope: "api",
        description: "change response format",
        body: "",
        isBreaking: true,
        breakingDescription: "",
      }),
    ).toBe("feat(api)!: change response format");
  });

  it("builds with breaking change description", () => {
    expect(
      buildCommitMessage({
        commitType: "feat",
        scope: "api",
        description: "change response format",
        body: "",
        isBreaking: true,
        breakingDescription: "Response is now JSON instead of XML",
      }),
    ).toBe(
      "feat(api)!: change response format\n\nBREAKING CHANGE: Response is now JSON instead of XML",
    );
  });

  it("builds with body and breaking change", () => {
    expect(
      buildCommitMessage({
        commitType: "feat",
        scope: "",
        description: "new auth system",
        body: "Migrated to OAuth 2.0",
        isBreaking: true,
        breakingDescription: "Old API keys no longer work",
      }),
    ).toBe(
      "feat!: new auth system\n\nMigrated to OAuth 2.0\n\nBREAKING CHANGE: Old API keys no longer work",
    );
  });
});

describe("parseConventionalMessage", () => {
  it("returns null for empty string", () => {
    expect(parseConventionalMessage("")).toBeNull();
  });

  it("returns null for non-CC messages", () => {
    expect(parseConventionalMessage("Update README")).toBeNull();
    expect(parseConventionalMessage("WIP: stuff")).toBeNull();
    expect(parseConventionalMessage("Merge branch 'main'")).toBeNull();
  });

  it("parses all 11 commit types", () => {
    const types = [
      "feat",
      "fix",
      "docs",
      "style",
      "refactor",
      "perf",
      "test",
      "chore",
      "ci",
      "build",
      "revert",
    ];
    for (const type of types) {
      const result = parseConventionalMessage(`${type}: some change`);
      expect(result).not.toBeNull();
      expect(result?.commitType).toBe(type);
      expect(result?.description).toBe("some change");
    }
  });

  it("parses type with scope", () => {
    const result = parseConventionalMessage("feat(auth): add login flow");
    expect(result).not.toBeNull();
    expect(result?.commitType).toBe("feat");
    expect(result?.scope).toBe("auth");
    expect(result?.description).toBe("add login flow");
  });

  it("parses type without scope", () => {
    const result = parseConventionalMessage("fix: resolve crash");
    expect(result).not.toBeNull();
    expect(result?.scope).toBe("");
  });

  it("parses breaking change with !", () => {
    const result = parseConventionalMessage("feat(api)!: change response");
    expect(result).not.toBeNull();
    expect(result?.isBreaking).toBe(true);
  });

  it("parses body", () => {
    const result = parseConventionalMessage(
      "docs: update README\n\nAdded installation section",
    );
    expect(result).not.toBeNull();
    expect(result?.body).toBe("Added installation section");
  });

  it("parses BREAKING CHANGE footer", () => {
    const result = parseConventionalMessage(
      "feat: new auth\n\nBREAKING CHANGE: Old tokens expired",
    );
    expect(result).not.toBeNull();
    expect(result?.isBreaking).toBe(true);
    expect(result?.breakingDescription).toBe("Old tokens expired");
  });

  it("parses BREAKING-CHANGE footer (hyphenated)", () => {
    const result = parseConventionalMessage(
      "feat: new auth\n\nBREAKING-CHANGE: Old tokens expired",
    );
    expect(result).not.toBeNull();
    expect(result?.isBreaking).toBe(true);
    expect(result?.breakingDescription).toBe("Old tokens expired");
  });

  it("parses body and breaking change together", () => {
    const result = parseConventionalMessage(
      "feat!: new system\n\nMigrated to v2\n\nBREAKING CHANGE: Old API removed",
    );
    expect(result).not.toBeNull();
    expect(result?.body).toBe("Migrated to v2");
    expect(result?.isBreaking).toBe(true);
    expect(result?.breakingDescription).toBe("Old API removed");
  });

  it("handles ! and BREAKING CHANGE footer together", () => {
    const result = parseConventionalMessage(
      "feat(api)!: change format\n\nBREAKING CHANGE: JSON only now",
    );
    expect(result).not.toBeNull();
    expect(result?.isBreaking).toBe(true);
    expect(result?.breakingDescription).toBe("JSON only now");
  });
});

describe("round-trip", () => {
  it("parse(build(parts)) returns equivalent parts", () => {
    const original: ConventionalMessageParts = {
      commitType: "feat",
      scope: "auth",
      description: "add login",
      body: "Added OAuth flow",
      isBreaking: false,
      breakingDescription: "",
    };

    const message = buildCommitMessage(original);
    const parsed = parseConventionalMessage(message);

    expect(parsed).not.toBeNull();
    expect(parsed?.commitType).toBe(original.commitType);
    expect(parsed?.scope).toBe(original.scope);
    expect(parsed?.description).toBe(original.description);
    expect(parsed?.body).toBe(original.body);
    expect(parsed?.isBreaking).toBe(original.isBreaking);
  });

  it("round-trips with breaking change", () => {
    const original: ConventionalMessageParts = {
      commitType: "feat",
      scope: "api",
      description: "change format",
      body: "",
      isBreaking: true,
      breakingDescription: "Response is now JSON",
    };

    const message = buildCommitMessage(original);
    const parsed = parseConventionalMessage(message);

    expect(parsed).not.toBeNull();
    expect(parsed?.isBreaking).toBe(true);
    expect(parsed?.breakingDescription).toBe(original.breakingDescription);
  });

  it("round-trips with body and breaking change", () => {
    const original: ConventionalMessageParts = {
      commitType: "refactor",
      scope: "",
      description: "restructure modules",
      body: "Moved to feature-based structure",
      isBreaking: true,
      breakingDescription: "Import paths changed",
    };

    const message = buildCommitMessage(original);
    const parsed = parseConventionalMessage(message);

    expect(parsed).not.toBeNull();
    expect(parsed?.commitType).toBe(original.commitType);
    expect(parsed?.scope).toBe(original.scope);
    expect(parsed?.description).toBe(original.description);
    expect(parsed?.body).toBe(original.body);
    expect(parsed?.isBreaking).toBe(true);
    expect(parsed?.breakingDescription).toBe(original.breakingDescription);
  });
});
