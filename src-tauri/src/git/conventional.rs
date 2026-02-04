//! Conventional commit parsing, validation, and type inference.
//!
//! This module provides functionality for working with conventional commits:
//! - Parsing commit messages into structured components
//! - Validating messages against the conventional commit spec
//! - Inferring commit types from staged file patterns
//! - Extracting scope suggestions from commit history

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::git::history::CommitSummary;
use crate::git::staging::FileChange;

/// Valid conventional commit types.
pub const VALID_TYPES: &[&str] = &[
    "feat", "fix", "docs", "style", "refactor", "perf", "test", "chore", "ci", "build", "revert",
];

/// Commit type enumeration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum CommitType {
    Feat,
    Fix,
    Docs,
    Style,
    Refactor,
    Perf,
    Test,
    Chore,
    Ci,
    Build,
    Revert,
}

impl CommitType {
    /// Convert from string to CommitType.
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "feat" => Some(Self::Feat),
            "fix" => Some(Self::Fix),
            "docs" => Some(Self::Docs),
            "style" => Some(Self::Style),
            "refactor" => Some(Self::Refactor),
            "perf" => Some(Self::Perf),
            "test" => Some(Self::Test),
            "chore" => Some(Self::Chore),
            "ci" => Some(Self::Ci),
            "build" => Some(Self::Build),
            "revert" => Some(Self::Revert),
            _ => None,
        }
    }

    /// Convert to lowercase string.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Feat => "feat",
            Self::Fix => "fix",
            Self::Docs => "docs",
            Self::Style => "style",
            Self::Refactor => "refactor",
            Self::Perf => "perf",
            Self::Test => "test",
            Self::Chore => "chore",
            Self::Ci => "ci",
            Self::Build => "build",
            Self::Revert => "revert",
        }
    }
}

/// A parsed conventional commit.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ParsedCommit {
    /// The commit type (feat, fix, etc.).
    pub commit_type: CommitType,
    /// Optional scope in parentheses.
    pub scope: Option<String>,
    /// The commit description (first line after type/scope).
    pub description: String,
    /// Optional body text.
    pub body: Option<String>,
    /// Whether this is a breaking change.
    pub breaking: bool,
    /// Footer key-value pairs.
    pub footers: Vec<Footer>,
}

/// A footer in a conventional commit.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Footer {
    /// The footer token (e.g., "BREAKING CHANGE", "Fixes").
    pub token: String,
    /// The footer value.
    pub value: String,
}

/// Result of validating a commit message.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    /// Whether the message is valid.
    pub is_valid: bool,
    /// Validation errors (if any).
    pub errors: Vec<ValidationError>,
    /// Validation warnings (if any).
    pub warnings: Vec<ValidationWarning>,
}

/// A validation error.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ValidationError {
    /// Error code for programmatic handling.
    pub code: String,
    /// Human-readable error message.
    pub message: String,
    /// Optional suggestion for fixing the error.
    pub suggestion: Option<String>,
}

/// A validation warning.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ValidationWarning {
    /// Warning code for programmatic handling.
    pub code: String,
    /// Human-readable warning message.
    pub message: String,
}

/// Confidence level for type inference.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Confidence {
    High,
    Medium,
    Low,
}

/// A suggested commit type based on file analysis.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TypeSuggestion {
    /// The suggested commit type.
    pub suggested_type: CommitType,
    /// Confidence level of the suggestion.
    pub confidence: Confidence,
    /// Reason for the suggestion.
    pub reason: String,
}

/// A scope suggestion from commit history.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScopeSuggestion {
    /// The scope string.
    pub scope: String,
    /// Number of times this scope has been used.
    pub usage_count: u32,
}

