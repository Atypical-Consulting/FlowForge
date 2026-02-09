//! NuGet package info proxy for the NuGet Package Viewer blade.
//!
//! Proxies NuGet API calls through the Rust backend so the frontend
//! never makes direct external HTTP requests (required for strict CSP).

use serde::{Deserialize, Serialize};
use specta::Type;
use std::time::Duration;

use crate::git::error::GitError;

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NugetPackageInfo {
    pub id: String,
    pub version: String,
    pub description: String,
    pub authors: String,
    pub total_downloads: u32,
    pub published: String,
    pub project_url: Option<String>,
    pub license_url: Option<String>,
    pub tags: Vec<String>,
    pub nuget_url: String,
}

// ── Internal API response types ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct SearchResponse {
    data: Vec<SearchResult>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchResult {
    id: Option<String>,
    version: Option<String>,
    description: Option<String>,
    authors: Option<serde_json::Value>,
    total_downloads: Option<u32>,
    project_url: Option<String>,
    license_url: Option<String>,
    tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct RegistrationIndex {
    items: Option<Vec<RegistrationPage>>,
}

#[derive(Debug, Deserialize)]
struct RegistrationPage {
    items: Option<Vec<RegistrationLeaf>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegistrationLeaf {
    catalog_entry: Option<CatalogEntry>,
}

#[derive(Debug, Deserialize)]
struct CatalogEntry {
    published: Option<String>,
}

// ── Commands ───────────────────────────────────────────────────────────────

/// Fetch NuGet package information by package ID.
///
/// Queries the NuGet Search API and Registration API, returning
/// combined package metadata.
#[tauri::command]
#[specta::specta]
pub async fn fetch_nuget_info(package_id: String) -> Result<NugetPackageInfo, GitError> {
    let client = reqwest::Client::new();

    // 1. Search API for package metadata
    let search_url = format!(
        "https://azuresearch-usnc.nuget.org/query?q=packageid:{}&prerelease=true&take=1",
        &package_id
    );

    let search_resp = client
        .get(&search_url)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| GitError::OperationFailed(format!("NuGet search failed: {}", e)))?;

    if !search_resp.status().is_success() {
        return Err(GitError::OperationFailed(format!(
            "NuGet search returned {}",
            search_resp.status()
        )));
    }

    let search_data: SearchResponse = search_resp
        .json()
        .await
        .map_err(|e| GitError::OperationFailed(format!("NuGet search parse failed: {}", e)))?;

    let pkg = search_data
        .data
        .into_iter()
        .next()
        .ok_or_else(|| GitError::NotFound(format!("NuGet package not found: {}", package_id)))?;

    let id = pkg.id.unwrap_or_else(|| package_id.clone());

    // 2. Registration API for published date
    let lower_id = package_id.to_lowercase();
    let reg_url = format!(
        "https://api.nuget.org/v3/registration5-gz-semver2/{}/index.json",
        lower_id
    );

    let mut published = String::new();
    if let Ok(reg_resp) = client
        .get(&reg_url)
        .timeout(Duration::from_secs(5))
        .send()
        .await
    {
        if reg_resp.status().is_success() {
            if let Ok(reg_data) = reg_resp.json::<RegistrationIndex>().await {
                if let Some(pages) = reg_data.items {
                    if let Some(page) = pages.first() {
                        if let Some(items) = &page.items {
                            if let Some(leaf) = items.last() {
                                if let Some(entry) = &leaf.catalog_entry {
                                    published = entry.published.clone().unwrap_or_default();
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Parse authors (can be string or array in NuGet API)
    let authors = match pkg.authors {
        Some(serde_json::Value::Array(arr)) => arr
            .iter()
            .filter_map(|v| v.as_str())
            .collect::<Vec<_>>()
            .join(", "),
        Some(serde_json::Value::String(s)) => s,
        _ => "Unknown".to_string(),
    };

    Ok(NugetPackageInfo {
        id: id.clone(),
        version: pkg.version.unwrap_or_default(),
        description: pkg
            .description
            .unwrap_or_else(|| "No description available".to_string()),
        authors,
        total_downloads: pkg.total_downloads.unwrap_or(0),
        published,
        project_url: pkg.project_url,
        license_url: pkg.license_url,
        tags: pkg.tags.unwrap_or_default(),
        nuget_url: format!("https://www.nuget.org/packages/{}", id),
    })
}
