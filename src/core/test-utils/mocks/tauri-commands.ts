import type {
  RepoStatus,
  StagingStatus,
  FileChange,
  BranchInfo,
  CommitSummary,
  FileDiff,
  CommitDetails,
  CommitInfo,
  TagInfo,
  StashEntry,
  RemoteInfo,
  CommitGraph,
  GitflowStatus,
  GitflowContext,
  GitflowInitResult,
  MergeResult,
  MergeStatus,
  WorktreeInfo,
  SyncResult,
  UndoInfo,
  TypeSuggestion,
  ScopeSuggestion,
  ChangelogOutput,
  RepoFileEntry,
  RepoFileContent,
  GitGlobalConfig,
  LastCommitMessage,
  ValidationResult,
  InitResult,
  BatchDeleteResult,
  RecentCheckout,
  Result,
  GitError,
  GitflowError,
  FileChanged,
} from "../../../bindings";

// Result helpers
export function ok<T>(data: T): Result<T, GitError> {
  return { status: "ok", data };
}

export function err(error: GitError): Result<never, GitError> {
  return { status: "error", error };
}

export function gitflowOk<T>(data: T): Result<T, GitflowError> {
  return { status: "ok", data };
}

export function gitflowErr(error: GitflowError): Result<never, GitflowError> {
  return { status: "error", error };
}

// Factory functions
export function createRepoStatus(
  overrides?: Partial<RepoStatus>,
): RepoStatus {
  return {
    branchName: "main",
    isDirty: false,
    repoPath: "/test/repo",
    repoName: "repo",
    ...overrides,
  };
}

export function createStagingStatus(
  overrides?: Partial<StagingStatus>,
): StagingStatus {
  return {
    staged: [],
    unstaged: [],
    untracked: [],
    ...overrides,
  };
}

export function createFileChange(
  overrides?: Partial<FileChange>,
): FileChange {
  return {
    path: "src/main.ts",
    status: "modified",
    additions: 10,
    deletions: 5,
    ...overrides,
  };
}

export function createBranchInfo(
  overrides?: Partial<BranchInfo>,
): BranchInfo {
  return {
    name: "main",
    isHead: true,
    lastCommitOid: "abc1234",
    lastCommitMessage: "Initial commit",
    isMerged: null,
    isRemote: false,
    remoteName: null,
    ...overrides,
  };
}

export function createCommitSummary(
  overrides?: Partial<CommitSummary>,
): CommitSummary {
  return {
    oid: "abc1234567890abcdef1234567890abcdef123456",
    shortOid: "abc1234",
    messageSubject: "feat: initial commit",
    authorName: "Test User",
    authorEmail: "test@example.com",
    timestampMs: Date.now(),
    ...overrides,
  };
}

export function createFileDiff(overrides?: Partial<FileDiff>): FileDiff {
  return {
    path: "src/main.ts",
    oldContent: "",
    newContent: "console.log('hello');",
    hunks: [],
    isBinary: false,
    language: "typescript",
    ...overrides,
  };
}

export function createCommitDetails(
  overrides?: Partial<CommitDetails>,
): CommitDetails {
  return {
    oid: "abc1234567890abcdef1234567890abcdef123456",
    shortOid: "abc1234",
    message: "feat: initial commit",
    authorName: "Test User",
    authorEmail: "test@example.com",
    authorTimestampMs: Date.now(),
    committerName: "Test User",
    committerEmail: "test@example.com",
    committerTimestampMs: Date.now(),
    parentOids: [],
    filesChanged: [],
    ...overrides,
  };
}

export function createCommitInfo(
  overrides?: Partial<CommitInfo>,
): CommitInfo {
  return {
    oid: "abc1234567890abcdef1234567890abcdef123456",
    shortOid: "abc1234",
    message: "feat: test commit",
    ...overrides,
  };
}

export function createTagInfo(overrides?: Partial<TagInfo>): TagInfo {
  return {
    name: "v1.0.0",
    oid: "abc1234567890abcdef1234567890abcdef123456",
    targetOid: "abc1234567890abcdef1234567890abcdef123456",
    message: "Release v1.0.0",
    tagger: "Test User",
    isAnnotated: true,
    createdAtMs: Date.now(),
    ...overrides,
  };
}

export function createStashEntry(
  overrides?: Partial<StashEntry>,
): StashEntry {
  return {
    index: 0,
    message: "WIP: work in progress",
    oid: "abc1234567890abcdef1234567890abcdef123456",
    ...overrides,
  };
}

