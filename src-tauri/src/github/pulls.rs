//! GitHub Pull Request read operations.
//!
//! Provides Tauri commands for listing and fetching pull requests
//! from the GitHub REST API. Uses the shared client helpers for
//! authenticated requests and pagination.

use super::client;
use super::error::GitHubError;
use super::types::{
    CommentInfo, GitHubComment, GitHubPullRequest, LabelInfo, PullRequestDetail,
    PullRequestListResponse, PullRequestSummary,
};

/// List pull requests for a repository with pagination.
///
/// Returns a paginated list of pull request summaries sorted by
/// most recently updated. The `state` parameter can be "open",
/// "closed", or "all".
#[tauri::command]
#[specta::specta]
pub async fn github_list_pull_requests(
    owner: String,
    repo: String,
    state: String,
    page: u32,
    per_page: u32,
) -> Result<PullRequestListResponse, GitHubError> {
    let path = format!("/repos/{}/{}/pulls", owner, repo);
    let page_str = page.to_string();
    let per_page_str = per_page.to_string();
    let params = [
        ("state", state.as_str()),
        ("page", &page_str),
        ("per_page", &per_page_str),
        ("sort", "updated"),
        ("direction", "desc"),
    ];

    let resp = client::github_get_with_params(&path, &params).await?;

    // Extract Link header before consuming the response body
    let link_header = resp
        .headers()
        .get("link")
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    let prs: Vec<GitHubPullRequest> = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse PR list: {}", e)))?;

    let items: Vec<PullRequestSummary> = prs
        .into_iter()
        .map(|pr| PullRequestSummary {
            number: pr.number,
            title: pr.title,
            state: pr.state,
            draft: pr.draft.unwrap_or(false),
            merged: pr.merged_at.is_some(),
            author_login: pr.user.login,
            author_avatar_url: pr.user.avatar_url,
            head_ref: pr.head.ref_name,
            base_ref: pr.base.ref_name,
            labels: pr
                .labels
                .into_iter()
                .map(|l| LabelInfo {
                    name: l.name,
                    color: l.color,
                    description: l.description,
                })
                .collect(),
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            html_url: pr.html_url,
            comment_count: pr.comments.unwrap_or(0),
        })
        .collect();

    let (has_next_page, next_page) = match &link_header {
        Some(header) => {
            let next = client::parse_next_page(header);
            (next.is_some(), next)
        }
        None => (false, None),
    };

    Ok(PullRequestListResponse {
        items,
        has_next_page,
        next_page,
    })
}

/// Fetch full details for a single pull request including comments.
///
/// Makes two API calls: one for the PR detail and one for
/// the issue comments (which includes general discussion comments).
#[tauri::command]
#[specta::specta]
pub async fn github_get_pull_request(
    owner: String,
    repo: String,
    number: u32,
) -> Result<PullRequestDetail, GitHubError> {
    // Fetch PR detail
    let pr_path = format!("/repos/{}/{}/pulls/{}", owner, repo, number);
    let pr_resp = client::github_get(&pr_path).await?;
    let pr: GitHubPullRequest = pr_resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse PR detail: {}", e)))?;

    // Fetch comments via issues endpoint (general discussion comments)
    let comments_path = format!("/repos/{}/{}/issues/{}/comments", owner, repo, number);
    let comments_resp = client::github_get(&comments_path).await?;
    let raw_comments: Vec<GitHubComment> = comments_resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse PR comments: {}", e)))?;

    let comments: Vec<CommentInfo> = raw_comments
        .into_iter()
        .map(|c| CommentInfo {
            id: c.id,
            author_login: c.user.login,
            author_avatar_url: c.user.avatar_url,
            body: c.body,
            created_at: c.created_at,
            updated_at: c.updated_at,
            html_url: c.html_url,
        })
        .collect();

    Ok(PullRequestDetail {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        draft: pr.draft.unwrap_or(false),
        merged: pr.merged_at.is_some(),
        author_login: pr.user.login,
        author_avatar_url: pr.user.avatar_url,
        head_ref: pr.head.ref_name,
        head_sha: pr.head.sha,
        base_ref: pr.base.ref_name,
        labels: pr
            .labels
            .into_iter()
            .map(|l| LabelInfo {
                name: l.name,
                color: l.color,
                description: l.description,
            })
            .collect(),
        body: pr.body.unwrap_or_default(),
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        html_url: pr.html_url,
        comment_count: pr.comments.unwrap_or(0),
        review_comment_count: pr.review_comments.unwrap_or(0),
        commits: pr.commits.unwrap_or(0),
        additions: pr.additions.unwrap_or(0),
        deletions: pr.deletions.unwrap_or(0),
        changed_files: pr.changed_files.unwrap_or(0),
        comments,
    })
}
