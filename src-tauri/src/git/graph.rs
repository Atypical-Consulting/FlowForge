use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::{HashMap, HashSet};
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
    /// Whether this commit is a first-parent ancestor of HEAD
    pub is_head_ancestor: bool,
    /// The "ideological branch" name that owns this commit for coloring
    pub ideological_branch: String,
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

        // ── 1. Collect all branch refs with their tip OIDs ──
        // Maps commit OID -> list of branch names pointing to it
        let mut branch_map: HashMap<git2::Oid, Vec<String>> = HashMap::new();
        let mut branch_tips: Vec<(git2::Oid, String)> = Vec::new();

        for branch_result in repo.branches(Some(git2::BranchType::Local))? {
            let (branch, _) = branch_result?;
            if let Some(name) = branch.name()? {
                if let Ok(reference) = branch.get().resolve() {
                    if let Some(oid) = reference.target() {
                        branch_map.entry(oid).or_default().push(name.to_string());
                        branch_tips.push((oid, name.to_string()));
                    }
                }
            }
        }

        // ── 2. Identify HEAD and first-parent ancestors ──
        let head_oid = repo.head().ok().and_then(|h| h.target());
        let mut head_ancestors: HashSet<git2::Oid> = HashSet::new();
        if let Some(head) = head_oid {
            // Walk first-parent chain from HEAD
            let mut current = head;
            loop {
                head_ancestors.insert(current);
                if let Ok(commit) = repo.find_commit(current) {
                    if let Ok(parent) = commit.parent_id(0) {
                        current = parent;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
        }

        // ── 3. Revwalk to collect commits ──
        let mut revwalk = repo.revwalk()?;
        revwalk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)?;

        if let Some(head) = head_oid {
            let _ = revwalk.push(head);
        }
        for (tip, _) in &branch_tips {
            let _ = revwalk.push(*tip);
        }

        let mut nodes: Vec<GraphNode> = Vec::new();
        let mut edges: Vec<GraphEdge> = Vec::new();
        let mut oid_to_index: HashMap<String, usize> = HashMap::new();

        for (idx, oid_result) in revwalk.enumerate() {
            if idx < offset {
                continue;
            }
            if nodes.len() >= limit {
                break;
            }

            if let Ok(oid) = oid_result {
                if let Ok(commit) = repo.find_commit(oid) {
                    let author = commit.author();
                    let parent_oids: Vec<String> =
                        commit.parent_ids().map(|id| id.to_string()).collect();
                    let branch_names = branch_map.get(&oid).cloned().unwrap_or_default();

                    for parent_oid in &parent_oids {
                        edges.push(GraphEdge {
                            from: oid.to_string(),
                            to: parent_oid.clone(),
                        });
                    }

                    let node_index = nodes.len();
                    oid_to_index.insert(oid.to_string(), node_index);

                    nodes.push(GraphNode {
                        oid: oid.to_string(),
                        short_oid: oid.to_string()[..7].to_string(),
                        message: commit.summary().unwrap_or("").to_string(),
                        author: author.name().unwrap_or("Unknown").to_string(),
                        timestamp_ms: (commit.time().seconds() as f64) * 1000.0,
                        parents: parent_oids,
                        branch_type: BranchType::Other, // Will be set by ideological assignment
                        column: 0,                      // Will be set by lane algorithm
                        branch_names,
                        is_head_ancestor: head_ancestors.contains(&oid),
                        ideological_branch: String::new(), // Will be set below
                    });
                }
            }
        }

        // ── 4. Ideological branch assignment (Ungit-style) ──
        // Sort refs by priority: local branches first, then by Gitflow priority.
        // Each ref traverses all parents depth-first; the first ref to reach
        // a node "owns" it for coloring and lane purposes.
        let mut sorted_refs: Vec<(String, BranchType)> = branch_tips
            .iter()
            .map(|(_, name)| (name.clone(), classify_branch(name)))
            .collect();

        // Priority: Main(0) > Develop(1) > Release(2) > Hotfix(3) > Feature(4) > Other(5)
        fn branch_priority(bt: &BranchType) -> u8 {
            match bt {
                BranchType::Main => 0,
                BranchType::Develop => 1,
                BranchType::Release => 2,
                BranchType::Hotfix => 3,
                BranchType::Feature => 4,
                BranchType::Other => 5,
            }
        }
        sorted_refs.sort_by(|a, b| branch_priority(&a.1).cmp(&branch_priority(&b.1)));

        // Build parent lookup within our visible nodes
        let mut children_map: HashMap<String, Vec<String>> = HashMap::new();
        for node in &nodes {
            for parent in &node.parents {
                children_map
                    .entry(parent.clone())
                    .or_default()
                    .push(node.oid.clone());
            }
        }

        let mut stamped: HashSet<String> = HashSet::new();

        for (ref_name, ref_type) in &sorted_refs {
            // Find the tip commit for this ref in our node set
            let tip_oid = branch_tips
                .iter()
                .find(|(_, name)| name == ref_name)
                .map(|(oid, _)| oid.to_string());

            if let Some(tip) = tip_oid {
                // DFS through parents, stamping each node with this ref
                let mut stack = vec![tip];
                while let Some(current) = stack.pop() {
                    if stamped.contains(&current) {
                        continue;
                    }
                    if let Some(&idx) = oid_to_index.get(&current) {
                        stamped.insert(current.clone());
                        nodes[idx].ideological_branch = ref_name.clone();
                        nodes[idx].branch_type = *ref_type;
                        // Push parents to continue traversal
                        for parent in &nodes[idx].parents {
                            if !stamped.contains(parent) {
                                stack.push(parent.clone());
                            }
                        }
                    }
                }
            }
        }

        // Any unstamped nodes (orphans) get "other"
        for node in &mut nodes {
            if node.ideological_branch.is_empty() {
                node.ideological_branch = "other".to_string();
                node.branch_type = BranchType::Other;
            }
        }

        // ── 5. Assign lanes for visual layout ──
        assign_lanes(&mut nodes, &head_ancestors);

        Ok(CommitGraph { nodes, edges })
    })
    .await
    .map_err(|e| GitError::OperationFailed(format!("Task join error: {}", e)))?
}

