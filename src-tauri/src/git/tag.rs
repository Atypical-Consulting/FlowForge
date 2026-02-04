use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::git::error::GitError;
use crate::git::repository::RepositoryState;

/// Information about a git tag.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TagInfo {
    /// Tag name (e.g., "v1.0.0")
    pub name: String,
    /// OID of the tag object (for annotated) or target commit (for lightweight)
    pub oid: String,
    /// OID of the commit the tag points to
    pub target_oid: String,
    /// Tag message (None for lightweight tags)
    pub message: Option<String>,
    /// Tagger name (None for lightweight tags)
    pub tagger: Option<String>,
    /// True for annotated tags, false for lightweight
    pub is_annotated: bool,
}

/// List all tags in the repository.
#[tauri::command]
#[specta::specta]
pub async fn list_tags(state: State<'_, RepositoryState>) -> Result<Vec<TagInfo>, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;
        let tag_names = repo.tag_names(None)?;
        let mut tags = Vec::new();

        for name in tag_names.iter().flatten() {
            let ref_name = format!("refs/tags/{}", name);
            let reference = repo.find_reference(&ref_name)?;
            let resolved = reference.resolve()?;
            let oid = resolved
                .target()
                .ok_or_else(|| GitError::Internal(format!("Tag {} has no target", name)))?;
            let obj = repo.find_object(oid, None)?;

            let tag_info = if let Some(tag) = obj.as_tag() {
                let target = tag.target()?.peel_to_commit()?;
                let tagger_info = tag.tagger().map(|sig: git2::Signature| {
                    format!(
                        "{} <{}>",
                        sig.name().unwrap_or(""),
                        sig.email().unwrap_or("")
                    )
                });
                TagInfo {
                    name: name.to_string(),
                    oid: oid.to_string(),
                    target_oid: target.id().to_string(),
                    message: tag.message().map(|m: &str| m.trim().to_string()),
                    tagger: tagger_info,
                    is_annotated: true,
                }
            } else {
                let commit = obj.peel_to_commit()?;
                TagInfo {
                    name: name.to_string(),
                    oid: commit.id().to_string(),
                    target_oid: commit.id().to_string(),
                    message: None,
                    tagger: None,
                    is_annotated: false,
                }
            };
            tags.push(tag_info);
        }

        tags.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(tags)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Create a new tag.
#[tauri::command]
#[specta::specta]
pub async fn create_tag(
    name: String,
    message: Option<String>,
    target_oid: Option<String>,
    state: State<'_, RepositoryState>,
) -> Result<TagInfo, GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        // Check if tag already exists
        let ref_name = format!("refs/tags/{}", name);
        if repo.find_reference(&ref_name).is_ok() {
            return Err(GitError::TagAlreadyExists(name.clone()));
        }

        // Get target commit
        let target_commit = if let Some(oid_str) = target_oid {
            let oid = git2::Oid::from_str(&oid_str)
                .map_err(|e| GitError::OperationFailed(format!("Invalid OID: {}", e)))?;
            repo.find_commit(oid)?
        } else {
            let head = repo.head()?;
            head.peel_to_commit()?
        };

        let target_obj = target_commit.as_object();

        if let Some(msg) = &message {
            // Annotated tag
            let sig = repo.signature().map_err(|e| {
                GitError::SignatureError(format!(
                    "Could not determine tagger. Please configure git: {}",
                    e.message()
                ))
            })?;
            let tag_oid = repo.tag(&name, target_obj, &sig, msg, false)?;
            let tagger_info = format!(
                "{} <{}>",
                sig.name().unwrap_or(""),
                sig.email().unwrap_or("")
            );
            Ok(TagInfo {
                name: name.clone(),
                oid: tag_oid.to_string(),
                target_oid: target_commit.id().to_string(),
                message: Some(msg.trim().to_string()),
                tagger: Some(tagger_info),
                is_annotated: true,
            })
        } else {
            // Lightweight tag
            repo.tag_lightweight(&name, target_obj, false)?;
            Ok(TagInfo {
                name: name.clone(),
                oid: target_commit.id().to_string(),
                target_oid: target_commit.id().to_string(),
                message: None,
                tagger: None,
                is_annotated: false,
            })
        }
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}

/// Delete a tag by name.
#[tauri::command]
#[specta::specta]
pub async fn delete_tag(name: String, state: State<'_, RepositoryState>) -> Result<(), GitError> {
    let repo_path = state
        .get_path()
        .await
        .ok_or_else(|| GitError::NotFound("No repository open".to_string()))?;

    tokio::task::spawn_blocking(move || {
        let repo = git2::Repository::open(&repo_path)?;

        let ref_name = format!("refs/tags/{}", name);
        let mut reference = repo
            .find_reference(&ref_name)
            .map_err(|_| GitError::TagNotFound(name.clone()))?;

        reference.delete()?;

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
