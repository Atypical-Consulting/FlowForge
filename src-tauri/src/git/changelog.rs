//! Changelog generation from conventional commits.
//!
//! This module provides functionality to generate formatted changelogs
//! from git commit history following the conventional commits specification.

use chrono::{DateTime, TimeZone, Utc};
use git2::{Oid, Repository, Sort};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use tera::{Context, Tera};
use thiserror::Error;

/// Options for changelog generation.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ChangelogOptions {
    /// Tag or commit to start from (exclusive).
    pub from_ref: Option<String>,
    /// Tag or commit to end at (inclusive, defaults to HEAD).
    pub to_ref: Option<String>,
    /// Include unreleased commits (default: true).
    pub include_unreleased: bool,
    /// Group commits by scope within each type (default: false).
    pub group_by_scope: bool,
    /// Version string for the changelog header.
    pub version: Option<String>,
    /// Date string for the changelog header.
    pub date: Option<String>,
}

impl Default for ChangelogOptions {
    fn default() -> Self {
        Self {
            from_ref: None,
            to_ref: None,
            include_unreleased: true,
            group_by_scope: false,
            version: None,
            date: None,
        }
    }
}

/// Output from changelog generation.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ChangelogOutput {
    /// Rendered markdown changelog.
    pub markdown: String,
    /// Total number of commits included.
    pub commit_count: u32,
    /// Commits grouped by type.
    pub groups: Vec<CommitGroup>,
}

/// A group of commits by type.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitGroup {
    /// Commit type (e.g., "feat", "fix").
    pub commit_type: String,
    /// Display title (e.g., "Features", "Bug Fixes").
    pub title: String,
    /// Commits in this group.
    pub commits: Vec<ChangelogCommit>,
}

/// A commit entry for the changelog.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ChangelogCommit {
    /// Short commit hash.
    pub hash: String,
    /// Commit scope (optional).
    pub scope: Option<String>,
    /// Commit description.
    pub description: String,
    /// Whether this is a breaking change.
    pub breaking: bool,
    /// Commit author name.
    pub author: String,
    /// Commit date in ISO format.
    pub date: String,
}

/// Errors that can occur during changelog generation.
#[derive(Debug, Error, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", content = "message")]
pub enum ChangelogError {
    #[error("Git error: {0}")]
    GitError(String),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Template error: {0}")]
    TemplateError(String),
}

impl From<git2::Error> for ChangelogError {
    fn from(err: git2::Error) -> Self {
        ChangelogError::GitError(err.message().to_string())
    }
}

impl From<tera::Error> for ChangelogError {
    fn from(err: tera::Error) -> Self {
        ChangelogError::TemplateError(err.to_string())
    }
}

/// Default changelog template.
const DEFAULT_TEMPLATE: &str = r#"# Changelog

{% for group in groups %}
## {{ group.title }}

{% for commit in group.commits %}
- {% if commit.scope %}**{{ commit.scope }}:** {% endif %}{{ commit.description }}{% if commit.breaking %} **BREAKING**{% endif %} ([{{ commit.hash }}])
{% endfor %}

{% endfor %}
"#;

/// Versioned changelog template with optional version header.
const VERSIONED_TEMPLATE: &str = r#"# Changelog

## {% if version %}{{ version }}{% else %}Unreleased{% endif %}{% if date %} ({{ date }}){% endif %}

{% for group in groups %}
### {{ group.title }}

{% for commit in group.commits %}
- {% if commit.scope %}**{{ commit.scope }}:** {% endif %}{{ commit.description }}{% if commit.breaking %} **BREAKING**{% endif %}
{% endfor %}

{% endfor %}
"#;

/// Order of commit types in the changelog (first = most important).
const TYPE_ORDER: &[&str] = &[
    "feat", "fix", "perf", "refactor", "docs", "style", "test", "chore", "ci", "build",
];

