//! GitHub Issue read operations.
//!
//! Provides Tauri commands for listing and fetching issues
//! from the GitHub REST API. Filters out pull requests from
//! issue listings since GitHub's issues API returns both.

use super::client;
use super::error::GitHubError;
use super::types::{
    CommentInfo, GitHubComment, GitHubIssue, IssueDetail, IssueListResponse, IssueSummary,
    LabelInfo, MilestoneInfo, UserInfo,
};

/// List issues for a repository with pagination.
///
/// Returns a paginated list of issue summaries sorted by most recently
/// updated. Pull requests are filtered out (GitHub's issues API returns
/// both issues and PRs). The `state` parameter can be "open", "closed",
/// or "all".
#[tauri::command]
#[specta::specta]
pub async fn github_list_issues(
    owner: String,
    repo: String,
    state: String,
    page: u32,
    per_page: u32,
) -> Result<IssueListResponse, GitHubError> {
    let path = format!("/repos/{}/{}/issues", owner, repo);
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

    let mut issues: Vec<GitHubIssue> = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse issue list: {}", e)))?;

    // CRITICAL: Filter out pull requests -- GitHub issues API returns PRs too.
    // PRs have a non-null `pull_request` field in the response.
    issues.retain(|i| i.pull_request.is_none());

    let items: Vec<IssueSummary> = issues
        .into_iter()
        .map(|issue| IssueSummary {
            number: issue.number,
            title: issue.title,
            state: issue.state,
            author_login: issue.user.login,
            author_avatar_url: issue.user.avatar_url,
            labels: issue
                .labels
                .into_iter()
                .map(|l| LabelInfo {
                    name: l.name,
                    color: l.color,
                    description: l.description,
                })
                .collect(),
            assignee_logins: issue.assignees.iter().map(|a| a.login.clone()).collect(),
            milestone_title: issue.milestone.as_ref().map(|m| m.title.clone()),
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            html_url: issue.html_url,
            comment_count: issue.comments,
        })
        .collect();

    let (has_next_page, next_page) = match &link_header {
        Some(header) => {
            let next = client::parse_next_page(header);
            (next.is_some(), next)
        }
        None => (false, None),
    };

    Ok(IssueListResponse {
        items,
        has_next_page,
        next_page,
    })
}

/// Fetch full details for a single issue including comments.
///
/// Makes two API calls: one for the issue detail and one for
/// all comments on the issue.
#[tauri::command]
#[specta::specta]
pub async fn github_get_issue(
    owner: String,
    repo: String,
    number: u32,
) -> Result<IssueDetail, GitHubError> {
    // Fetch issue detail
    let issue_path = format!("/repos/{}/{}/issues/{}", owner, repo, number);
    let issue_resp = client::github_get(&issue_path).await?;
    let issue: GitHubIssue = issue_resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse issue detail: {}", e)))?;

    // Fetch comments
    let comments_path = format!("/repos/{}/{}/issues/{}/comments", owner, repo, number);
    let comments_resp = client::github_get(&comments_path).await?;
    let raw_comments: Vec<GitHubComment> = comments_resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse issue comments: {}", e)))?;

    let comments: Vec<CommentInfo> = raw_comments
        .into_iter()
        .map(|c| CommentInfo {
            id: c.id.to_string(),
            author_login: c.user.login,
            author_avatar_url: c.user.avatar_url,
            body: c.body,
            created_at: c.created_at,
            updated_at: c.updated_at,
            html_url: c.html_url,
        })
        .collect();

    Ok(IssueDetail {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        author_login: issue.user.login,
        author_avatar_url: issue.user.avatar_url,
        labels: issue
            .labels
            .into_iter()
            .map(|l| LabelInfo {
                name: l.name,
                color: l.color,
                description: l.description,
            })
            .collect(),
        assignees: issue
            .assignees
            .into_iter()
            .map(|a| UserInfo {
                login: a.login,
                avatar_url: a.avatar_url,
            })
            .collect(),
        milestone: issue.milestone.map(|m| MilestoneInfo {
            number: m.number,
            title: m.title,
            state: m.state,
        }),
        body: issue.body.unwrap_or_default(),
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
        html_url: issue.html_url,
        comment_count: issue.comments,
        comments,
    })
}
