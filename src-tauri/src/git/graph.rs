use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Branch type classification for Gitflow-based coloring.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum BranchType {
    /// Main/master branch - stable production code
    Main,
    /// Develop branch - integration branch for features
    Develop,
    /// Feature branches - new features in development
    Feature,
    /// Release branches - preparing for production release
    Release,
    /// Hotfix branches - urgent production fixes
    Hotfix,
    /// Other branches that don't follow Gitflow naming
    Other,
}

/// A node in the commit graph representing a single commit.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    /// Full SHA-1 hash of the commit (40 chars)
    pub oid: String,
    /// Short SHA-1 hash of the commit (7 chars)
    pub short_oid: String,
    /// First line of the commit message
    pub message: String,
    /// Author name
    pub author: String,
    /// Unix timestamp in milliseconds (safe for JS Number up to year 275760)
    pub timestamp_ms: f64,
    /// Parent commit SHAs
    pub parents: Vec<String>,
    /// Classification of the branch type for coloring
    pub branch_type: BranchType,
    /// Lane/column position for visual layout (0-indexed from left)
    pub column: u32,
    /// Branch names pointing to this commit
    pub branch_names: Vec<String>,
}

/// An edge in the commit graph connecting parent and child commits.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    /// SHA of the child commit (the commit that has this parent)
    pub from: String,
    /// SHA of the parent commit
    pub to: String,
}

/// Complete commit graph with nodes and edges for visualization.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitGraph {
    /// All commit nodes in topological order
    pub nodes: Vec<GraphNode>,
    /// Edges representing parent-child relationships
    pub edges: Vec<GraphEdge>,
}

/// Classify a branch name into a Gitflow branch type.
pub fn classify_branch(name: &str) -> BranchType {
    let name_lower = name.to_lowercase();

    if name_lower == "main" || name_lower == "master" {
        BranchType::Main
    } else if name_lower == "develop" || name_lower == "dev" {
        BranchType::Develop
    } else if name_lower.starts_with("feature/") {
        BranchType::Feature
    } else if name_lower.starts_with("release/") {
        BranchType::Release
    } else if name_lower.starts_with("hotfix/") {
        BranchType::Hotfix
    } else {
        BranchType::Other
    }
}

/// IPC command to get the commit graph for visualization.
///
/// # Arguments
/// * `limit` - Maximum number of commits to return (default: 100, max: 500)
/// * `offset` - Number of commits to skip (default: 0)
/// * `state` - Repository state containing the current repo path
///
/// # Returns
/// A CommitGraph containing nodes and edges for visualization.
#[tauri::command]
#[specta::specta]
pub async fn get_commit_graph(
    limit: Option<u32>,
    offset: Option<u32>,
    state: State<'_, RepositoryState>,
) -> Result<CommitGraph, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    get_commit_graph_impl(repo_path, limit, offset).await
}

