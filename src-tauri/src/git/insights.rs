use chrono::Utc;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Daily commit count for a specific date.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DailyCommitCount {
    /// Date in YYYY-MM-DD format
    pub date: String,
    /// Number of commits on this date
    pub count: u32,
}

/// Contributor statistics aggregated from commit history.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContributorStats {
    /// Author name
    pub name: String,
    /// Author email
    pub email: String,
    /// Total number of commits by this contributor
    pub commit_count: u32,
    /// Percentage of total commits
    pub percentage: f64,
    /// Timestamp of first commit in milliseconds
    pub first_commit_ms: f64,
    /// Timestamp of last commit in milliseconds
    pub last_commit_ms: f64,
}

/// Aggregated repository insights over a time period.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepoInsights {
    /// Total number of commits in the time period
    pub total_commits: u32,
    /// Number of active branches (local + remote)
    pub active_branches: u32,
    /// Number of unique contributors
    pub contributor_count: u32,
    /// Timestamp of the earliest commit seen (milliseconds)
    pub first_commit_ms: f64,
    /// Daily commit counts sorted by date ascending
    pub daily_commits: Vec<DailyCommitCount>,
    /// Contributor statistics sorted by commit count descending
    pub contributors: Vec<ContributorStats>,
}

/// Branch health information for the insights dashboard.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BranchHealthInfo {
    /// Branch name
    pub name: String,
    /// Whether this is the current HEAD branch
    pub is_head: bool,
    /// Whether this is a remote tracking branch
    pub is_remote: bool,
    /// Date of last commit in YYYY-MM-DD format
    pub last_commit_date: String,
    /// Timestamp of last commit in milliseconds
    pub last_commit_timestamp_ms: f64,
    /// Summary of the last commit message
    pub last_commit_message: String,
    /// Commits ahead of HEAD
    pub ahead: u32,
    /// Commits behind HEAD
    pub behind: u32,
    /// Whether the branch is stale (no commits within stale_days)
    pub is_stale: bool,
    /// Whether the branch is merged into HEAD (None if IS head)
    pub is_merged: Option<bool>,
}

