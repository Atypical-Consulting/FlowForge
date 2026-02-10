use serde::{Deserialize, Serialize};
use specta::Type;

/// Extension manifest parsed from `flowforge.extension.json`.
///
/// Matches the JSON schema that extensions ship alongside their entry point.
/// All field names use camelCase in JSON via the `rename_all` attribute.
#[derive(Debug, Serialize, Deserialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionManifest {
    /// Unique identifier for the extension (e.g. "github").
    pub id: String,

    /// Human-readable display name.
    pub name: String,

    /// Semantic version of the extension (e.g. "1.0.0").
    pub version: String,

    /// Optional longer description of what the extension does.
    pub description: Option<String>,

    /// API version the extension targets (e.g. "1").
    pub api_version: String,

    /// Relative path to the JavaScript entry point (e.g. "index.js").
    pub main: String,

    /// Contributions the extension registers (blades, commands, toolbar items).
    pub contributes: Option<ExtensionContributes>,

    /// Permissions the extension requests (e.g. ["fs:read", "network"]).
    pub permissions: Option<Vec<String>>,

    /// Absolute path to the extension directory on disk.
    /// Populated by discovery after parsing — not present in the JSON file.
    #[serde(default)]
    pub base_path: Option<String>,

    /// Trust level for the extension.
    /// "built-in" for bundled extensions, "user-trusted" for user-installed,
    /// "sandboxed" for untrusted third-party (future).
    /// Defaults to "sandboxed" when not specified in the manifest JSON.
    #[serde(default = "default_trust_level")]
    pub trust_level: String,
}

fn default_trust_level() -> String {
    "sandboxed".to_string()
}

/// Contribution points an extension can register.
#[derive(Debug, Serialize, Deserialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionContributes {
    /// Blade types contributed by this extension.
    pub blades: Option<Vec<ExtensionBladeContribution>>,

    /// Commands contributed by this extension.
    pub commands: Option<Vec<ExtensionCommandContribution>>,

    /// Toolbar actions contributed by this extension.
    pub toolbar: Option<Vec<ExtensionToolbarContribution>>,
}

/// A blade type contributed by an extension.
#[derive(Debug, Serialize, Deserialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionBladeContribution {
    /// The blade type identifier (used as the `type` field in navigation).
    pub r#type: String,

    /// Display title for the blade.
    pub title: String,

    /// Whether only one instance of this blade can be open at a time.
    pub singleton: Option<bool>,
}

/// A command contributed by an extension.
#[derive(Debug, Serialize, Deserialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionCommandContribution {
    /// Unique command identifier.
    pub id: String,

    /// Display title for the command (shown in command palette).
    pub title: String,

    /// Optional category for grouping in the command palette.
    pub category: Option<String>,
}

/// A toolbar action contributed by an extension.
#[derive(Debug, Serialize, Deserialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionToolbarContribution {
    /// Unique toolbar action identifier.
    pub id: String,

    /// Display label for the toolbar action.
    pub label: String,

    /// Toolbar group to place the action in (e.g. "vcs", "tools").
    pub group: Option<String>,

    /// Sort priority within the group (lower values appear first).
    pub priority: Option<i32>,
}