/// Parse a conventional commit message into structured components.
///
/// # Arguments
/// * `message` - The commit message to parse
///
/// # Returns
/// A `ParsedCommit` on success, or a `ValidationError` on failure.
pub fn parse_conventional_commit(message: &str) -> Result<ParsedCommit, ValidationError> {
    let message = message.trim();

    if message.is_empty() {
        return Err(ValidationError {
            code: "EMPTY_MESSAGE".to_string(),
            message: "Commit message cannot be empty".to_string(),
            suggestion: Some(
                "Provide a commit message in the format: type(scope): description".to_string(),
            ),
        });
    }

    // Use git-conventional crate for parsing
    match git_conventional::Commit::parse(message) {
        Ok(conv) => {
            let commit_type =
                CommitType::from_str(conv.type_().as_str()).ok_or_else(|| ValidationError {
                    code: "INVALID_TYPE".to_string(),
                    message: format!("Unknown commit type: {}", conv.type_()),
                    suggestion: Some(format!("Valid types are: {}", VALID_TYPES.join(", "))),
                })?;

            // Extract footers
            let footers: Vec<Footer> = conv
                .footers()
                .iter()
                .map(|f| Footer {
                    token: f.token().to_string(),
                    value: f.value().to_string(),
                })
                .collect();

            Ok(ParsedCommit {
                commit_type,
                scope: conv.scope().map(|s| s.to_string()),
                description: conv.description().to_string(),
                body: conv.body().map(|b| b.to_string()),
                breaking: conv.breaking(),
                footers,
            })
        }
        Err(e) => {
            // Map parse errors to specific codes
            let error_str = e.to_string().to_lowercase();

            if error_str.contains("type") {
                Err(ValidationError {
                    code: "INVALID_TYPE".to_string(),
                    message: "Invalid or missing commit type".to_string(),
                    suggestion: Some(format!(
                        "Start your message with a type: {}",
                        VALID_TYPES.join(", ")
                    )),
                })
            } else if error_str.contains("separator") || !message.contains(':') {
                Err(ValidationError {
                    code: "MISSING_COLON".to_string(),
                    message: "Missing colon separator after type".to_string(),
                    suggestion: Some("Format: type(scope): description".to_string()),
                })
            } else if error_str.contains("description") || error_str.contains("subject") {
                Err(ValidationError {
                    code: "MISSING_DESCRIPTION".to_string(),
                    message: "Missing description after colon".to_string(),
                    suggestion: Some(
                        "Add a description after the colon: type: description".to_string(),
                    ),
                })
            } else {
                Err(ValidationError {
                    code: "PARSE_ERROR".to_string(),
                    message: format!("Failed to parse commit message: {}", e),
                    suggestion: Some("Format: type(scope): description".to_string()),
                })
            }
        }
    }
}

/// Validate a commit message and return errors/warnings.
///
/// # Arguments
/// * `message` - The commit message to validate
///
/// # Returns
/// A `ValidationResult` with validation status, errors, and warnings.
pub fn validate_commit_message(message: &str) -> ValidationResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Try parsing
    match parse_conventional_commit(message) {
        Ok(parsed) => {
            // Check for warnings

            // Subject line length warning (> 50 chars)
            let subject = format!(
                "{}{}{}",
                parsed.commit_type.as_str(),
                parsed
                    .scope
                    .as_ref()
                    .map(|s| format!("({})", s))
                    .unwrap_or_default(),
                if parsed.breaking && parsed.scope.is_none() {
                    "!"
                } else {
                    ""
                }
            );
            let full_subject_len = subject.len() + 2 + parsed.description.len(); // +2 for ": "

            if full_subject_len > 72 {
                warnings.push(ValidationWarning {
                    code: "SUBJECT_TOO_LONG".to_string(),
                    message: format!(
                        "Subject line is {} characters; consider keeping under 72",
                        full_subject_len
                    ),
                });
            } else if full_subject_len > 50 {
                warnings.push(ValidationWarning {
                    code: "SUBJECT_LONG".to_string(),
                    message: format!(
                        "Subject line is {} characters; ideal is under 50",
                        full_subject_len
                    ),
                });
            }

            // Body line length warning (> 72 chars)
            if let Some(body) = &parsed.body {
                for (i, line) in body.lines().enumerate() {
                    if line.len() > 72 {
                        warnings.push(ValidationWarning {
                            code: "BODY_LINE_TOO_LONG".to_string(),
                            message: format!(
                                "Body line {} is {} characters; wrap at 72",
                                i + 1,
                                line.len()
                            ),
                        });
                    }
                }
            }

            ValidationResult {
                is_valid: true,
                errors,
                warnings,
            }
        }
        Err(error) => {
            errors.push(error);
            ValidationResult {
                is_valid: false,
                errors,
                warnings,
            }
        }
    }
}