/// Map commit types to display titles.
fn get_type_title(commit_type: &str) -> &'static str {
    match commit_type {
        "feat" => "Features",
        "fix" => "Bug Fixes",
        "perf" => "Performance Improvements",
        "refactor" => "Code Refactoring",
        "docs" => "Documentation",
        "style" => "Styles",
        "test" => "Tests",
        "chore" => "Chores",
        "ci" => "Continuous Integration",
        "build" => "Build System",
        _ => "Other Changes",
    }
}

/// Get the sort order for a commit type (lower = higher priority).
fn get_type_order(commit_type: &str) -> usize {
    TYPE_ORDER
        .iter()
        .position(|&t| t == commit_type)
        .unwrap_or(TYPE_ORDER.len())
}

/// Internal struct to hold parsed commit info with type.
struct ParsedCommitInfo {
    commit: ChangelogCommit,
    commit_type: String,
}

/// Resolve a reference (tag, branch, or commit) to an Oid.
fn resolve_ref(repo: &Repository, reference: &str) -> Result<Oid, ChangelogError> {
    // Try as tag first
    if let Ok(tag_ref) = repo.find_reference(&format!("refs/tags/{}", reference)) {
        if let Some(target) = tag_ref.target() {
            // Could be annotated tag, need to peel
            if let Ok(obj) = repo.find_object(target, None) {
                if let Ok(commit) = obj.peel_to_commit() {
                    return Ok(commit.id());
                }
            }
            return Ok(target);
        }
    }

    // Try as branch
    if let Ok(branch_ref) = repo.find_reference(&format!("refs/heads/{}", reference)) {
        if let Some(target) = branch_ref.target() {
            return Ok(target);
        }
    }

    // Try as direct commit OID
    if let Ok(oid) = Oid::from_str(reference) {
        return Ok(oid);
    }

    // Try revparse
    if let Ok(obj) = repo.revparse_single(reference) {
        if let Ok(commit) = obj.peel_to_commit() {
            return Ok(commit.id());
        }
    }

    Err(ChangelogError::GitError(format!(
        "Could not resolve reference: {}",
        reference
    )))
}

/// Get commits in a range, parsing conventional commit format.
fn get_commits_in_range(
    repo: &Repository,
    from: Option<&str>,
    to: Option<&str>,
) -> Result<Vec<ParsedCommitInfo>, ChangelogError> {
    let mut revwalk = repo.revwalk()?;

    // Set the starting point
    let to_oid = if let Some(to_ref) = to {
        resolve_ref(repo, to_ref)?
    } else {
        repo.head()?.peel_to_commit()?.id()
    };

    revwalk.push(to_oid)?;
    revwalk.set_sorting(Sort::TIME)?;

    // Resolve the 'from' reference if provided
    let from_oid = from.map(|f| resolve_ref(repo, f)).transpose()?;

    let mut commits = Vec::new();
    let mut count = 0;
    const MAX_COMMITS: usize = 500;

    for oid_result in revwalk {
        let oid = oid_result?;

        // Stop if we've reached the 'from' commit
        if let Some(from_id) = from_oid {
            if oid == from_id {
                break;
            }
        }

        // Safety limit
        count += 1;
        if count > MAX_COMMITS {
            break;
        }

        let commit = repo.find_commit(oid)?;
        let message = commit.message().unwrap_or("");

        // Try to parse as conventional commit
        if let Ok(conv) = git_conventional::Commit::parse(message) {
            let author = commit.author();
            let time = author.when();
            let datetime: DateTime<Utc> = Utc
                .timestamp_opt(time.seconds(), 0)
                .single()
                .unwrap_or_else(Utc::now);

            let parsed = ParsedCommitInfo {
                commit: ChangelogCommit {
                    hash: format!("{:.7}", oid),
                    scope: conv.scope().map(|s| s.to_string()),
                    description: conv.description().to_string(),
                    breaking: conv.breaking(),
                    author: author.name().unwrap_or("Unknown").to_string(),
                    date: datetime.format("%Y-%m-%d").to_string(),
                },
                commit_type: conv.type_().to_string(),
            };
            commits.push(parsed);
        }
        // Skip non-conventional commits
    }

    Ok(commits)
}

