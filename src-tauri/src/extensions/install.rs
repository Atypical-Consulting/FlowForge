//! Extension install/uninstall lifecycle commands.
//!
//! Provides Tauri commands for fetching extension manifests from
//! Git repositories, installing extensions to the local extensions
//! directory, and uninstalling them.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::manifest::ExtensionManifest;

/// Validate an extension `id` before it is used to build a filesystem path.
///
/// The `id` originates from an untrusted `flowforge.extension.json` in an
/// arbitrary cloned Git repository, so it must never be allowed to escape the
/// extensions directory via absolute paths or `..` traversal. Only a strict
/// set of safe characters is permitted, and leading dots are rejected so the
/// id can never become `.`, `..`, or a hidden traversal segment.
fn validate_ext_id(ext_id: &str) -> Result<(), String> {
    if ext_id.is_empty() {
        return Err("Manifest 'id' field is empty".to_string());
    }
    if ext_id == "." || ext_id == ".." {
        return Err(format!("Invalid extension id '{}'", ext_id));
    }
    if ext_id.starts_with('.') {
        return Err(format!("Extension id '{}' must not start with '.'", ext_id));
    }
    if !ext_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(format!(
            "Extension id '{}' contains invalid characters (allowed: alphanumeric, '-', '_', '.')",
            ext_id
        ));
    }
    Ok(())
}

/// Result of fetching an extension manifest from a Git URL.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionFetchResult {
    pub manifest_json: String,
    pub temp_path: String,
}

/// Fetch an extension manifest from a Git repository URL.
///
/// Clones the repo to a temp directory, reads the manifest file,
/// and returns both the manifest JSON and the temp path for subsequent install.
#[tauri::command]
#[specta::specta]
pub async fn extension_fetch_manifest(git_url: String) -> Result<ExtensionFetchResult, String> {
    let temp_base = std::env::temp_dir().join("flowforge-ext-install");
    tokio::fs::create_dir_all(&temp_base)
        .await
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Generate a unique temp path for this clone
    let unique_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temp_path = temp_base.join(format!("ext-{}", unique_id));

    let url_clone = git_url.clone();
    let path_clone = temp_path.clone();

    // Clone the repository (blocking git2 operation)
    tokio::task::spawn_blocking(move || {
        git2::Repository::clone(&url_clone, &path_clone)
            .map_err(|e| format!("Failed to clone repository '{}': {}", url_clone, e))
    })
    .await
    .map_err(|e| format!("Clone task failed: {}", e))??;

    // Check for manifest file
    let manifest_path = temp_path.join("flowforge.extension.json");
    if !manifest_path.exists() {
        // Clean up temp dir on failure
        tokio::fs::remove_dir_all(&temp_path).await.ok();
        return Err("No flowforge.extension.json found in repository root".to_string());
    }

    let manifest_json = tokio::fs::read_to_string(&manifest_path)
        .await
        .map_err(|e| format!("Failed to read manifest: {}", e))?;

    // Validate the manifest against the full ExtensionManifest schema so that
    // required fields (id, name, version, apiVersion, main) are present and
    // well-formed before we offer to install it.
    let manifest = serde_json::from_str::<ExtensionManifest>(&manifest_json)
        .map_err(|e| format!("Invalid extension manifest: {}", e))?;

    // Reject ids that could escape the extensions directory on install.
    validate_ext_id(&manifest.id)?;

    Ok(ExtensionFetchResult {
        manifest_json,
        temp_path: temp_path.to_string_lossy().into_owned(),
    })
}

