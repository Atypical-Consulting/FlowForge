use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Information about a created commit.
///
/// Returned after successful commit creation to confirm
/// the commit was made and provide its identifiers.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    /// Full commit OID (40 hex characters)
    pub oid: String,
    /// Short commit OID (7 characters)
    pub short_oid: String,
    /// Commit message
    pub message: String,
}

/// Last commit message with subject and body parsed separately.
///
/// Used for amend commit pre-fill functionality.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LastCommitMessage {
    /// First line of the commit message
    pub subject: String,
    /// Everything after the first blank line (if exists)
    pub body: Option<String>,
    /// Full commit message
    pub full_message: String,
}

/// Get the last commit message for amend pre-fill.
///
/// Returns the HEAD commit's message parsed into subject and body components.
#[tauri::command]
#[specta::specta]
pub async fn get_last_commit_message(
    state: State<'_, RepositoryState>,
) -> Result<LastCommitMessage, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Get HEAD commit
        let head = repo
            .head()
            .map_err(|_| GitError::EmptyRepository)?;
        let commit = head
            .peel_to_commit()
            .map_err(|_| GitError::EmptyRepository)?;

        let full_message = commit.message().unwrap_or("").to_string();

        // Parse message into subject and body
        let (subject, body) = parse_commit_message(&full_message);

        Ok(LastCommitMessage {
            subject,
            body,
            full_message,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Parse a commit message into subject and body.
///
/// Subject is the first line (before first newline).
/// Body is everything after the first blank line, trimmed.
fn parse_commit_message(message: &str) -> (String, Option<String>) {
    let lines: Vec<&str> = message.lines().collect();

    if lines.is_empty() {
        return (String::new(), None);
    }

    let subject = lines[0].to_string();

    // Find the body (after first blank line)
    let mut body_start = None;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if line.trim().is_empty() {
            // Found blank line, body starts after this
            if i + 1 < lines.len() {
                body_start = Some(i + 1);
            }
            break;
        }
    }

    let body = body_start.map(|start| {
        lines[start..]
            .join("\n")
            .trim()
            .to_string()
    }).filter(|b| !b.is_empty());

    (subject, body)
}

/// Create a new commit from staged changes.
///
/// Creates a commit with the given message from the current index (staged changes).
/// If `amend` is true, replaces the last commit instead of creating a new one.
///
/// When a merge is in progress (`.git/MERGE_HEAD` exists) the commit records
/// HEAD *and* every MERGE_HEAD as parents, i.e. it completes the merge exactly
/// like `git commit` would, and the merge state files are removed afterwards.
///
/// # Errors
/// - `NoStagedChanges` if index is empty (nothing staged)
/// - `UnresolvedConflicts` if the index still has conflict entries
/// - `AmendDuringMerge` if `amend` is requested while a merge is in progress
/// - `SignatureError` if git config lacks user.name/email
/// - Various git2 errors for other failures
#[tauri::command]
#[specta::specta]
pub async fn create_commit(
    message: String,
    amend: bool,
    state: State<'_, RepositoryState>,
) -> Result<CommitInfo, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        create_commit_in_repo(&repo, &message, amend)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Which in-progress operation (if any) the next commit will complete.
#[derive(Debug, Clone, PartialEq, Eq)]
enum PendingOperation {
    None,
    /// A merge: the commit gets HEAD plus these MERGE_HEAD oids as parents.
    Merge(Vec<git2::Oid>),
    /// A single cherry-pick or revert: single parent, but the state files
    /// (CHERRY_PICK_HEAD / REVERT_HEAD) must be removed once committed.
    SingleParent,
}

fn pending_operation(repo: &git2::Repository) -> Result<PendingOperation, GitError> {
    Ok(match repo.state() {
        git2::RepositoryState::Merge => {
            PendingOperation::Merge(crate::git::repository::merge_head_oids(repo)?)
        }
        git2::RepositoryState::CherryPick | git2::RepositoryState::Revert => {
            PendingOperation::SingleParent
        }
        // TODO: CherryPickSequence / RevertSequence (multi-commit sequencer runs)
        // and rebases keep a sequencer directory that `cleanup_state` would
        // discard along with the remaining steps, so they are committed as
        // plain commits and the sequence is continued with git itself.
        _ => PendingOperation::None,
    })
}

/// Paths that still have conflict entries in the index.
fn conflicted_paths(index: &git2::Index) -> Result<Vec<String>, GitError> {
    let mut paths = Vec::new();
    for conflict in index.conflicts()?.flatten() {
        let entry = conflict.our.or(conflict.their).or(conflict.ancestor);
        if let Some(entry) = entry {
            paths.push(String::from_utf8_lossy(&entry.path).to_string());
        }
    }
    paths.sort();
    paths.dedup();
    Ok(paths)
}

/// Synchronous core of [`create_commit`], operating on an open repository.
pub(crate) fn create_commit_in_repo(
    repo: &git2::Repository,
    message: &str,
    amend: bool,
) -> Result<CommitInfo, GitError> {
    let pending = pending_operation(repo)?;

    if amend && matches!(pending, PendingOperation::Merge(_)) {
        return Err(GitError::AmendDuringMerge);
    }

    // Get signature from git config
    let sig = repo.signature().map_err(|e| {
        GitError::SignatureError(format!(
            "Could not determine commit author. Please configure git: {}",
            e.message()
        ))
    })?;

    // Get the index and write tree. A conflicted index cannot be written as a
    // tree; refuse with the list of files that still need resolving.
    let mut index = repo.index()?;
    if index.has_conflicts() {
        return Err(GitError::UnresolvedConflicts(
            conflicted_paths(&index)?.join(", "),
        ));
    }
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;

    // Check if there are staged changes by comparing tree to HEAD. A merge
    // commit is meaningful even when its tree equals HEAD's (e.g. every
    // conflict was resolved by keeping "ours"), so skip the check then.
    let has_staged_changes = if matches!(pending, PendingOperation::Merge(_)) {
        true
    } else if amend {
        // For amend, compare new tree to parent's tree (if exists)
        match repo.head() {
            Ok(head) => {
                let head_commit = head.peel_to_commit()?;
                if head_commit.parent_count() > 0 {
                    let parent = head_commit.parent(0)?;
                    tree_oid != parent.tree_id()
                } else {
                    // First commit being amended - always allow
                    true
                }
            }
            Err(_) => true, // No HEAD, allow commit
        }
    } else {
        // For normal commit, compare tree to HEAD tree
        match repo.head() {
            Ok(head) => {
                let head_commit = head.peel_to_commit()?;
                tree_oid != head_commit.tree_id()
            }
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                // First commit - check if tree has any entries
                !tree.is_empty()
            }
            Err(e) => return Err(e.into()),
        }
    };

    if !has_staged_changes {
        return Err(GitError::NoStagedChanges);
    }

    let oid = if amend {
        // Amend: reuse parent's parents
        let head = repo.head()?.peel_to_commit()?;
        let parents: Vec<git2::Commit> = head.parents().collect();
        let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

        repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parent_refs)?
    } else {
        // Normal commit: HEAD is the first parent (if it exists), followed by
        // every MERGE_HEAD when completing a merge.
        match repo.head() {
            Ok(head) => {
                let mut parents = vec![head.peel_to_commit()?];
                if let PendingOperation::Merge(merge_heads) = &pending {
                    for merge_oid in merge_heads {
                        parents.push(repo.find_commit(*merge_oid)?);
                    }
                }
                let parent_refs: Vec<&git2::Commit> = parents.iter().collect();
                repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parent_refs)?
            }
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                // First commit - no parent
                repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[])?
            }
            Err(e) => return Err(e.into()),
        }
    };

    // The operation is now recorded in the commit: drop MERGE_HEAD / MERGE_MSG /
    // CHERRY_PICK_HEAD / REVERT_HEAD so git no longer reports it in progress.
    if pending != PendingOperation::None {
        repo.cleanup_state()?;
    }

    Ok(CommitInfo {
        oid: oid.to_string(),
        short_oid: format!("{:.7}", oid),
        message: message.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gitflow::test_support::{
        checkout, commit_file, create_and_checkout, init_repo, stage_file, write_file,
    };

    /// Start merging `topic` into `main` where both sides edited `shared.txt`.
    /// Returns the tip of `topic`; the repo is left in the Merge state with a
    /// conflicted index, exactly as after `git merge topic` reports conflicts.
    fn start_conflicting_merge(repo: &git2::Repository) -> git2::Oid {
        commit_file(repo, "shared.txt", "base\n", "base");
        create_and_checkout(repo, "topic");
        let topic_oid = commit_file(repo, "shared.txt", "topic\n", "topic edit");
        checkout(repo, "main");
        commit_file(repo, "shared.txt", "main\n", "main edit");
        let annotated = repo.find_annotated_commit(topic_oid).unwrap();
        repo.merge(&[&annotated], None, None).unwrap();
        assert_eq!(repo.state(), git2::RepositoryState::Merge);
        assert!(repo.index().unwrap().has_conflicts());
        topic_oid
    }

    fn head_oid(repo: &git2::Repository) -> git2::Oid {
        repo.head().unwrap().peel_to_commit().unwrap().id()
    }

    fn find_commit<'r>(repo: &'r git2::Repository, info: &CommitInfo) -> git2::Commit<'r> {
        repo.find_commit(git2::Oid::from_str(&info.oid).unwrap())
            .unwrap()
    }

    #[test]
    fn commit_during_merge_creates_two_parent_commit_and_clears_merge_state() {
        let (_dir, repo) = init_repo();
        let topic_oid = start_conflicting_merge(&repo);
        let pre_merge_head = head_oid(&repo);

        // Resolve the conflict the way the conflict resolver does: write + stage.
        write_file(&repo, "shared.txt", "resolved\n");
        stage_file(&repo, "shared.txt");
        assert!(!repo.index().unwrap().has_conflicts());

        let info = create_commit_in_repo(&repo, "Merge branch 'topic'", false).unwrap();

        let commit = find_commit(&repo, &info);
        let parents: Vec<git2::Oid> = commit.parent_ids().collect();
        assert_eq!(
            parents,
            vec![pre_merge_head, topic_oid],
            "expected a real merge commit"
        );
        assert_eq!(head_oid(&repo), commit.id());

        assert_eq!(repo.state(), git2::RepositoryState::Clean);
        assert!(!repo.path().join("MERGE_HEAD").exists());
        assert!(!repo.path().join("MERGE_MSG").exists());
        assert!(
            repo.graph_descendant_of(commit.id(), topic_oid).unwrap(),
            "main should now contain topic"
        );
    }

    #[test]
    fn commit_during_merge_with_unresolved_conflicts_is_refused() {
        let (_dir, repo) = init_repo();
        let topic_oid = start_conflicting_merge(&repo);
        let head_before = head_oid(&repo);

        let err = create_commit_in_repo(&repo, "Merge branch 'topic'", false).unwrap_err();

        assert!(
            matches!(err, GitError::UnresolvedConflicts(ref files) if files == "shared.txt"),
            "got {err:?}"
        );
        // Nothing was committed and the merge is still in progress.
        assert_eq!(head_oid(&repo), head_before);
        assert_eq!(repo.state(), git2::RepositoryState::Merge);
        assert!(repo.path().join("MERGE_HEAD").exists());
        assert_eq!(
            crate::git::repository::merge_head_oids(&repo).unwrap(),
            vec![topic_oid]
        );
    }

    #[test]
    fn amend_during_merge_is_refused() {
        let (_dir, repo) = init_repo();
        start_conflicting_merge(&repo);
        write_file(&repo, "shared.txt", "resolved\n");
        stage_file(&repo, "shared.txt");
        let head_before = head_oid(&repo);

        let err = create_commit_in_repo(&repo, "oops", true).unwrap_err();

        assert!(matches!(err, GitError::AmendDuringMerge), "got {err:?}");
        assert_eq!(head_oid(&repo), head_before);
        assert_eq!(repo.state(), git2::RepositoryState::Merge);
    }

    #[test]
    fn merge_commit_is_allowed_even_when_tree_matches_head() {
        // Resolving every conflict by keeping "ours" leaves the tree identical to
        // HEAD's; git still creates the merge commit, and so must we.
        let (_dir, repo) = init_repo();
        let topic_oid = start_conflicting_merge(&repo);
        write_file(&repo, "shared.txt", "main\n");
        stage_file(&repo, "shared.txt");

        let info = create_commit_in_repo(&repo, "Merge branch 'topic'", false).unwrap();

        let commit = find_commit(&repo, &info);
        assert_eq!(commit.parent_count(), 2);
        assert_eq!(commit.parent_id(1).unwrap(), topic_oid);
        assert_eq!(repo.state(), git2::RepositoryState::Clean);
    }

    #[test]
    fn plain_commit_still_has_a_single_parent() {
        let (_dir, repo) = init_repo();
        let head_before = head_oid(&repo);
        write_file(&repo, "a.txt", "hello\n");
        stage_file(&repo, "a.txt");

        let info = create_commit_in_repo(&repo, "add a", false).unwrap();

        let commit = find_commit(&repo, &info);
        assert_eq!(commit.parent_ids().collect::<Vec<_>>(), vec![head_before]);
        assert_eq!(repo.state(), git2::RepositoryState::Clean);
    }

    #[test]
    fn plain_commit_with_nothing_staged_is_refused() {
        let (_dir, repo) = init_repo();
        let err = create_commit_in_repo(&repo, "empty", false).unwrap_err();
        assert!(matches!(err, GitError::NoStagedChanges), "got {err:?}");
    }

    #[test]
    fn commit_during_cherry_pick_clears_cherry_pick_state() {
        let (_dir, repo) = init_repo();
        create_and_checkout(&repo, "topic");
        let picked = commit_file(&repo, "picked.txt", "picked\n", "picked commit");
        checkout(&repo, "main");
        let head_before = head_oid(&repo);
        let picked_commit = repo.find_commit(picked).unwrap();
        repo.cherrypick(&picked_commit, None).unwrap();
        assert_eq!(repo.state(), git2::RepositoryState::CherryPick);

        let info = create_commit_in_repo(&repo, "picked commit", false).unwrap();

        let commit = find_commit(&repo, &info);
        assert_eq!(commit.parent_ids().collect::<Vec<_>>(), vec![head_before]);
        assert_eq!(repo.state(), git2::RepositoryState::Clean);
        assert!(!repo.path().join("CHERRY_PICK_HEAD").exists());
    }
}