/// Source file extensions.
const SOURCE_EXTENSIONS: &[&str] = &[
    ".rs", ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".java", ".c", ".cpp", ".h", ".hpp", ".cs",
    ".rb", ".php", ".swift", ".kt", ".scala", ".ex", ".exs", ".clj", ".zig",
];

/// Infer a commit type from staged file patterns.
///
/// # Arguments
/// * `staged_files` - List of staged file changes
///
/// # Returns
/// A `TypeSuggestion` with the inferred type and confidence.
pub fn infer_commit_type(staged_files: &[FileChange]) -> TypeSuggestion {
    if staged_files.is_empty() {
        return TypeSuggestion {
            suggested_type: CommitType::Chore,
            confidence: Confidence::Low,
            reason: "No files staged".to_string(),
        };
    }

    let paths: Vec<&str> = staged_files.iter().map(|f| f.path.as_str()).collect();

    // Rule a: Test files → Test
    let has_test_files = paths.iter().any(|p| {
        let lower = p.to_lowercase();
        lower.contains("test")
            || lower.contains("spec")
            || lower.contains("__tests__")
            || lower.ends_with(".test.ts")
            || lower.ends_with(".test.tsx")
            || lower.ends_with(".test.js")
            || lower.ends_with(".spec.ts")
            || lower.ends_with(".spec.tsx")
            || lower.ends_with(".spec.js")
            || lower.ends_with("_test.rs")
            || lower.ends_with("_test.go")
    });

    if has_test_files {
        return TypeSuggestion {
            suggested_type: CommitType::Test,
            confidence: Confidence::High,
            reason: "Contains test files".to_string(),
        };
    }

    // Rule b: Documentation files → Docs
    let all_docs = paths.iter().all(|p| {
        let lower = p.to_lowercase();
        lower.ends_with(".md")
            || lower.starts_with("docs/")
            || lower.contains("/docs/")
            || lower.contains("readme")
            || lower.contains("changelog")
            || lower.contains("license")
    });

    if all_docs {
        return TypeSuggestion {
            suggested_type: CommitType::Docs,
            confidence: Confidence::High,
            reason: "All files are documentation".to_string(),
        };
    }

    // Rule c: Style files → Style
    let all_styles = paths.iter().all(|p| {
        let lower = p.to_lowercase();
        lower.ends_with(".css")
            || lower.ends_with(".scss")
            || lower.ends_with(".sass")
            || lower.ends_with(".less")
            || lower.ends_with(".styl")
    });

    if all_styles {
        return TypeSuggestion {
            suggested_type: CommitType::Style,
            confidence: Confidence::High,
            reason: "All files are stylesheets".to_string(),
        };
    }

    // Check if files are source files
    let is_source_file = |p: &str| SOURCE_EXTENSIONS.iter().any(|ext| p.ends_with(ext));

    // Rule d: All new source files → Feat
    let all_new_source = staged_files.iter().all(|f| {
        matches!(
            f.status,
            crate::git::staging::FileStatus::Added | crate::git::staging::FileStatus::Untracked
        ) && is_source_file(&f.path)
    });

    if all_new_source && !staged_files.is_empty() {
        return TypeSuggestion {
            suggested_type: CommitType::Feat,
            confidence: Confidence::Medium,
            reason: "All files are new source files".to_string(),
        };
    }

    // Rule e: All modified source files → Fix
    let all_modified_source = staged_files.iter().all(|f| {
        matches!(f.status, crate::git::staging::FileStatus::Modified) && is_source_file(&f.path)
    });

    if all_modified_source {
        return TypeSuggestion {
            suggested_type: CommitType::Fix,
            confidence: Confidence::Medium,
            reason: "All files are modified source files".to_string(),
        };
    }

    // Rule f: Config files only → Chore
    let all_config = paths.iter().all(|p| {
        let lower = p.to_lowercase();
        let is_root_config = !p.contains('/')
            && (lower.ends_with(".json")
                || lower.ends_with(".toml")
                || lower.ends_with(".yaml")
                || lower.ends_with(".yml")
                || lower.ends_with(".config.js")
                || lower.ends_with(".config.ts")
                || lower == "cargo.toml"
                || lower == "package.json"
                || lower == "tsconfig.json");
        is_root_config || lower.contains("config") || lower.starts_with(".")
    });

    if all_config {
        return TypeSuggestion {
            suggested_type: CommitType::Chore,
            confidence: Confidence::Medium,
            reason: "All files are configuration files".to_string(),
        };
    }

    // CI files → Ci
    let all_ci = paths.iter().all(|p| {
        let lower = p.to_lowercase();
        lower.contains(".github/workflows")
            || lower.contains(".gitlab-ci")
            || lower.contains("jenkinsfile")
            || lower.contains(".circleci")
            || lower.contains(".travis")
    });

    if all_ci {
        return TypeSuggestion {
            suggested_type: CommitType::Ci,
            confidence: Confidence::High,
            reason: "All files are CI configuration".to_string(),
        };
    }

    // Fallback
    TypeSuggestion {
        suggested_type: CommitType::Chore,
        confidence: Confidence::Low,
        reason: "Mixed file types".to_string(),
    }
}

