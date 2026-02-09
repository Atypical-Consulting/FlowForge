// @deprecated - Import from "./domain/git-ops" directly.
// This shim exists for backward compatibility during Phase 30 migration.
import { useGitOpsStore } from "./domain/git-ops";

export const useUndoStore = useGitOpsStore;
