//! Gitignore template management for the Init Repo blade.
//!
//! Provides commands to fetch .gitignore templates from GitHub (with offline
//! fallback), detect project types from marker files, and write init files.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::Path;
use std::time::Duration;

use crate::git::error::GitError;

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitignoreTemplateName {
    pub name: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitignoreTemplateList {
    pub templates: Vec<GitignoreTemplateName>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitignoreTemplate {
    pub name: String,
    pub content: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDetection {
    pub detected_types: Vec<DetectedProject>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DetectedProject {
    pub project_type: String,
    pub marker_file: String,
    pub recommended_templates: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct InitFile {
    pub filename: String,
    pub content: String,
}

// ── Bundled templates ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct BundledTemplates {
    templates: Vec<BundledTemplate>,
}

#[derive(Debug, Deserialize)]
struct BundledTemplate {
    name: String,
    content: String,
}

const BUNDLED_JSON: &str = include_str!("../../resources/bundled-gitignore-templates.json");

fn load_bundled_templates() -> BundledTemplates {
    serde_json::from_str(BUNDLED_JSON).unwrap_or_else(|_| BundledTemplates {
        templates: Vec::new(),
    })
}

// ── GitHub API response for individual template ──────────────────────────────

#[derive(Debug, Deserialize)]
struct GitHubTemplateResponse {
    name: String,
    source: String,
}

// ── Category mapping ─────────────────────────────────────────────────────────

fn categorize_template(name: &str) -> &'static str {
    match name {
        // Languages
        "Actionscript" | "Ada" | "Agda" | "Android" | "AppceleratorTitanium"
        | "Assembly" | "C" | "C++" | "CFWheels" | "CMake" | "CUDA" | "CakePHP"
        | "ChefCookbook" | "Clojure" | "CodeIgniter" | "CommonLisp"
        | "Composer" | "Concrete5" | "Coq" | "CraftCMS" | "Crystal" | "D"
        | "DM" | "Dart" | "Delphi" | "Drupal" | "EPiServer" | "Eagle"
        | "Elisp" | "Elixir" | "Elm" | "Erlang" | "ExpressionEngine"
        | "ExtJs" | "Fancy" | "Finale" | "ForceDotCom" | "Fortran"
        | "FSharp" | "GWT" | "Go" | "Godot" | "Grails" | "Haskell"
        | "IGORPro" | "Idris" | "Java" | "Jboss" | "Jekyll" | "Joomla"
        | "Julia" | "KiCad" | "Kohana" | "Kotlin" | "LabVIEW" | "Laravel"
        | "Leiningen" | "LemonStand" | "Lilypond" | "Lithium" | "Lua"
        | "Magento" | "Mercury" | "MetaProgrammingSystem" | "Nanoc" | "Nim"
        | "Node" | "OCaml" | "Objective-C" | "Opa" | "OpenCart"
        | "OracleForms" | "Packer" | "Perl" | "Perl6" | "Phalcon" | "PHP"
        | "PlayFramework" | "Plone" | "Prestashop" | "Processing" | "PureScript"
        | "Python" | "Qooxdoo" | "Qt" | "R" | "ROS" | "Racket" | "Rails"
        | "Raku" | "RhodesRhomobile" | "Ruby" | "Rust" | "SCons" | "Sass"
        | "Scala" | "Scheme" | "Scrivener" | "Sdcc" | "SeamGen" | "SketchUp"
        | "Smalltalk" | "Stella" | "SugarCRM" | "Swift" | "Symfony"
        | "SymphonyCMS" | "TeX" | "Terraform" | "Textpattern" | "TurboGears2"
        | "TwinCAT3" | "Typo3" | "Umbraco" | "Unity" | "UnrealEngine"
        | "V" | "VVVV" | "Waf" | "WordPress" | "Xojo" | "Yeoman" | "Yii"
        | "ZendFramework" | "Zephyr" | "Zig" => "languages",

        // Editors/IDEs
        "JetBrains" | "VisualStudioCode" | "Vim" | "Emacs" | "SublimeText"
        | "Eclipse" | "NetBeans" | "Xcode" | "NotepadPP" | "Kate" | "Atom"
        | "TextMate" | "Anjuta" | "Archives" | "Bazaar" | "BricxCC"
        | "Calibre" | "Cloud9" | "CodeKit" | "CVS" | "DartEditor"
        | "Dreamweaver" | "Dropbox" | "EiffelStudio" | "Espresso"
        | "FlexBuilder" | "GPG" | "JDeveloper" | "KDevelop4" | "Lazarus"
        | "LibreOffice" | "Linux" | "LyX" | "Matlab" | "Mercurial"
        | "ModelSim" | "MonoDevelop" | "Ninja" | "Otto" | "Redcar"
        | "Redis" | "SlickEdit" | "Stata" | "SVN" | "SynopsysVCS"
        | "Tags" | "TortoiseGit" | "Vagrant" | "VirtualEnv"
        | "Virtuoso" | "VisualStudio" | "WebMethods" | "Xilinx" => "editors",

        // Frameworks (Gradle, Maven, Flutter, Android, etc.)
        "Gradle" | "Maven" | "Flutter" => "frameworks",

        // Operating Systems
        "macOS" | "Windows" => "os",

        // Default
        _ => "other",
    }
}

// ── Commands ─────────────────────────────────────────────────────────────────

/// List all available .gitignore template names.
///
/// Attempts to fetch from GitHub API with a 5s timeout, falling back to
/// bundled templates on any error.
#[tauri::command]
#[specta::specta]
pub async fn list_gitignore_templates() -> Result<GitignoreTemplateList, GitError> {
    // Try GitHub API first
    let client = reqwest::Client::new();
    let result = client
        .get("https://api.github.com/gitignore/templates")
        .header("User-Agent", "FlowForge")
        .timeout(Duration::from_secs(5))
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(names) = resp.json::<Vec<String>>().await {
                let templates = names
                    .into_iter()
                    .map(|name| {
                        let category = categorize_template(&name).to_string();
                        GitignoreTemplateName { name, category }
                    })
                    .collect();
                return Ok(GitignoreTemplateList {
                    templates,
                    source: "github".to_string(),
                });
            }
        }
        _ => {}
    }

    // Fallback to bundled templates
    let bundled = load_bundled_templates();
    let templates = bundled
        .templates
        .into_iter()
        .map(|t| {
            let category = categorize_template(&t.name).to_string();
            GitignoreTemplateName {
                name: t.name,
                category,
            }
        })
        .collect();

    Ok(GitignoreTemplateList {
        templates,
        source: "bundled".to_string(),
    })
}

/// Get the content of a single .gitignore template by name.
///
/// Tries GitHub API first, falls back to bundled templates.
#[tauri::command]
#[specta::specta]
pub async fn get_gitignore_template(name: String) -> Result<GitignoreTemplate, GitError> {
    // Try GitHub API first
    let client = reqwest::Client::new();
    let url = format!("https://api.github.com/gitignore/templates/{}", name);
    let result = client
        .get(&url)
        .header("User-Agent", "FlowForge")
        .header("Accept", "application/vnd.github+json")
        .timeout(Duration::from_secs(5))
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(template) = resp.json::<GitHubTemplateResponse>().await {
                return Ok(GitignoreTemplate {
                    name: template.name,
                    content: template.source,
                    source: "github".to_string(),
                });
            }
        }
        _ => {}
    }

    // Fallback to bundled templates
    let bundled = load_bundled_templates();
    if let Some(t) = bundled.templates.into_iter().find(|t| t.name == name) {
        return Ok(GitignoreTemplate {
            name: t.name,
            content: t.content,
            source: "bundled".to_string(),
        });
    }

    Err(GitError::NotFound(format!(
        "Gitignore template not found: {}",
        name
    )))
}

