use serde::{Deserialize, Serialize};
use specta::Type;

// ---------------------------------------------------------------------------
// Internal deserialization types for GitHub REST API responses
// These map directly to GitHub's JSON schema (snake_case).
// They are NOT exposed via IPC -- no Type derive, no Serialize.
// ---------------------------------------------------------------------------

/// Minimal user reference from GitHub API.
#[derive(Debug, Deserialize)]
pub struct GitHubUserRef {
    pub login: String,
    pub avatar_url: String,
}

/// Label as returned by GitHub API.
#[derive(Debug, Deserialize)]
pub struct GitHubLabel {
    pub id: u64,
    pub name: String,
    pub color: String,
    pub description: Option<String>,
}

/// Branch reference (head/base) on a pull request.
#[derive(Debug, Deserialize)]
pub struct GitHubBranchRef {
    #[serde(rename = "ref")]
    pub ref_name: String,
    pub sha: String,
}

/// Milestone as returned by GitHub API.
#[derive(Debug, Deserialize)]
pub struct GitHubMilestone {
    pub number: u32,
    pub title: String,
    pub state: String,
}

/// Full pull request as returned by GitHub API.
#[derive(Debug, Deserialize)]
pub struct GitHubPullRequest {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub draft: Option<bool>,
    pub user: GitHubUserRef,
    pub head: GitHubBranchRef,
    pub base: GitHubBranchRef,
    pub labels: Vec<GitHubLabel>,
    pub created_at: String,
    pub updated_at: String,
    pub merged_at: Option<String>,
    pub body: Option<String>,
    pub comments: Option<u32>,
    pub review_comments: Option<u32>,
    pub commits: Option<u32>,
    pub additions: Option<u32>,
    pub deletions: Option<u32>,
    pub changed_files: Option<u32>,
    pub html_url: String,
}

/// Issue as returned by GitHub API. The `pull_request` field is present
/// when the issue is actually a PR -- used to filter PRs from issue lists.
#[derive(Debug, Deserialize)]
pub struct GitHubIssue {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub user: GitHubUserRef,
    pub labels: Vec<GitHubLabel>,
    pub assignees: Vec<GitHubUserRef>,
    pub milestone: Option<GitHubMilestone>,
    pub created_at: String,
    pub updated_at: String,
    pub closed_at: Option<String>,
    pub body: Option<String>,
    pub comments: u32,
    pub html_url: String,
    pub pull_request: Option<serde_json::Value>,
}

/// Comment on a PR or issue.
#[derive(Debug, Deserialize)]
pub struct GitHubComment {
    pub id: u64,
    pub user: GitHubUserRef,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
}

// ---------------------------------------------------------------------------
// IPC types -- sent across the Tauri command boundary to the frontend.
// All use camelCase serialization and derive specta::Type for binding gen.
// ---------------------------------------------------------------------------

/// Summary of a pull request for list views.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestSummary {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub draft: bool,
    pub merged: bool,
    pub author_login: String,
    pub author_avatar_url: String,
    pub head_ref: String,
    pub base_ref: String,
    pub labels: Vec<LabelInfo>,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
    pub comment_count: u32,
}

/// Full pull request detail with body, stats, and comments.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestDetail {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub draft: bool,
    pub merged: bool,
    pub author_login: String,
    pub author_avatar_url: String,
    pub head_ref: String,
    pub head_sha: String,
    pub base_ref: String,
    pub labels: Vec<LabelInfo>,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
    pub comment_count: u32,
    pub review_comment_count: u32,
    pub commits: u32,
    pub additions: u32,
    pub deletions: u32,
    pub changed_files: u32,
    pub comments: Vec<CommentInfo>,
}

/// Summary of an issue for list views.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IssueSummary {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub author_login: String,
    pub author_avatar_url: String,
    pub labels: Vec<LabelInfo>,
    pub assignee_logins: Vec<String>,
    pub milestone_title: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
    pub comment_count: u32,
}

/// Full issue detail with body, assignees, milestone, and comments.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IssueDetail {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub author_login: String,
    pub author_avatar_url: String,
    pub labels: Vec<LabelInfo>,
    pub assignees: Vec<UserInfo>,
    pub milestone: Option<MilestoneInfo>,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub closed_at: Option<String>,
    pub html_url: String,
    pub comment_count: u32,
    pub comments: Vec<CommentInfo>,
}

/// Label info for frontend display.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LabelInfo {
    pub name: String,
    pub color: String,
    pub description: Option<String>,
}

/// Minimal user info for frontend display.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UserInfo {
    pub login: String,
    pub avatar_url: String,
}

/// Milestone info for frontend display.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MilestoneInfo {
    pub number: u32,
    pub title: String,
    pub state: String,
}

/// Comment info for frontend display.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommentInfo {
    pub id: u64,
    pub author_login: String,
    pub author_avatar_url: String,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
}

/// Paginated list of pull request summaries.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestListResponse {
    pub items: Vec<PullRequestSummary>,
    pub has_next_page: bool,
    pub next_page: Option<u32>,
}

/// Paginated list of issue summaries.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IssueListResponse {
    pub items: Vec<IssueSummary>,
    pub has_next_page: bool,
    pub next_page: Option<u32>,
}

/// Response from GitHub's device code endpoint.
/// Returned to the frontend so it can display the user_code
/// and verification_uri to the user.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFlowResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u32,
    pub interval: u32,
}

/// Result of an authentication check or successful auth flow.
/// NEVER contains the actual token -- only metadata about the
/// authenticated user. The token stays in Rust/keychain.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AuthResult {
    pub authenticated: bool,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub scopes: Vec<String>,
}

/// Internal struct for deserializing GitHub /user API response.
/// Not exposed to the frontend (no Type derive).
#[derive(Debug, Deserialize)]
pub struct GitHubUser {
    pub login: String,
    pub avatar_url: String,
    pub name: Option<String>,
}

/// Rate limit information from the GitHub API.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitInfo {
    pub limit: u32,
    pub remaining: u32,
    pub reset: u32,
    pub used: u32,
}

/// Information about a detected GitHub remote in the current repository.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRemoteInfo {
    pub remote_name: String,
    pub owner: String,
    pub repo: String,
    pub url: String,
}
