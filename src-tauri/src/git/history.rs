use serde::{Deserialize, Serialize};
use specta::Type;
use specta_typescript::Number;
use std::cell::RefCell;
use std::collections::HashMap;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Summary of a commit for list display.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitSummary {
    pub oid: String,
    pub short_oid: String,
    pub message_subject: String,
    pub author_name: String,
    pub author_email: String,
    /// Unix timestamp in milliseconds (safe for JS Number up to year 275760)
    #[specta(type = Number)]
    pub timestamp_ms: f64,
}

/// A file changed in a commit.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileChanged {
    pub path: String,
    pub status: String,
    pub additions: i32,
    pub deletions: i32,
}

/// Full details of a commit.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetails {
    pub oid: String,
    pub short_oid: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    /// Unix timestamp in milliseconds (safe for JS Number)
    #[specta(type = Number)]
    pub author_timestamp_ms: f64,
    pub committer_name: String,
    pub committer_email: String,
    /// Unix timestamp in milliseconds (safe for JS Number)
    #[specta(type = Number)]
    pub committer_timestamp_ms: f64,
    pub parent_oids: Vec<String>,
    pub files_changed: Vec<FileChanged>,
}

/// Open a revwalk over HEAD's ancestry in `git log --topo-order` order:
/// every commit is yielded before any of its parents, and where the topology
/// leaves a choice, newer commits come first.
///
/// `Sort::TIME` alone is not enough: libgit2 orders ties (commits sharing a
/// timestamp, which is common with scripted, squashed or imported histories)
/// in an unspecified order, so branches get interleaved and parents can show
/// up before their children.
///
/// Returns `None` for an unborn HEAD (empty repository).
fn log_revwalk(repo: &git2::Repository) -> Result<Option<git2::Revwalk<'_>>, GitError> {
    match repo.head() {
        Err(e) if e.code() == git2::ErrorCode::UnbornBranch => return Ok(None),
        Err(e) => return Err(e.into()),
        Ok(_) => {}
    }

    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    revwalk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)?;
    Ok(Some(revwalk))
}

fn commit_summary(repo: &git2::Repository, oid: git2::Oid) -> Option<CommitSummary> {
    let commit = repo.find_commit(oid).ok()?;
    let author = commit.author();

    Some(CommitSummary {
        oid: oid.to_string(),
        short_oid: format!("{:.7}", oid),
        message_subject: commit.summary().ok().flatten().unwrap_or("").to_string(),
        author_name: author.name().unwrap_or("Unknown").to_string(),
        author_email: author.email().unwrap_or("").to_string(),
        timestamp_ms: (author.when().seconds() as f64) * 1000.0,
    })
}

/// List `limit` commits reachable from HEAD after skipping `skip`, in
/// `git log` order (see [`log_revwalk`]).
///
/// Because the walk is deterministic, consecutive pages (`skip = 0`,
/// `skip = limit`, ...) concatenate into the full ordered history.
pub(crate) fn list_commit_history(
    repo: &git2::Repository,
    skip: usize,
    limit: usize,
) -> Result<Vec<CommitSummary>, GitError> {
    let Some(revwalk) = log_revwalk(repo)? else {
        return Ok(vec![]);
    };

    Ok(revwalk
        .skip(skip)
        .take(limit)
        .filter_map(|oid| oid.ok())
        .filter_map(|oid| commit_summary(repo, oid))
        .collect())
}

/// Find up to `limit` commits reachable from HEAD whose message contains
/// `query` (case-insensitive), in `git log` order (see [`log_revwalk`]).
pub(crate) fn find_commits_by_message(
    repo: &git2::Repository,
    query: &str,
    limit: usize,
) -> Result<Vec<CommitSummary>, GitError> {
    let Some(revwalk) = log_revwalk(repo)? else {
        return Ok(vec![]);
    };

    let query_lower = query.to_lowercase();

    Ok(revwalk
        .filter_map(|oid| oid.ok())
        .filter(|oid| {
            let Ok(commit) = repo.find_commit(*oid) else {
                return false;
            };
            commit
                .message()
                .unwrap_or("")
                .to_lowercase()
                .contains(&query_lower)
        })
        .filter_map(|oid| commit_summary(repo, oid))
        .take(limit)
        .collect())
}