/// Detect project types by scanning for marker files in a directory.
///
/// Returns all detected project types with recommended .gitignore templates.
#[tauri::command]
#[specta::specta]
pub async fn detect_project_type(path: String) -> Result<ProjectDetection, GitError> {
    let path_clone = path.clone();

    let detected = tokio::task::spawn_blocking(move || {
        let dir = Path::new(&path_clone);
        if !dir.exists() || !dir.is_dir() {
            return Err(GitError::PathNotFound(path_clone));
        }

        let mut types = Vec::new();

        // Check for known marker files
        let markers: Vec<(&str, &str, Vec<&str>)> = vec![
            ("package.json", "Node.js", vec!["Node"]),
            ("tsconfig.json", "TypeScript", vec!["Node"]),
            ("Cargo.toml", "Rust", vec!["Rust"]),
            ("go.mod", "Go", vec!["Go"]),
            ("pom.xml", "Java (Maven)", vec!["Java", "Maven"]),
            ("requirements.txt", "Python", vec!["Python"]),
            ("pyproject.toml", "Python", vec!["Python"]),
            ("setup.py", "Python", vec!["Python"]),
            ("pubspec.yaml", "Flutter", vec!["Flutter"]),
            ("composer.json", "PHP", vec!["PHP"]),
        ];

        for (marker, project_type, templates) in markers {
            if dir.join(marker).exists() {
                types.push(DetectedProject {
                    project_type: project_type.to_string(),
                    marker_file: marker.to_string(),
                    recommended_templates: templates.iter().map(|s| s.to_string()).collect(),
                });
            }
        }

        // Check for build.gradle / build.gradle.kts
        if dir.join("build.gradle").exists() || dir.join("build.gradle.kts").exists() {
            let marker = if dir.join("build.gradle.kts").exists() {
                "build.gradle.kts"
            } else {
                "build.gradle"
            };
            types.push(DetectedProject {
                project_type: "Java (Gradle)".to_string(),
                marker_file: marker.to_string(),
                recommended_templates: vec!["Java".to_string(), "Gradle".to_string()],
            });
        }

        // Check for .idea/ directory (JetBrains)
        if dir.join(".idea").is_dir() {
            types.push(DetectedProject {
                project_type: "JetBrains IDE".to_string(),
                marker_file: ".idea/".to_string(),
                recommended_templates: vec!["JetBrains".to_string()],
            });
        }

        // Check for .vscode/ directory
        if dir.join(".vscode").is_dir() {
            types.push(DetectedProject {
                project_type: "VS Code".to_string(),
                marker_file: ".vscode/".to_string(),
                recommended_templates: vec!["VisualStudioCode".to_string()],
            });
        }

        // Check for C# projects (*.csproj, *.sln) and Swift projects (*.xcodeproj, Package.swift)
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();

                if name_str.ends_with(".csproj") || name_str.ends_with(".sln") {
                    types.push(DetectedProject {
                        project_type: "C# / .NET".to_string(),
                        marker_file: name_str.to_string(),
                        recommended_templates: vec!["VisualStudio".to_string()],
                    });
                    break;
                }

                if name_str.ends_with(".xcodeproj") || name_str == "Package.swift" {
                    types.push(DetectedProject {
                        project_type: "Swift / Xcode".to_string(),
                        marker_file: name_str.to_string(),
                        recommended_templates: vec!["Swift".to_string()],
                    });
                    break;
                }
            }
        }

        Ok(types)
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))??;

    Ok(ProjectDetection {
        detected_types: detected,
    })
}

/// Write initialization files (.gitignore, README.md, etc.) to a directory.
#[tauri::command]
#[specta::specta]
pub async fn write_init_files(path: String, files: Vec<InitFile>) -> Result<(), GitError> {
    let path_clone = path.clone();

    tokio::task::spawn_blocking(move || {
        let dir = Path::new(&path_clone);
        if !dir.exists() || !dir.is_dir() {
            return Err(GitError::PathNotFound(path_clone));
        }

        for file in &files {
            // Validate filename to prevent path traversal
            if file.filename.contains('/')
                || file.filename.contains('\\')
                || file.filename.contains("..")
            {
                return Err(GitError::OperationFailed(format!(
                    "Invalid filename: {}",
                    file.filename
                )));
            }

            let file_path = dir.join(&file.filename);
            std::fs::write(&file_path, &file.content).map_err(|e| {
                GitError::OperationFailed(format!(
                    "Failed to write {}: {}",
                    file.filename, e
                ))
            })?;
        }

        Ok(())
    })
    .await
    .map_err(|e| GitError::Internal(format!("Task join error: {}", e)))?
}