/// Install an extension from a previously fetched temp path.
///
/// Moves the cloned repository to the extensions directory under
/// the extension's ID extracted from the manifest.
#[tauri::command]
#[specta::specta]
pub async fn extension_install(
    temp_path: String,
    extensions_dir: String,
) -> Result<(), String> {
    let temp = std::path::PathBuf::from(&temp_path);
    let manifest_path = temp.join("flowforge.extension.json");

    let manifest_str = tokio::fs::read_to_string(&manifest_path)
        .await
        .map_err(|e| format!("Failed to read manifest: {}", e))?;

    // Validate the manifest against the full schema (not just a generic JSON
    // value) so malformed extensions cannot be installed.
    let manifest = serde_json::from_str::<ExtensionManifest>(&manifest_str)
        .map_err(|e| format!("Invalid extension manifest: {}", e))?;

    let ext_id = manifest.id.clone();

    // The id is attacker-controlled (from the cloned repo's manifest). Reject
    // anything that could escape the extensions directory before joining.
    validate_ext_id(&ext_id)?;

    let ext_dir = std::path::PathBuf::from(&extensions_dir);
    let target = ext_dir.join(&ext_id);

    // Defense-in-depth: ensure the target stays directly inside ext_dir.
    if target.parent() != Some(ext_dir.as_path()) {
        return Err(format!("Invalid extension id '{}'", ext_id));
    }

    if target.exists() {
        // Clean up temp dir
        tokio::fs::remove_dir_all(&temp).await.ok();
        return Err(format!("Extension '{}' is already installed", ext_id));
    }

    // Create extensions directory if needed
    tokio::fs::create_dir_all(&ext_dir)
        .await
        .map_err(|e| format!("Failed to create extensions directory: {}", e))?;

    // Try rename (same filesystem) first, fall back to copy
    if tokio::fs::rename(&temp, &target).await.is_err() {
        // Cross-filesystem: copy recursively then delete temp.
        if let Err(e) = copy_dir_recursive(&temp, &target).await {
            // Best-effort cleanup of the partially-copied target so it does
            // not block reinstall or get picked up by discovery, and of the
            // leftover temp clone.
            tokio::fs::remove_dir_all(&target).await.ok();
            tokio::fs::remove_dir_all(&temp).await.ok();
            return Err(e);
        }
        tokio::fs::remove_dir_all(&temp).await.ok();
    }

    Ok(())
}

/// Uninstall an extension by removing its directory.
#[tauri::command]
#[specta::specta]
pub async fn extension_uninstall(
    extension_id: String,
    extensions_dir: String,
) -> Result<(), String> {
    // The extension_id comes verbatim from a (potentially untrusted) manifest
    // id, so it must be validated before being used to build a path for a
    // recursive delete.
    validate_ext_id(&extension_id)?;

    let ext_dir = std::path::PathBuf::from(&extensions_dir);
    let target = ext_dir.join(&extension_id);

    // Defense-in-depth: the target must be a direct child of ext_dir.
    if target.parent() != Some(ext_dir.as_path()) {
        return Err(format!("Invalid extension id '{}'", extension_id));
    }

    if !target.exists() {
        return Err(format!("Extension '{}' is not installed", extension_id));
    }

    tokio::fs::remove_dir_all(&target)
        .await
        .map_err(|e| format!("Failed to remove extension directory: {}", e))?;

    Ok(())
}

/// Cancel an in-progress extension install by cleaning up the temp directory.
#[tauri::command]
#[specta::specta]
pub async fn extension_cancel_install(temp_path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&temp_path);
    if path.exists() {
        tokio::fs::remove_dir_all(&path)
            .await
            .map_err(|e| format!("Failed to clean up temp directory: {}", e))?;
    }
    Ok(())
}

/// Recursively copy a directory and its contents.
async fn copy_dir_recursive(
    src: &std::path::Path,
    dst: &std::path::Path,
) -> Result<(), String> {
    tokio::fs::create_dir_all(dst)
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let mut entries = tokio::fs::read_dir(src)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("Failed to iterate directory: {}", e))?
    {
        let entry_path = entry.path();
        let dest_path = dst.join(entry.file_name());

        if entry_path.is_dir() {
            Box::pin(copy_dir_recursive(&entry_path, &dest_path)).await?;
        } else {
            tokio::fs::copy(&entry_path, &dest_path)
                .await
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_valid_ids() {
        for id in ["github", "git-flow", "my_ext", "ext.2", "Abc123"] {
            assert!(validate_ext_id(id).is_ok(), "expected '{}' to be valid", id);
        }
    }

    #[test]
    fn rejects_empty_id() {
        assert!(validate_ext_id("").is_err());
    }

    #[test]
    fn rejects_dot_and_dotdot() {
        assert!(validate_ext_id(".").is_err());
        assert!(validate_ext_id("..").is_err());
    }

    #[test]
    fn rejects_leading_dot() {
        assert!(validate_ext_id(".hidden").is_err());
    }

    #[test]
    fn rejects_path_separators_and_traversal() {
        for id in [
            "../../etc/passwd",
            "..\\..\\windows",
            "foo/bar",
            "/Users/victim/.zshrc",
            "a/b",
            "x\\y",
        ] {
            assert!(
                validate_ext_id(id).is_err(),
                "expected '{}' to be rejected",
                id
            );
        }
    }

    #[test]
    fn join_with_validated_id_stays_inside_dir() {
        // A validated id always produces a target that is a direct child of
        // the extensions directory.
        let ext_dir = std::path::PathBuf::from("/tmp/extensions");
        let id = "github";
        validate_ext_id(id).unwrap();
        let target = ext_dir.join(id);
        assert_eq!(target.parent(), Some(ext_dir.as_path()));
    }
}