/// Internal implementation of get_commit_graph.
async fn get_commit_graph_impl(
    repo_path: PathBuf,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<CommitGraph, GitError> {
    let limit = limit.unwrap_or(100).min(500) as usize;
    let offset = offset.unwrap_or(0) as usize;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Build branch-to-commit mapping
        // Maps commit OID -> list of branch names pointing to it
        let mut branch_map: HashMap<git2::Oid, Vec<String>> = HashMap::new();

        // Collect all branch tips for the revwalk
        let mut branch_tips: Vec<git2::Oid> = Vec::new();

        for branch_result in repo.branches(Some(git2::BranchType::Local))? {
            let (branch, _) = branch_result?;
            if let Some(name) = branch.name()? {
                if let Ok(reference) = branch.get().resolve() {
                    if let Some(oid) = reference.target() {
                        branch_map.entry(oid).or_default().push(name.to_string());
                        branch_tips.push(oid);
                    }
                }
            }
        }

        // Create revwalk with topological + time sorting
        let mut revwalk = repo.revwalk()?;
        revwalk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)?;

        // Push HEAD first
        if let Ok(head) = repo.head() {
            if let Some(oid) = head.target() {
                let _ = revwalk.push(oid);
            }
        }

        // Push all branch tips to get the full graph
        for tip in &branch_tips {
            let _ = revwalk.push(*tip);
        }

        // Determine branch type for a commit based on branches pointing to it
        let determine_branch_type = |branches: &[String]| -> BranchType {
            // Prioritize: Main > Develop > Release > Hotfix > Feature > Other
            let mut best_type = BranchType::Other;
            for branch in branches {
                let branch_type = classify_branch(branch);
                match branch_type {
                    BranchType::Main => return BranchType::Main,
                    BranchType::Develop if best_type != BranchType::Main => {
                        best_type = BranchType::Develop;
                    }
                    BranchType::Release
                        if best_type != BranchType::Main && best_type != BranchType::Develop =>
                    {
                        best_type = BranchType::Release;
                    }
                    BranchType::Hotfix
                        if best_type != BranchType::Main
                            && best_type != BranchType::Develop
                            && best_type != BranchType::Release =>
                    {
                        best_type = BranchType::Hotfix;
                    }
                    BranchType::Feature if best_type == BranchType::Other => {
                        best_type = BranchType::Feature;
                    }
                    _ => {}
                }
            }
            best_type
        };

        // Collect commits with pagination
        let mut nodes: Vec<GraphNode> = Vec::new();
        let mut edges: Vec<GraphEdge> = Vec::new();

        // Track which branch a commit belongs to (for commits without direct branch refs)
        let mut commit_branch_type: HashMap<git2::Oid, BranchType> = HashMap::new();

        // Pre-populate with known branch tips
        for (oid, branches) in &branch_map {
            commit_branch_type.insert(*oid, determine_branch_type(branches));
        }

        for (idx, oid_result) in revwalk.enumerate() {
            // Skip offset commits
            if idx < offset {
                continue;
            }
            // Stop after collecting limit commits
            if nodes.len() >= limit {
                break;
            }

            if let Ok(oid) = oid_result {
                if let Ok(commit) = repo.find_commit(oid) {
                    let author = commit.author();
                    let parent_oids: Vec<String> =
                        commit.parent_ids().map(|id| id.to_string()).collect();

                    // Get branch names if this commit has any
                    let branch_names = branch_map.get(&oid).cloned().unwrap_or_default();

                    // Determine branch type
                    let branch_type = if !branch_names.is_empty() {
                        determine_branch_type(&branch_names)
                    } else if let Some(&bt) = commit_branch_type.get(&oid) {
                        bt
                    } else {
                        // Inherit from first parent if available
                        commit
                            .parent_id(0)
                            .ok()
                            .and_then(|parent_oid| commit_branch_type.get(&parent_oid).copied())
                            .unwrap_or(BranchType::Other)
                    };

                    // Propagate branch type to parents
                    for parent_id in commit.parent_ids() {
                        if !commit_branch_type.contains_key(&parent_id) {
                            commit_branch_type.insert(parent_id, branch_type);
                        }
                    }

                    // Build edges for parent relationships
                    for parent_oid in &parent_oids {
                        edges.push(GraphEdge {
                            from: oid.to_string(),
                            to: parent_oid.clone(),
                        });
                    }

                    nodes.push(GraphNode {
                        oid: oid.to_string(),
                        short_oid: oid.to_string()[..7].to_string(),
                        message: commit.summary().unwrap_or("").to_string(),
                        author: author.name().unwrap_or("Unknown").to_string(),
                        timestamp_ms: (commit.time().seconds() as f64) * 1000.0,
                        parents: parent_oids,
                        branch_type,
                        column: 0, // Will be assigned by lane algorithm
                        branch_names,
                    });
                }
            }
        }

        // Assign lanes for visual layout
        assign_lanes(&mut nodes);

        Ok(CommitGraph { nodes, edges })
    })
    .await
    .map_err(|e| GitError::OperationFailed(format!("Task join error: {}", e)))?
}