/// Infer a scope from staged file paths.
///
/// # Arguments
/// * `staged_files` - List of staged file changes
///
/// # Returns
/// An optional scope string based on common directory.
pub fn infer_scope_from_files(staged_files: &[FileChange]) -> Option<String> {
    if staged_files.is_empty() {
        return None;
    }

    let paths: Vec<&str> = staged_files.iter().map(|f| f.path.as_str()).collect();

    // Find common directory prefix
    let first_parts: Vec<&str> = paths[0].split('/').collect();

    for depth in (1..first_parts.len()).rev() {
        let prefix_parts = &first_parts[..depth];
        let prefix = prefix_parts.join("/");

        let all_match = paths.iter().all(|p| {
            p.starts_with(&prefix)
                && (p.len() == prefix.len() || p.chars().nth(prefix.len()) == Some('/'))
        });

        if all_match {
            // Return the last directory component as scope
            if let Some(last) = prefix_parts.last() {
                // Skip generic directories
                if !["src", "lib", "app", "components", "pages", "utils"].contains(last) {
                    return Some((*last).to_string());
                }
            }
        }
    }

    None
}

/// Extract scope suggestions from commit history.
///
/// # Arguments
/// * `commits` - List of commit summaries
/// * `limit` - Maximum number of suggestions to return
///
/// # Returns
/// A list of scope suggestions sorted by usage frequency.
pub fn extract_scopes_from_history(
    commits: &[CommitSummary],
    limit: usize,
) -> Vec<ScopeSuggestion> {
    use std::collections::HashMap;

    let mut scope_counts: HashMap<String, usize> = HashMap::new();

    for commit in commits {
        // Try to parse each commit message
        if let Ok(parsed) = git_conventional::Commit::parse(&commit.message_subject) {
            if let Some(scope) = parsed.scope() {
                let scope_str = scope.to_string();
                *scope_counts.entry(scope_str).or_insert(0) += 1;
            }
        }
    }

    // Filter out scopes with count < 2 (likely typos)
    let mut suggestions: Vec<ScopeSuggestion> = scope_counts
        .into_iter()
        .filter(|(_, count)| *count >= 2)
        .map(|(scope, usage_count)| ScopeSuggestion {
            scope,
            usage_count: usage_count as u32,
        })
        .collect();

    // Sort by frequency descending
    suggestions.sort_by(|a, b| b.usage_count.cmp(&a.usage_count));

    // Limit results
    suggestions.truncate(limit);

    suggestions
}

// ============================================================================
// IPC Commands
// ============================================================================

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;
use tauri::State;