/// Get paginated commit history.
///
/// Returns commits reachable from HEAD in `git log` order (children before
/// parents, newest first). Use skip and limit for pagination.
#[tauri::command]
#[specta::specta]
pub async fn get_commit_history(
    skip: u32,
    limit: u32,
    state: State<'_, RepositoryState>,
) -> Result<Vec<CommitSummary>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        list_commit_history(&repo, skip as usize, limit as usize)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Get full details of a specific commit.
#[tauri::command]
#[specta::specta]
pub async fn get_commit_details(
    oid: String,
    state: State<'_, RepositoryState>,
) -> Result<CommitDetails, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let commit_oid = git2::Oid::from_str(&oid)
            .map_err(|e| GitError::OperationFailed(format!("Invalid OID: {}", e)))?;

        let commit = repo.find_commit(commit_oid)?;
        let author = commit.author();
        let committer = commit.committer();

        // Get parent OIDs
        let parent_oids: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();

        // Get files changed by diffing against first parent (or empty tree)
        let commit_tree = commit.tree()?;
        let parent_tree = if commit.parent_count() > 0 {
            Some(commit.parent(0)?.tree()?)
        } else {
            None
        };

        let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)?;

        // Use RefCell to allow interior mutability for the closures
        let files_changed: RefCell<Vec<FileChanged>> = RefCell::new(Vec::new());
        let stats_map: RefCell<HashMap<String, (i32, i32)>> = RefCell::new(HashMap::new());

        // First pass: collect file list and initialize stats
        diff.foreach(
            &mut |delta, _| {
                let path = delta
                    .new_file()
                    .path()
                    .or_else(|| delta.old_file().path())
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                let status = match delta.status() {
                    git2::Delta::Added => "added",
                    git2::Delta::Deleted => "deleted",
                    git2::Delta::Modified => "modified",
                    git2::Delta::Renamed => "renamed",
                    git2::Delta::Copied => "copied",
                    _ => "modified",
                };

                files_changed.borrow_mut().push(FileChanged {
                    path: path.clone(),
                    status: status.to_string(),
                    additions: 0,
                    deletions: 0,
                });

                stats_map.borrow_mut().insert(path, (0, 0));
                true
            },
            None,
            None,
            Some(&mut |delta, _hunk, line| {
                let path = delta
                    .new_file()
                    .path()
                    .or_else(|| delta.old_file().path())
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                if let Some(stats) = stats_map.borrow_mut().get_mut(&path) {
                    match line.origin() {
                        '+' => stats.0 += 1,
                        '-' => stats.1 += 1,
                        _ => {}
                    }
                }
                true
            }),
        )?;

        // Apply stats to files_changed
        let stats = stats_map.into_inner();
        let mut files = files_changed.into_inner();
        for file in &mut files {
            if let Some((additions, deletions)) = stats.get(&file.path) {
                file.additions = *additions;
                file.deletions = *deletions;
            }
        }

        Ok(CommitDetails {
            oid: commit_oid.to_string(),
            short_oid: format!("{:.7}", commit_oid),
            message: commit.message().unwrap_or("").to_string(),
            author_name: author.name().unwrap_or("Unknown").to_string(),
            author_email: author.email().unwrap_or("").to_string(),
            author_timestamp_ms: (author.when().seconds() as f64) * 1000.0,
            committer_name: committer.name().unwrap_or("Unknown").to_string(),
            committer_email: committer.email().unwrap_or("").to_string(),
            committer_timestamp_ms: (committer.when().seconds() as f64) * 1000.0,
            parent_oids,
            files_changed: files,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Search commits by message text.
/// Returns up to `limit` commits whose message contains `query` (case-insensitive).
#[tauri::command]
#[specta::specta]
pub async fn search_commits(
    query: String,
    limit: u32,
    state: State<'_, RepositoryState>,
) -> Result<Vec<CommitSummary>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        find_commits_by_message(&repo, &query, limit as usize)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;

    const T0: i64 = 1_700_000_000;

    /// Create an (empty-tree) commit with a fixed author/committer time, so
    /// tests control timestamp ties precisely.
    fn commit_at(
        repo: &git2::Repository,
        msg: &str,
        parents: &[git2::Oid],
        time: i64,
    ) -> git2::Oid {
        let mut index = repo.index().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig =
            git2::Signature::new("Test", "test@test.com", &git2::Time::new(time, 0)).unwrap();
        let parent_commits: Vec<git2::Commit> =
            parents.iter().map(|p| repo.find_commit(*p).unwrap()).collect();
        let parent_refs: Vec<&git2::Commit> = parent_commits.iter().collect();
        repo.commit(None, &sig, &sig, msg, &tree, &parent_refs).unwrap()
    }

    /// Builds, in a temp dir, a history where every commit but the tip shares
    /// one timestamp (as produced by a script, a squash or an import):
    ///
    /// ```text
    /// c0 - c1 - c2 ---------- m - c3 - c4 (HEAD, main)
    ///             \          /
    ///              f1 - f2 --   (feature)
    /// ```
    ///
    /// Returns the repo and the expected `git log --topo-order` output as
    /// commit subjects. The only choice the topology leaves open is where
    /// `c4` goes, and its newer timestamp settles that.
    fn same_timestamp_repo() -> (tempfile::TempDir, git2::Repository, Vec<&'static str>) {
        let dir = tempfile::TempDir::new().unwrap();
        let repo = git2::Repository::init(dir.path()).unwrap();

        let c0 = commit_at(&repo, "c0 initial", &[], T0);
        let c1 = commit_at(&repo, "c1", &[c0], T0);
        let c2 = commit_at(&repo, "c2", &[c1], T0);
        let f1 = commit_at(&repo, "f1", &[c2], T0);
        let f2 = commit_at(&repo, "f2", &[f1], T0);
        let m = commit_at(&repo, "m merge feature", &[c2, f2], T0);
        let c3 = commit_at(&repo, "c3", &[m], T0);
        let c4 = commit_at(&repo, "c4 newest", &[c3], T0 + 100);

        repo.reference("refs/heads/feature", f2, true, "").unwrap();
        repo.reference("refs/heads/main", c4, true, "").unwrap();
        repo.set_head("refs/heads/main").unwrap();

        let expected = vec![
            "c4 newest",
            "c3",
            "m merge feature",
            "f2",
            "f1",
            "c2",
            "c1",
            "c0 initial",
        ];
        (dir, repo, expected)
    }

    fn subjects(commits: &[CommitSummary]) -> Vec<&str> {
        commits.iter().map(|c| c.message_subject.as_str()).collect()
    }

    /// Every commit must be listed before each of its parents.
    fn assert_children_before_parents(repo: &git2::Repository, commits: &[CommitSummary]) {
        let position: HashMap<&str, usize> = commits
            .iter()
            .enumerate()
            .map(|(i, c)| (c.oid.as_str(), i))
            .collect();
        for summary in commits {
            let oid = git2::Oid::from_str(&summary.oid).unwrap();
            let commit = repo.find_commit(oid).unwrap();
            for parent in commit.parent_ids() {
                let parent = parent.to_string();
                assert!(
                    position[summary.oid.as_str()] < position[parent.as_str()],
                    "{} is listed after its parent {}",
                    summary.message_subject,
                    parent
                );
            }
        }
    }

    #[test]
    fn history_is_topological_newest_first_despite_equal_timestamps() {
        let (_dir, repo, expected) = same_timestamp_repo();

        let commits = list_commit_history(&repo, 0, 100).unwrap();

        assert_eq!(subjects(&commits), expected);
        assert_children_before_parents(&repo, &commits);
    }

    #[test]
    fn history_pages_concatenate_into_the_full_ordered_history() {
        let (_dir, repo, expected) = same_timestamp_repo();

        let page_size = 3;
        let mut paged = Vec::new();
        let mut skip = 0;
        loop {
            let page = list_commit_history(&repo, skip, page_size).unwrap();
            let last_page = page.len() < page_size;
            paged.extend(page);
            skip += page_size;
            if last_page {
                break;
            }
        }

        assert_eq!(subjects(&paged), expected);
    }

    #[test]
    fn history_of_empty_repo_is_empty() {
        let dir = tempfile::TempDir::new().unwrap();
        let repo = git2::Repository::init(dir.path()).unwrap();

        assert!(list_commit_history(&repo, 0, 10).unwrap().is_empty());
        assert!(find_commits_by_message(&repo, "c", 10).unwrap().is_empty());
    }

    #[test]
    fn search_results_follow_history_order_and_limit() {
        let (_dir, repo, expected) = same_timestamp_repo();

        let matches = find_commits_by_message(&repo, "C", 100).unwrap();
        let expected_matches: Vec<&str> = expected
            .iter()
            .copied()
            .filter(|s| s.contains('c'))
            .collect();
        assert_eq!(subjects(&matches), expected_matches);

        let limited = find_commits_by_message(&repo, "c", 2).unwrap();
        assert_eq!(subjects(&limited), &expected_matches[..2]);
    }
}