/// Find the previous tag before the given reference.
///
/// # Arguments
/// * `repo` - The git repository
/// * `current` - The current reference (tag, branch, or commit)
///
/// # Returns
/// The name of the previous tag, if found.
pub fn find_previous_tag(repo: &Repository, current: &str) -> Option<String> {
    let current_oid = resolve_ref(repo, current).ok()?;
    let current_commit = repo.find_commit(current_oid).ok()?;
    let current_time = current_commit.time().seconds();

    let tag_names = repo.tag_names(None).ok()?;
    let mut tags_with_time: Vec<(String, i64)> = Vec::new();

    for name in tag_names.iter().flatten() {
        let ref_name = format!("refs/tags/{}", name);
        if let Ok(reference) = repo.find_reference(&ref_name) {
            if let Some(target) = reference.target() {
                if let Ok(obj) = repo.find_object(target, None) {
                    if let Ok(commit) = obj.peel_to_commit() {
                        let time = commit.time().seconds();
                        if time < current_time {
                            tags_with_time.push((name.to_string(), time));
                        }
                    }
                }
            }
        }
    }

    // Sort by time descending and get the most recent one before current
    tags_with_time.sort_by(|a, b| b.1.cmp(&a.1));
    tags_with_time.first().map(|(name, _)| name.clone())
}

/// Generate a changelog from commit history.
///
/// # Arguments
/// * `repo` - The git repository
/// * `options` - Changelog generation options
///
/// # Returns
/// A `ChangelogOutput` containing the rendered markdown and commit data.
pub fn generate_changelog(
    repo: &Repository,
    options: ChangelogOptions,
) -> Result<ChangelogOutput, ChangelogError> {
    // Get commits in range
    let parsed_commits =
        get_commits_in_range(repo, options.from_ref.as_deref(), options.to_ref.as_deref())?;

    let commit_count = parsed_commits.len() as u32;

    // Group by type
    let mut groups_map: HashMap<String, Vec<ChangelogCommit>> = HashMap::new();

    for parsed in parsed_commits {
        groups_map
            .entry(parsed.commit_type)
            .or_default()
            .push(parsed.commit);
    }

    // Convert to groups and sort
    let mut groups: Vec<CommitGroup> = groups_map
        .into_iter()
        .map(|(commit_type, commits)| CommitGroup {
            title: get_type_title(&commit_type).to_string(),
            commit_type,
            commits,
        })
        .collect();

    groups.sort_by_key(|g| get_type_order(&g.commit_type));

    // Render template
    let mut tera = Tera::default();
    let template_name = "changelog";
    let template = if options.version.is_some() || options.date.is_some() {
        VERSIONED_TEMPLATE
    } else {
        DEFAULT_TEMPLATE
    };

    tera.add_raw_template(template_name, template)?;

    let mut context = Context::new();
    context.insert("groups", &groups);
    if let Some(version) = &options.version {
        context.insert("version", version);
    }
    if let Some(date) = &options.date {
        context.insert("date", date);
    }

    let markdown = tera.render(template_name, &context)?;

    Ok(ChangelogOutput {
        markdown,
        commit_count,
        groups,
    })
}

// ============================================================================
// IPC Commands
// ============================================================================

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;
use tauri::State;

