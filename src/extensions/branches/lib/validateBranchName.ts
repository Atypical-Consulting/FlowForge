/**
 * Client-side branch name validation, mirroring the rules of
 * `git check-ref-format --branch` so obviously invalid names are flagged as
 * the user types. The backend (`git2::Branch::name_is_valid`) remains the
 * authority: anything that passes here can still be rejected server-side.
 *
 * Returns a human-readable reason, or `null` when the name looks valid.
 */
export function validateBranchName(name: string): string | null {
  if (name.length === 0) {
    return "Branch name cannot be empty";
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control chars are exactly what git forbids
  if (/[\s\x00-\x1f\x7f]/.test(name)) {
    return "Branch name cannot contain spaces or control characters";
  }
  if (/[~^:?*[\\]/.test(name)) {
    return "Branch name cannot contain ~ ^ : ? * [ or \\";
  }
  if (name.includes("..")) {
    return "Branch name cannot contain '..'";
  }
  if (name.includes("@{")) {
    return "Branch name cannot contain '@{'";
  }
  if (name === "@") {
    return "'@' is not a valid branch name";
  }
  if (name.startsWith("-")) {
    return "Branch name cannot start with '-'";
  }
  if (name.startsWith("/") || name.endsWith("/") || name.includes("//")) {
    return "Branch name cannot start or end with '/' or contain '//'";
  }
  if (name.endsWith(".")) {
    return "Branch name cannot end with '.'";
  }
  if (
    name
      .split("/")
      .some((part) => part.startsWith(".") || part.endsWith(".lock"))
  ) {
    return "Branch name segments cannot start with '.' or end with '.lock'";
  }
  return null;
}