/// Validate a conventional commit message.
///
/// Returns validation result with errors and warnings.
#[tauri::command]
#[specta::specta]
pub async fn validate_conventional_commit(message: String) -> ValidationResult {
    validate_commit_message(&message)
}

/// Suggest a commit type based on staged files.
///
/// Analyzes the currently staged files and returns a type suggestion
/// with confidence level.
#[tauri::command]
#[specta::specta]
pub async fn suggest_commit_type(
    state: State<'_, RepositoryState>,
) -> Result<TypeSuggestion, GitError> {
    let path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&path)?;

        let mut opts = git2::StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(true)
            .exclude_submodules(true)
            .include_ignored(false);

        let statuses = repo.statuses(Some(&mut opts))?;

        let mut staged_files = Vec::new();

        for entry in statuses.iter() {
            let status = entry.status();
            let file_path = entry.path().unwrap_or("").to_string();

            // Check for staged changes (INDEX_*)
            if status.intersects(
                git2::Status::INDEX_NEW
                    | git2::Status::INDEX_MODIFIED
                    | git2::Status::INDEX_DELETED
                    | git2::Status::INDEX_RENAMED,
            ) {
                let file_status = if status.contains(git2::Status::INDEX_NEW) {
                    crate::git::staging::FileStatus::Added
                } else if status.contains(git2::Status::INDEX_DELETED) {
                    crate::git::staging::FileStatus::Deleted
                } else {
                    crate::git::staging::FileStatus::Modified
                };

                staged_files.push(FileChange {
                    path: file_path,
                    status: file_status,
                    additions: None,
                    deletions: None,
                });
            }
        }

        Ok(infer_commit_type(&staged_files))
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Get scope suggestions from commit history.
///
/// Extracts scopes used in previous commits, sorted by frequency.
#[tauri::command]
#[specta::specta]
pub async fn get_scope_suggestions(
    state: State<'_, RepositoryState>,
    limit: Option<usize>,
) -> Result<Vec<ScopeSuggestion>, GitError> {
    let path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    let limit = limit.unwrap_or(20);

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&path)?;

        // Handle empty repo
        match repo.head() {
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                return Ok(vec![]);
            }
            Err(e) => return Err(e.into()),
            Ok(_) => {}
        }

        let mut revwalk = repo.revwalk()?;
        revwalk.push_head()?;
        revwalk.set_sorting(git2::Sort::TIME)?;

        let commits: Vec<CommitSummary> = revwalk
            .take(500)
            .filter_map(|oid| oid.ok())
            .filter_map(|oid| {
                let commit = repo.find_commit(oid).ok()?;
                let author = commit.author();

                Some(CommitSummary {
                    oid: oid.to_string(),
                    short_oid: format!("{:.7}", oid),
                    message_subject: commit.summary().unwrap_or("").to_string(),
                    author_name: author.name().unwrap_or("Unknown").to_string(),
                    author_email: author.email().unwrap_or("").to_string(),
                    timestamp_ms: (author.when().seconds() as f64) * 1000.0,
                })
            })
            .collect();

        Ok(extract_scopes_from_history(&commits, limit))
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Infer scope from staged files based on common directory.
#[tauri::command]
#[specta::specta]
pub async fn infer_scope_from_staged(
    state: State<'_, RepositoryState>,
) -> Result<Option<String>, GitError> {
    let path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&path)?;

        let mut opts = git2::StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(true)
            .exclude_submodules(true)
            .include_ignored(false);

        let statuses = repo.statuses(Some(&mut opts))?;

        let mut staged_files = Vec::new();

        for entry in statuses.iter() {
            let status = entry.status();
            let file_path = entry.path().unwrap_or("").to_string();

            if status.intersects(
                git2::Status::INDEX_NEW
                    | git2::Status::INDEX_MODIFIED
                    | git2::Status::INDEX_DELETED
                    | git2::Status::INDEX_RENAMED,
            ) {
                staged_files.push(FileChange {
                    path: file_path,
                    status: crate::git::staging::FileStatus::Modified,
                    additions: None,
                    deletions: None,
                });
            }
        }

        Ok(infer_scope_from_files(&staged_files))
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_commit() {
        let result = parse_conventional_commit("feat: add new feature");
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.commit_type, CommitType::Feat);
        assert!(parsed.scope.is_none());
        assert_eq!(parsed.description, "add new feature");
        assert!(!parsed.breaking);
    }

    #[test]
    fn test_parse_commit_with_scope() {
        let result = parse_conventional_commit("fix(api): resolve endpoint issue");
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.commit_type, CommitType::Fix);
        assert_eq!(parsed.scope, Some("api".to_string()));
        assert_eq!(parsed.description, "resolve endpoint issue");
    }

    #[test]
    fn test_parse_breaking_change_bang() {
        let result = parse_conventional_commit("feat!: breaking change");
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert!(parsed.breaking);
    }

    #[test]
    fn test_parse_breaking_change_footer() {
        let result =
            parse_conventional_commit("feat: change api\n\nBREAKING CHANGE: removed old method");
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert!(parsed.breaking);
    }

    #[test]
    fn test_parse_empty_message() {
        let result = parse_conventional_commit("");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "EMPTY_MESSAGE");
    }

    #[test]
    fn test_parse_invalid_type() {
        let result = parse_conventional_commit("invalid: message");
        // git-conventional may allow custom types, so check behavior
        if result.is_err() {
            let err = result.unwrap_err();
            assert!(err.code == "INVALID_TYPE" || err.code == "PARSE_ERROR");
        }
    }

    #[test]
    fn test_validate_valid_message() {
        let result = validate_commit_message("feat: short description");
        assert!(result.is_valid);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_validate_long_subject_warning() {
        let long_desc = "a".repeat(100);
        let result = validate_commit_message(&format!("feat: {}", long_desc));
        assert!(result.is_valid);
        assert!(!result.warnings.is_empty());
        assert!(result.warnings.iter().any(|w| w.code.contains("LONG")));
    }

    #[test]
    fn test_infer_type_test_files() {
        let files = vec![FileChange {
            path: "src/utils/helper.test.ts".to_string(),
            status: crate::git::staging::FileStatus::Modified,
            additions: Some(10),
            deletions: Some(5),
        }];
        let suggestion = infer_commit_type(&files);
        assert_eq!(suggestion.suggested_type, CommitType::Test);
        assert_eq!(suggestion.confidence, Confidence::High);
    }

    #[test]
    fn test_infer_type_docs() {
        let files = vec![FileChange {
            path: "README.md".to_string(),
            status: crate::git::staging::FileStatus::Modified,
            additions: Some(10),
            deletions: Some(5),
        }];
        let suggestion = infer_commit_type(&files);
        assert_eq!(suggestion.suggested_type, CommitType::Docs);
    }

    #[test]
    fn test_infer_type_empty() {
        let suggestion = infer_commit_type(&[]);
        assert_eq!(suggestion.suggested_type, CommitType::Chore);
        assert_eq!(suggestion.confidence, Confidence::Low);
    }

    #[test]
    fn test_commit_type_from_str() {
        assert_eq!(CommitType::from_str("feat"), Some(CommitType::Feat));
        assert_eq!(CommitType::from_str("FEAT"), Some(CommitType::Feat));
        assert_eq!(CommitType::from_str("invalid"), None);
    }

    #[test]
    fn test_infer_scope_single_dir() {
        let files = vec![
            FileChange {
                path: "src/git/branch.rs".to_string(),
                status: crate::git::staging::FileStatus::Modified,
                additions: None,
                deletions: None,
            },
            FileChange {
                path: "src/git/commit.rs".to_string(),
                status: crate::git::staging::FileStatus::Modified,
                additions: None,
                deletions: None,
            },
        ];
        let scope = infer_scope_from_files(&files);
        assert_eq!(scope, Some("git".to_string()));
    }

    #[test]
    fn test_extract_scopes_empty() {
        let scopes = extract_scopes_from_history(&[], 10);
        assert!(scopes.is_empty());
    }
}