/// Generate a changelog from commit history.
///
/// Generates markdown changelog grouped by commit type.
#[tauri::command]
#[specta::specta]
pub async fn generate_changelog_cmd(
    state: State<'_, RepositoryState>,
    from_ref: Option<String>,
    to_ref: Option<String>,
    version: Option<String>,
) -> Result<ChangelogOutput, GitError> {
    let path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&path)?;

        let options = ChangelogOptions {
            from_ref,
            to_ref,
            include_unreleased: true,
            group_by_scope: false,
            version,
            date: Some(chrono::Local::now().format("%Y-%m-%d").to_string()),
        };

        generate_changelog(&repo, options).map_err(|e| match e {
            ChangelogError::GitError(msg) => GitError::OperationFailed(msg),
            ChangelogError::ParseError(msg) => GitError::OperationFailed(msg),
            ChangelogError::TemplateError(msg) => GitError::Internal(msg),
        })
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_type_order() {
        assert_eq!(get_type_order("feat"), 0);
        assert_eq!(get_type_order("fix"), 1);
        assert_eq!(get_type_order("chore"), 7);
        assert!(get_type_order("unknown") > get_type_order("build"));
    }

    #[test]
    fn test_type_titles() {
        assert_eq!(get_type_title("feat"), "Features");
        assert_eq!(get_type_title("fix"), "Bug Fixes");
        assert_eq!(get_type_title("perf"), "Performance Improvements");
        assert_eq!(get_type_title("unknown"), "Other Changes");
    }

    #[test]
    fn test_changelog_options_default() {
        let options = ChangelogOptions::default();
        assert!(options.from_ref.is_none());
        assert!(options.to_ref.is_none());
        assert!(options.include_unreleased);
        assert!(!options.group_by_scope);
    }

    #[test]
    fn test_group_sorting() {
        let commits = vec![ChangelogCommit {
            hash: "abc1234".to_string(),
            scope: Some("api".to_string()),
            description: "add endpoint".to_string(),
            breaking: false,
            author: "Dev".to_string(),
            date: "2024-01-01".to_string(),
        }];

        // Create groups manually to test sorting
        let mut groups = vec![
            CommitGroup {
                commit_type: "chore".to_string(),
                title: "Chores".to_string(),
                commits: commits.clone(),
            },
            CommitGroup {
                commit_type: "feat".to_string(),
                title: "Features".to_string(),
                commits: commits.clone(),
            },
            CommitGroup {
                commit_type: "fix".to_string(),
                title: "Bug Fixes".to_string(),
                commits,
            },
        ];

        groups.sort_by_key(|g| get_type_order(&g.commit_type));

        assert_eq!(groups[0].commit_type, "feat");
        assert_eq!(groups[1].commit_type, "fix");
        assert_eq!(groups[2].commit_type, "chore");
    }

    #[test]
    fn test_breaking_change_in_commit() {
        let commit = ChangelogCommit {
            hash: "abc1234".to_string(),
            scope: Some("api".to_string()),
            description: "change response format".to_string(),
            breaking: true,
            author: "Dev".to_string(),
            date: "2024-01-01".to_string(),
        };

        assert!(commit.breaking);
    }

    #[test]
    fn test_template_rendering() {
        let groups = vec![CommitGroup {
            commit_type: "feat".to_string(),
            title: "Features".to_string(),
            commits: vec![ChangelogCommit {
                hash: "abc1234".to_string(),
                scope: Some("api".to_string()),
                description: "add new endpoint".to_string(),
                breaking: false,
                author: "Dev".to_string(),
                date: "2024-01-01".to_string(),
            }],
        }];

        let mut tera = Tera::default();
        tera.add_raw_template("changelog", DEFAULT_TEMPLATE)
            .unwrap();

        let mut context = Context::new();
        context.insert("groups", &groups);

        let result = tera.render("changelog", &context).unwrap();
        assert!(result.contains("# Changelog"));
        assert!(result.contains("## Features"));
        assert!(result.contains("**api:**"));
        assert!(result.contains("add new endpoint"));
    }

    #[test]
    fn test_versioned_template_rendering() {
        let groups = vec![CommitGroup {
            commit_type: "fix".to_string(),
            title: "Bug Fixes".to_string(),
            commits: vec![ChangelogCommit {
                hash: "def5678".to_string(),
                scope: None,
                description: "fix critical bug".to_string(),
                breaking: true,
                author: "Dev".to_string(),
                date: "2024-01-15".to_string(),
            }],
        }];

        let mut tera = Tera::default();
        tera.add_raw_template("changelog", VERSIONED_TEMPLATE)
            .unwrap();

        let mut context = Context::new();
        context.insert("groups", &groups);
        context.insert("version", "v1.0.0");
        context.insert("date", "2024-01-15");

        let result = tera.render("changelog", &context).unwrap();
        assert!(result.contains("## v1.0.0 (2024-01-15)"));
        assert!(result.contains("### Bug Fixes"));
        assert!(result.contains("**BREAKING**"));
    }
}