export function createRemoteInfo(
  overrides?: Partial<RemoteInfo>,
): RemoteInfo {
  return {
    name: "origin",
    url: "https://github.com/test/repo.git",
    ...overrides,
  };
}

export function createCommitGraph(
  overrides?: Partial<CommitGraph>,
): CommitGraph {
  return {
    nodes: [],
    edges: [],
    ...overrides,
  };
}

export function createWorktreeInfo(
  overrides?: Partial<WorktreeInfo>,
): WorktreeInfo {
  return {
    name: "main",
    path: "/test/repo",
    branch: "main",
    status: "clean",
    isMain: true,
    isLocked: false,
    ...overrides,
  };
}

export function createFileChanged(
  overrides?: Partial<FileChanged>,
): FileChanged {
  return {
    path: "src/main.ts",
    status: "modified",
    additions: 10,
    deletions: 5,
    ...overrides,
  };
}

// Full mock commands object
export function createMockCommands() {
  return {
    openRepository: vi.fn().mockResolvedValue(ok(createRepoStatus())),
    getRepositoryStatus: vi.fn().mockResolvedValue(ok(createRepoStatus())),
    isGitRepository: vi.fn().mockResolvedValue(ok(true)),
    closeRepository: vi.fn().mockResolvedValue(ok(null)),
    getStagingStatus: vi
      .fn()
      .mockResolvedValue(ok(createStagingStatus())),
    stageFile: vi.fn().mockResolvedValue(ok(null)),
    unstageFile: vi.fn().mockResolvedValue(ok(null)),
    stageFiles: vi.fn().mockResolvedValue(ok(null)),
    unstageFiles: vi.fn().mockResolvedValue(ok(null)),
    stageAll: vi.fn().mockResolvedValue(ok(null)),
    unstageAll: vi.fn().mockResolvedValue(ok(null)),
    getFileDiff: vi.fn().mockResolvedValue(ok(createFileDiff())),
    getCommitFileDiff: vi.fn().mockResolvedValue(ok(createFileDiff())),
    getFileBase64: vi.fn().mockResolvedValue(ok("")),
    getCommitFileBase64: vi.fn().mockResolvedValue(ok("")),
    createCommit: vi.fn().mockResolvedValue(ok(createCommitInfo())),
    getLastCommitMessage: vi.fn().mockResolvedValue(
      ok({
        subject: "feat: test",
        body: null,
        fullMessage: "feat: test",
      } satisfies LastCommitMessage),
    ),
    getCommitHistory: vi.fn().mockResolvedValue(ok([])),
    getCommitDetails: vi
      .fn()
      .mockResolvedValue(ok(createCommitDetails())),
    searchCommits: vi.fn().mockResolvedValue(ok([])),
    getCommitGraph: vi
      .fn()
      .mockResolvedValue(ok(createCommitGraph())),
    getRemotes: vi.fn().mockResolvedValue(ok([])),
    fetchFromRemote: vi.fn().mockResolvedValue(
      ok({
        success: true,
        message: "Fetched",
        commitsTransferred: 0,
      } satisfies SyncResult),
    ),
    pushToRemote: vi.fn().mockResolvedValue(
      ok({
        success: true,
        message: "Pushed",
        commitsTransferred: 0,
      } satisfies SyncResult),
    ),
    pullFromRemote: vi.fn().mockResolvedValue(
      ok({
        success: true,
        message: "Pulled",
        commitsTransferred: 0,
      } satisfies SyncResult),
    ),
    listBranches: vi.fn().mockResolvedValue(ok([])),
    createBranch: vi.fn().mockResolvedValue(ok(createBranchInfo())),
    checkoutBranch: vi.fn().mockResolvedValue(ok(null)),
    deleteBranch: vi.fn().mockResolvedValue(ok(null)),
    listAllBranches: vi.fn().mockResolvedValue(ok([])),
    checkoutRemoteBranch: vi.fn().mockResolvedValue(ok(null)),
    batchDeleteBranches: vi.fn().mockResolvedValue(
      ok({
        results: [],
        totalDeleted: 0,
        totalFailed: 0,
      } satisfies BatchDeleteResult),
    ),
    getRecentCheckouts: vi.fn().mockResolvedValue(ok([])),
    listStashes: vi.fn().mockResolvedValue(ok([])),
    stashSave: vi.fn().mockResolvedValue(ok("stash@{0}")),
    stashApply: vi.fn().mockResolvedValue(ok(null)),
    stashPop: vi.fn().mockResolvedValue(ok(null)),
    stashDrop: vi.fn().mockResolvedValue(ok(null)),
    listTags: vi.fn().mockResolvedValue(ok([])),
    createTag: vi.fn().mockResolvedValue(ok(createTagInfo())),
    deleteTag: vi.fn().mockResolvedValue(ok(null)),
    mergeBranch: vi.fn().mockResolvedValue(
      ok({
        success: true,
        analysis: "fastForward",
        commitOid: null,
        fastForwarded: true,
        hasConflicts: false,
        conflictedFiles: [],
      } satisfies MergeResult),
    ),
    getMergeStatus: vi.fn().mockResolvedValue(
      ok({
        inProgress: false,
        conflictedFiles: [],
      } satisfies MergeStatus),
    ),
    abortMerge: vi.fn().mockResolvedValue(ok(null)),
    initGitflow: vi.fn().mockResolvedValue(
      gitflowOk({
        developCreated: true,
        switchedToDevelop: true,
      } satisfies GitflowInitResult),
    ),
    startFeature: vi
      .fn()
      .mockResolvedValue(gitflowOk("feature/test")),
    finishFeature: vi.fn().mockResolvedValue(gitflowOk(null)),
    startRelease: vi
      .fn()
      .mockResolvedValue(gitflowOk("release/1.0.0")),
    finishRelease: vi.fn().mockResolvedValue(gitflowOk("v1.0.0")),
    startHotfix: vi
      .fn()
      .mockResolvedValue(gitflowOk("hotfix/fix-bug")),
    finishHotfix: vi.fn().mockResolvedValue(gitflowOk("v1.0.1")),
    getGitflowStatus: vi.fn().mockResolvedValue(
      gitflowOk({
        currentBranch: "main",
        isGitflowReady: false,
        canStartFeature: false,
        canFinishFeature: false,
        canStartRelease: false,
        canFinishRelease: false,
        canStartHotfix: false,
        canFinishHotfix: false,
        canAbort: false,
        activeFlow: null,
        context: {
          state: { type: "Idle" },
          currentBranch: "main",
          hasMain: true,
          hasDevelop: false,
          isInitialized: false,
        } satisfies GitflowContext,
      } satisfies GitflowStatus),
    ),
    abortGitflow: vi.fn().mockResolvedValue(gitflowOk(null)),
    validateConventionalCommit: vi.fn().mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
    } satisfies ValidationResult),
    suggestCommitType: vi.fn().mockResolvedValue(
      ok({
        suggestedType: "feat",
        confidence: "medium",
        reason: "New files detected",
      } satisfies TypeSuggestion),
    ),
    getScopeSuggestions: vi.fn().mockResolvedValue(ok([])),
    inferScopeFromStaged: vi.fn().mockResolvedValue(ok(null)),
    generateChangelogCmd: vi.fn().mockResolvedValue(
      ok({
        markdown: "",
        commitCount: 0,
        groups: [],
      } satisfies ChangelogOutput),
    ),
    listWorktrees: vi.fn().mockResolvedValue(ok([])),
    createWorktree: vi
      .fn()
      .mockResolvedValue(ok(createWorktreeInfo())),
    deleteWorktree: vi.fn().mockResolvedValue(ok(null)),
    getUndoInfo: vi.fn().mockResolvedValue(
      ok({
        canUndo: false,
        description: null,
        reflogMessage: null,
        targetOid: null,
      } satisfies UndoInfo),
    ),
    undoLastOperation: vi.fn().mockResolvedValue(ok(null)),
    cloneRepository: vi.fn().mockResolvedValue(ok("/test/cloned")),
    gitInit: vi.fn().mockResolvedValue(
      ok({
        repoPath: "/test/new-repo",
        initialBranch: "main",
      } satisfies InitResult),
    ),
    listRepoFiles: vi.fn().mockResolvedValue(ok([])),
    readRepoFile: vi.fn().mockResolvedValue(
      ok({
        content: "",
        isBinary: false,
        size: 0,
      } satisfies RepoFileContent),
    ),
    getGitGlobalConfig: vi.fn().mockResolvedValue(
      ok({
        userName: "Test User",
        userEmail: "test@example.com",
        defaultBranch: "main",
      } satisfies GitGlobalConfig),
    ),
    setGitGlobalConfig: vi.fn().mockResolvedValue(ok(null)),
  };
}
