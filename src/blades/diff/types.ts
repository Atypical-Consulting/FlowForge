/**
 * Blade input: diff source configuration.
 * Public type -- imported by bladeTypes.ts and previewRegistry.ts.
 */
export type DiffSource =
  | { mode: "staging"; filePath: string; staged: boolean }
  | { mode: "commit"; oid: string; filePath: string };