/// Assign lane/column positions to commits for visual layout.
///
/// Algorithm overview:
/// Nodes arrive in topological order (children before parents from the revwalk).
/// We process them in order and propagate column assignments downward:
///
/// 1. Each node gets a column: either an existing reservation or a new lane.
/// 2. The node's first parent inherits the node's column (continuing the branch line).
/// 3. Additional parents (merge sources) get their own lane if not already assigned.
/// 4. When a merge is encountered, the secondary branch's lane is freed.
///
/// This produces the classic git-graph layout where main/develop stay in the
/// leftmost lanes and feature branches fork to the right.
fn assign_lanes(nodes: &mut [GraphNode]) {
    if nodes.is_empty() {
        return;
    }

    // Maps commit OID to its pre-assigned column (reserved by a child)
    let mut reserved_column: HashMap<String, u32> = HashMap::new();

    // Active columns: true = occupied, false = free
    let mut active_columns: Vec<bool> = Vec::new();

    // Find or create a free column
    fn alloc_column(active: &mut Vec<bool>) -> u32 {
        for (i, occupied) in active.iter().enumerate() {
            if !occupied {
                active[i] = true;
                return i as u32;
            }
        }
        let col = active.len() as u32;
        active.push(true);
        col
    }

    fn free_column(active: &mut Vec<bool>, col: u32) {
        if (col as usize) < active.len() {
            active[col as usize] = false;
        }
    }

    for node in nodes.iter_mut() {
        // Step 1: Determine this node's column
        let column = if let Some(col) = reserved_column.remove(&node.oid) {
            // A child already reserved a column for us
            col
        } else {
            // New branch head (tip commit) — allocate a new lane
            alloc_column(&mut active_columns)
        };

        node.column = column;

        // Step 2: Reserve columns for parents
        if !node.parents.is_empty() {
            // First parent continues in this node's column
            let first_parent = &node.parents[0];
            if !reserved_column.contains_key(first_parent) {
                reserved_column.insert(first_parent.clone(), column);
            } else {
                // First parent already has a column from another child (convergence).
                // Free our column since the parent doesn't need it.
                free_column(&mut active_columns, column);
            }

            // Additional parents (merge sources) get their own lanes
            for parent in node.parents.iter().skip(1) {
                if !reserved_column.contains_key(parent) {
                    let parent_col = alloc_column(&mut active_columns);
                    reserved_column.insert(parent.clone(), parent_col);
                }
                // If parent already has a column, it will use it when we reach it.
                // The merge lane will be freed when the parent is processed.
            }
        } else {
            // Root commit — free the column (end of branch)
            free_column(&mut active_columns, column);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_branch_main() {
        assert_eq!(classify_branch("main"), BranchType::Main);
        assert_eq!(classify_branch("Main"), BranchType::Main);
        assert_eq!(classify_branch("MAIN"), BranchType::Main);
        assert_eq!(classify_branch("master"), BranchType::Main);
        assert_eq!(classify_branch("Master"), BranchType::Main);
    }

    #[test]
    fn test_classify_branch_develop() {
        assert_eq!(classify_branch("develop"), BranchType::Develop);
        assert_eq!(classify_branch("Develop"), BranchType::Develop);
        assert_eq!(classify_branch("dev"), BranchType::Develop);
        assert_eq!(classify_branch("Dev"), BranchType::Develop);
    }

    #[test]
    fn test_classify_branch_feature() {
        assert_eq!(classify_branch("feature/login"), BranchType::Feature);
        assert_eq!(classify_branch("feature/user-auth"), BranchType::Feature);
        assert_eq!(classify_branch("Feature/CAPS"), BranchType::Feature);
    }

    #[test]
    fn test_classify_branch_release() {
        assert_eq!(classify_branch("release/1.0.0"), BranchType::Release);
        assert_eq!(classify_branch("release/v2.0"), BranchType::Release);
        assert_eq!(classify_branch("Release/3.0"), BranchType::Release);
    }

    #[test]
    fn test_classify_branch_hotfix() {
        assert_eq!(classify_branch("hotfix/critical-bug"), BranchType::Hotfix);
        assert_eq!(classify_branch("hotfix/security-patch"), BranchType::Hotfix);
        assert_eq!(classify_branch("Hotfix/urgent"), BranchType::Hotfix);
    }

    #[test]
    fn test_classify_branch_other() {
        assert_eq!(classify_branch("bugfix/something"), BranchType::Other);
        assert_eq!(classify_branch("experiment"), BranchType::Other);
        assert_eq!(classify_branch("feat-login"), BranchType::Other);
    }

    #[test]
    fn test_assign_lanes_empty() {
        let mut nodes: Vec<GraphNode> = vec![];
        assign_lanes(&mut nodes);
        assert!(nodes.is_empty());
    }

    #[test]
    fn test_assign_lanes_single_commit() {
        let mut nodes = vec![GraphNode {
            oid: "abc1234".to_string(),
            short_oid: "abc1234".to_string(),
            message: "Initial commit".to_string(),
            author: "Test".to_string(),
            timestamp_ms: 0.0,
            parents: vec![],
            branch_type: BranchType::Main,
            column: 0,
            branch_names: vec!["main".to_string()],
        }];
        assign_lanes(&mut nodes);
        assert_eq!(nodes[0].column, 0);
    }

    #[test]
    fn test_assign_lanes_linear_history() {
        let mut nodes = vec![
            GraphNode {
                oid: "commit3".to_string(),
                short_oid: "commit3".to_string(),
                message: "Third".to_string(),
                author: "Test".to_string(),
                timestamp_ms: 3000.0,
                parents: vec!["commit2".to_string()],
                branch_type: BranchType::Main,
                column: 0,
                branch_names: vec!["main".to_string()],
            },
            GraphNode {
                oid: "commit2".to_string(),
                short_oid: "commit2".to_string(),
                message: "Second".to_string(),
                author: "Test".to_string(),
                timestamp_ms: 2000.0,
                parents: vec!["commit1".to_string()],
                branch_type: BranchType::Main,
                column: 0,
                branch_names: vec![],
            },
            GraphNode {
                oid: "commit1".to_string(),
                short_oid: "commit1".to_string(),
                message: "First".to_string(),
                author: "Test".to_string(),
                timestamp_ms: 1000.0,
                parents: vec![],
                branch_type: BranchType::Main,
                column: 0,
                branch_names: vec![],
            },
        ];
        assign_lanes(&mut nodes);
        // All commits should be in the same column for linear history
        assert_eq!(nodes[0].column, 0);
        assert_eq!(nodes[1].column, 0);
        assert_eq!(nodes[2].column, 0);
    }
}