/// Assign lane/column positions to commits for visual layout (Ungit-style).
///
/// Algorithm: HEAD ancestors always get column 0. Side branches get columns
/// assigned per ideological branch — all commits belonging to the same branch
/// share the same column. Columns are allocated left-to-right as new branches
/// are first encountered in topological order.
fn assign_lanes(nodes: &mut [GraphNode], _head_ancestors: &HashSet<git2::Oid>) {
    if nodes.is_empty() {
        return;
    }

    // Map ideological branch name -> assigned column
    let mut branch_column: HashMap<String, u32> = HashMap::new();
    // Column 0 is always reserved for HEAD ancestry line
    let mut next_column: u32 = 1;

    for node in nodes.iter_mut() {
        if node.is_head_ancestor {
            // HEAD ancestors always go in column 0
            node.column = 0;
        } else {
            // Side-branch commits: assign a column per ideological branch
            let col = if let Some(&col) = branch_column.get(&node.ideological_branch) {
                col
            } else {
                let col = next_column;
                next_column += 1;
                branch_column.insert(node.ideological_branch.clone(), col);
                col
            };
            node.column = col;
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

    fn make_node(oid: &str, parents: Vec<&str>, is_head: bool, branch: &str) -> GraphNode {
        GraphNode {
            oid: oid.to_string(),
            short_oid: oid[..7.min(oid.len())].to_string(),
            message: format!("Commit {}", oid),
            author: "Test".to_string(),
            timestamp_ms: 0.0,
            parents: parents.into_iter().map(String::from).collect(),
            branch_type: classify_branch(branch),
            column: 0,
            branch_names: vec![],
            is_head_ancestor: is_head,
            ideological_branch: branch.to_string(),
        }
    }

    #[test]
    fn test_assign_lanes_empty() {
        let mut nodes: Vec<GraphNode> = vec![];
        let head_ancestors = HashSet::new();
        assign_lanes(&mut nodes, &head_ancestors);
        assert!(nodes.is_empty());
    }

    #[test]
    fn test_assign_lanes_single_commit() {
        let oid = git2::Oid::from_str("abc1234abc1234abc1234abc1234abc1234abc12").unwrap();
        let mut head_ancestors = HashSet::new();
        head_ancestors.insert(oid);
        let mut nodes = vec![make_node(
            "abc1234abc1234abc1234abc1234abc1234abc12",
            vec![],
            true,
            "main",
        )];
        assign_lanes(&mut nodes, &head_ancestors);
        assert_eq!(nodes[0].column, 0);
    }

    #[test]
    fn test_assign_lanes_linear_history() {
        let oid3 = git2::Oid::from_str("3333333333333333333333333333333333333333").unwrap();
        let oid2 = git2::Oid::from_str("2222222222222222222222222222222222222222").unwrap();
        let oid1 = git2::Oid::from_str("1111111111111111111111111111111111111111").unwrap();
        let mut head_ancestors = HashSet::new();
        head_ancestors.insert(oid3);
        head_ancestors.insert(oid2);
        head_ancestors.insert(oid1);
        let mut nodes = vec![
            make_node(
                "3333333333333333333333333333333333333333",
                vec!["2222222222222222222222222222222222222222"],
                true,
                "main",
            ),
            make_node(
                "2222222222222222222222222222222222222222",
                vec!["1111111111111111111111111111111111111111"],
                true,
                "main",
            ),
            make_node(
                "1111111111111111111111111111111111111111",
                vec![],
                true,
                "main",
            ),
        ];
        assign_lanes(&mut nodes, &head_ancestors);
        // All HEAD ancestors should be in column 0
        assert_eq!(nodes[0].column, 0);
        assert_eq!(nodes[1].column, 0);
        assert_eq!(nodes[2].column, 0);
    }

    #[test]
    fn test_assign_lanes_branch() {
        let oid_head = git2::Oid::from_str("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").unwrap();
        let oid_base = git2::Oid::from_str("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb").unwrap();
        let mut head_ancestors = HashSet::new();
        head_ancestors.insert(oid_head);
        head_ancestors.insert(oid_base);
        let mut nodes = vec![
            make_node(
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                vec!["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
                true,
                "main",
            ),
            make_node(
                "cccccccccccccccccccccccccccccccccccccccc",
                vec!["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
                false,
                "feature/login",
            ),
            make_node(
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                vec![],
                true,
                "main",
            ),
        ];
        assign_lanes(&mut nodes, &head_ancestors);
        assert_eq!(nodes[0].column, 0); // HEAD ancestor = column 0
        assert_eq!(nodes[1].column, 1); // feature branch = column 1
        assert_eq!(nodes[2].column, 0); // HEAD ancestor = column 0
    }
}
