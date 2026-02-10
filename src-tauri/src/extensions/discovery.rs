use super::manifest::ExtensionManifest;
use std::path::PathBuf;

/// Discover extensions by scanning subdirectories for `flowforge.extension.json` manifests.
///
/// - If the `extensions_dir` does not exist, returns an empty array (extensions are optional).
/// - Invalid manifests (bad JSON, missing required fields) are skipped with a warning log.
/// - Only truly unrecoverable I/O errors (e.g. permission denied on an existing directory)
///   return `Err`.
#[tauri::command]
#[specta::specta]
pub async fn discover_extensions(extensions_dir: String) -> Result<Vec<ExtensionManifest>, String> {
    let dir = PathBuf::from(&extensions_dir);

    // If the directory does not exist, extensions are simply not installed yet.
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut read_dir = tokio::fs::read_dir(&dir)
        .await
        .map_err(|e| format!("Failed to read extensions directory '{}': {}", extensions_dir, e))?;

    let mut manifests = Vec::new();

    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| format!("Failed to iterate extensions directory: {}", e))?
    {
        let entry_path = entry.path();

        // Only look at directories (each extension lives in its own subdirectory).
        if !entry_path.is_dir() {
            continue;
        }

        let manifest_path = entry_path.join("flowforge.extension.json");

        if !manifest_path.exists() {
            continue;
        }

        let content = match tokio::fs::read_to_string(&manifest_path).await {
            Ok(c) => c,
            Err(e) => {
                eprintln!(
                    "[extensions] Warning: failed to read manifest at '{}': {}",
                    manifest_path.display(),
                    e
                );
                continue;
            }
        };

        let mut manifest: ExtensionManifest = match serde_json::from_str(&content) {
            Ok(m) => m,
            Err(e) => {
                eprintln!(
                    "[extensions] Warning: invalid manifest at '{}': {}",
                    manifest_path.display(),
                    e
                );
                continue;
            }
        };

        // Set base_path so the frontend knows where the extension lives on disk.
        manifest.base_path = Some(
            entry_path
                .to_string_lossy()
                .into_owned(),
        );

        manifests.push(manifest);
    }

    Ok(manifests)
}