/// Get aggregated repository insights for a given time period.
#[tauri::command]
#[specta::specta]
pub async fn get_repo_insights(
    days: u32,
    state: State<'_, RepositoryState>,
) -> Result<RepoInsights, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Handle unborn HEAD (empty repo)
        let head_oid = match repo.head() {
            Ok(head) => head
                .target()
                .ok_or_else(|| GitError::OperationFailed("HEAD has no target".to_string()))?,
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                // Empty repository - return zeroed insights
                let active_branches = count_branches(&repo)?;
                return Ok(RepoInsights {
                    total_commits: 0,
                    active_branches,
                    contributor_count: 0,
                    first_commit_ms: 0.0,
                    daily_commits: Vec::new(),
                    contributors: Vec::new(),
                });
            }
            Err(e) => return Err(e.into()),
        };

        let cutoff_ts = Utc::now().timestamp() - (days as i64 * 86400);

        // Single-pass revwalk from HEAD sorted by time
        let mut revwalk = repo.revwalk()?;
        revwalk.push(head_oid)?;
        revwalk.set_sorting(git2::Sort::TIME)?;

        let mut total: u32 = 0;
        let mut earliest_ts: i64 = i64::MAX;
        let mut daily: HashMap<String, u32> = HashMap::new();
        // email -> (name, count, first_ts, last_ts)
        let mut authors: HashMap<String, (String, u32, i64, i64)> = HashMap::new();

        for oid_result in revwalk {
            let oid = oid_result?;
            let commit = repo.find_commit(oid)?;
            let ts = commit.time().seconds();

            if ts < cutoff_ts {
                break; // Commits are time-sorted, so we can stop early
            }

            total += 1;

            if ts < earliest_ts {
                earliest_ts = ts;
            }

            // Bucket by date
            let date_str = chrono::DateTime::from_timestamp(ts, 0)
                .map(|dt| dt.format("%Y-%m-%d").to_string())
                .unwrap_or_else(|| "unknown".to_string());
            *daily.entry(date_str).or_insert(0) += 1;

            // Aggregate author stats
            let author = commit.author();
            let name = author.name().unwrap_or("Unknown").to_string();
            let email = author.email().unwrap_or("unknown").to_string();

            authors
                .entry(email.clone())
                .and_modify(|(_, count, first, last)| {
                    *count += 1;
                    if ts < *first {
                        *first = ts;
                    }
                    if ts > *last {
                        *last = ts;
                    }
                })
                .or_insert((name, 1, ts, ts));
        }

        // Count active branches
        let active_branches = count_branches(&repo)?;

        // Convert daily map to sorted vec
        let mut daily_commits: Vec<DailyCommitCount> = daily
            .into_iter()
            .map(|(date, count)| DailyCommitCount { date, count })
            .collect();
        daily_commits.sort_by(|a, b| a.date.cmp(&b.date));

        // Convert authors map to sorted vec
        let mut contributors: Vec<ContributorStats> = authors
            .into_iter()
            .map(|(email, (name, commit_count, first_ts, last_ts))| ContributorStats {
                name,
                email,
                commit_count,
                percentage: if total > 0 {
                    (commit_count as f64 / total as f64) * 100.0
                } else {
                    0.0
                },
                first_commit_ms: (first_ts as f64) * 1000.0,
                last_commit_ms: (last_ts as f64) * 1000.0,
            })
            .collect();
        contributors.sort_by(|a, b| b.commit_count.cmp(&a.commit_count));

        let first_commit_ms = if earliest_ts == i64::MAX {
            0.0
        } else {
            (earliest_ts as f64) * 1000.0
        };

        Ok(RepoInsights {
            total_commits: total,
            active_branches,
            contributor_count: contributors.len() as u32,
            first_commit_ms,
            daily_commits,
            contributors,
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Get branch health information for all branches.
#[tauri::command]
#[specta::specta]
pub async fn get_branch_health(
    stale_days: u32,
    state: State<'_, RepositoryState>,
) -> Result<Vec<BranchHealthInfo>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Get HEAD commit for merge base checks
        let head_commit = match repo.head() {
            Ok(head) => head.peel_to_commit()?,
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                // Empty repo - no branches to report
                return Ok(Vec::new());
            }
            Err(e) => return Err(e.into()),
        };
        let head_oid = head_commit.id();

        let stale_cutoff = Utc::now().timestamp() - (stale_days as i64 * 86400);
        let mut branches = Vec::new();

        for branch_result in repo.branches(None)? {
            let (branch, branch_type) = branch_result?;

            let name = match branch.name()? {
                Some(n) => n.to_string(),
                None => continue,
            };

            // Skip HEAD references (e.g., "origin/HEAD")
            if name.ends_with("/HEAD") {
                continue;
            }

            let is_remote = branch_type == git2::BranchType::Remote;
            let is_head = !is_remote && branch.is_head();

            let commit = match branch.get().peel_to_commit() {
                Ok(c) => c,
                Err(_) => continue,
            };

            let ts = commit.time().seconds();
            let last_commit_date = chrono::DateTime::from_timestamp(ts, 0)
                .map(|dt| dt.format("%Y-%m-%d").to_string())
                .unwrap_or_else(|| "unknown".to_string());
            let last_commit_timestamp_ms = (ts as f64) * 1000.0;
            let last_commit_message = commit.summary().unwrap_or("").to_string();

            // Compute ahead/behind vs HEAD
            let branch_oid = commit.id();
            let (ahead, behind) = if branch_oid == head_oid {
                (0, 0)
            } else {
                repo.graph_ahead_behind(branch_oid, head_oid)
                    .unwrap_or((0, 0))
            };

            let is_stale = ts < stale_cutoff;

            let is_merged = if is_head {
                None
            } else {
                match repo.merge_base(head_oid, branch_oid) {
                    Ok(merge_base) => Some(merge_base == branch_oid),
                    Err(_) => Some(false),
                }
            };

            branches.push(BranchHealthInfo {
                name,
                is_head,
                is_remote,
                last_commit_date,
                last_commit_timestamp_ms,
                last_commit_message,
                ahead: ahead as u32,
                behind: behind as u32,
                is_stale,
                is_merged,
            });
        }

        // Sort: HEAD branch first, then by last_commit_timestamp_ms descending
        branches.sort_by(|a, b| {
            if a.is_head != b.is_head {
                return b.is_head.cmp(&a.is_head);
            }
            b.last_commit_timestamp_ms
                .partial_cmp(&a.last_commit_timestamp_ms)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(branches)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Count all branches (local + remote) in the repository.
fn count_branches(repo: &git2::Repository) -> Result<u32, GitError> {
    let mut count: u32 = 0;
    for branch_result in repo.branches(None)? {
        let _ = branch_result?;
        count += 1;
    }
    Ok(count)
}
