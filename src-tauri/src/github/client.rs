//! Shared authenticated HTTP client for the GitHub REST API.
//!
//! Provides reusable helpers for making authenticated GET requests,
//! parsing pagination Link headers, and extracting rate limit info.
//! All GitHub API modules (pulls, issues, etc.) use these helpers
//! instead of building their own reqwest clients.

use std::time::Duration;

use serde::Serialize;

use super::error::GitHubError;
use super::token;

/// Make an authenticated GET request to the GitHub REST API.
///
/// Retrieves the OAuth token from the OS keychain, sets required headers,
/// and maps HTTP error statuses to typed `GitHubError` variants.
pub async fn github_get(path: &str) -> Result<reqwest::Response, GitHubError> {
    let access_token = token::get_token().await?;
    let client = reqwest::Client::new();

    let url = format!("https://api.github.com{}", path);
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "FlowForge-Desktop")
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    check_response_status(resp).await
}

/// Make an authenticated GET request with query parameters.
///
/// Same as `github_get` but appends query parameters to the request URL.
/// Constructs the query string manually to avoid reqwest feature dependency.
pub async fn github_get_with_params(
    path: &str,
    params: &[(&str, &str)],
) -> Result<reqwest::Response, GitHubError> {
    let query_string: String = params
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("&");

    let url = if query_string.is_empty() {
        format!("https://api.github.com{}", path)
    } else {
        format!("https://api.github.com{}?{}", path, query_string)
    };

    let access_token = token::get_token().await?;
    let client = reqwest::Client::new();

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "FlowForge-Desktop")
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    check_response_status(resp).await
}

/// Make an authenticated POST request to the GitHub REST API.
///
/// Uses a 30-second timeout (longer than GET) since write operations
/// may take more time to complete on GitHub's side.
pub async fn github_post<T: Serialize>(path: &str, body: &T) -> Result<reqwest::Response, GitHubError> {
    let access_token = token::get_token().await?;
    let client = reqwest::Client::new();

    let url = format!("https://api.github.com{}", path);
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "FlowForge-Desktop")
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(body)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    check_response_status(resp).await
}

/// Make an authenticated PUT request to the GitHub REST API.
///
/// Used for operations like merging pull requests.
pub async fn github_put<T: Serialize>(path: &str, body: &T) -> Result<reqwest::Response, GitHubError> {
    let access_token = token::get_token().await?;
    let client = reqwest::Client::new();

    let url = format!("https://api.github.com{}", path);
    let resp = client
        .put(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "FlowForge-Desktop")
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(body)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    check_response_status(resp).await
}

/// Check the HTTP response status and map errors to GitHubError variants.
async fn check_response_status(resp: reqwest::Response) -> Result<reqwest::Response, GitHubError> {
    let status = resp.status();

    if status.is_success() {
        return Ok(resp);
    }

    match status.as_u16() {
        401 => Err(GitHubError::NotAuthenticated),
        403 => {
            // Check for rate limit exhaustion
            let rate_remaining = resp
                .headers()
                .get("x-ratelimit-remaining")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u32>().ok());

            if rate_remaining == Some(0) {
                Err(GitHubError::RateLimitExceeded(
                    "GitHub API rate limit exceeded".to_string(),
                ))
            } else {
                let body = resp.text().await.unwrap_or_default();
                Err(GitHubError::Forbidden(body))
            }
        }
        404 => {
            let body = resp.text().await.unwrap_or_default();
            Err(GitHubError::NotFound(body))
        }
        405 => {
            let body = resp.text().await.unwrap_or_default();
            Err(GitHubError::MergeNotAllowed(body))
        }
        409 => {
            let body = resp.text().await.unwrap_or_default();
            Err(GitHubError::HeadChanged(body))
        }
        422 => {
            let body = resp.text().await.unwrap_or_default();
            Err(GitHubError::ValidationFailed(body))
        }
        _ => {
            let body = resp.text().await.unwrap_or_default();
            Err(GitHubError::ApiError(format!(
                "HTTP {}: {}",
                status, body
            )))
        }
    }
}

/// Parse the `Link` header from a GitHub API response to extract the next page number.
///
/// GitHub returns pagination info in the format:
/// `<https://api.github.com/...?page=2>; rel="next", <...>; rel="last"`
///
/// Returns `None` if there is no next page.
pub fn parse_next_page(link_header: &str) -> Option<u32> {
    link_header.split(',').find_map(|part| {
        if part.contains(r#"rel="next""#) {
            // Extract URL between < and >
            let url_start = part.find('<')? + 1;
            let url_end = part.find('>')?;
            let url = &part[url_start..url_end];

            // Find page= parameter
            url.split('?')
                .nth(1)?
                .split('&')
                .find(|p| p.starts_with("page="))
                .and_then(|p| p.strip_prefix("page="))
                .and_then(|v| v.parse::<u32>().ok())
        } else {
            None
        }
    })
}

/// Extract rate limit information from response headers.
///
/// Returns `(remaining, limit)` as `(Option<u32>, Option<u32>)`.
pub fn extract_rate_limit(resp: &reqwest::Response) -> (Option<u32>, Option<u32>) {
    let remaining = resp
        .headers()
        .get("x-ratelimit-remaining")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u32>().ok());

    let limit = resp
        .headers()
        .get("x-ratelimit-limit")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u32>().ok());

    (remaining, limit)
}
