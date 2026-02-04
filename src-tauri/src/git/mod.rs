pub mod branch;
pub mod changelog;
pub mod commands;
pub mod commit;
pub mod conventional;
pub mod diff;
pub mod error;
pub mod graph;
pub mod history;
pub mod merge;
pub mod remote;
pub mod repository;
pub mod staging;
pub mod stash;
pub mod tag;

pub use branch::BranchInfo;
pub use changelog::{
    ChangelogCommit, ChangelogError, ChangelogOptions, ChangelogOutput, CommitGroup,
};
pub use commit::CommitInfo;
pub use conventional::{
    extract_scopes_from_history, infer_commit_type, infer_scope_from_files,
    parse_conventional_commit, validate_commit_message, CommitType, Confidence, Footer,
    ParsedCommit, ScopeSuggestion, TypeSuggestion, ValidationError, ValidationResult,
    ValidationWarning, VALID_TYPES,
};
pub use diff::{DiffHunk, FileDiff};
pub use error::GitError;
pub use graph::{get_commit_graph, BranchType, CommitGraph, GraphEdge, GraphNode};
pub use history::{CommitDetails, CommitSummary, FileChanged};
pub use merge::{MergeAnalysisResult, MergeResult, MergeStatus};
pub use remote::{RemoteInfo, SyncProgress, SyncResult};
pub use repository::{RepoStatus, RepositoryState};
pub use staging::{FileChange, FileStatus, StagingStatus};
pub use stash::StashEntry;
pub use tag::TagInfo;
