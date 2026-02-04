//! Branch name parsing and validation for Gitflow.

/// Branch type classification for Gitflow.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BranchType {
    /// Main/master branch
    Main,
    /// Develop branch
    Develop,
    /// Feature branch with name
    Feature(String),
    /// Release branch with version
    Release(String),
    /// Hotfix branch with name/version
    Hotfix(String),
    /// Any other branch
    Other(String),
}

/// Parse a branch name into its Gitflow type.
pub fn parse_branch_type(name: &str) -> BranchType {
    // Check for main branch
    if is_main_branch(name) {
        return BranchType::Main;
    }

    // Check for develop branch
    if is_develop_branch(name) {
        return BranchType::Develop;
    }

    // Check for feature branch
    if let Some(feature_name) = name.strip_prefix("feature/") {
        return BranchType::Feature(feature_name.to_string());
    }

    // Check for release branch
    if let Some(version) = name.strip_prefix("release/") {
        return BranchType::Release(version.to_string());
    }

    // Check for hotfix branch
    if let Some(hotfix_name) = name.strip_prefix("hotfix/") {
        return BranchType::Hotfix(hotfix_name.to_string());
    }

    // Default to Other
    BranchType::Other(name.to_string())
}

/// Check if a feature name is valid.
///
/// Valid feature names:
/// - Are not empty
/// - Contain only alphanumeric characters, hyphens, and underscores
/// - Do not contain slashes (path separators)
pub fn is_valid_feature_name(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }

    // No slashes allowed
    if name.contains('/') {
        return false;
    }

    // Only alphanumeric, hyphen, underscore
    name.chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
}

/// Check if a version string is valid (semver-ish).
///
/// Valid versions contain only digits and dots.
pub fn is_valid_version(version: &str) -> bool {
    if version.is_empty() {
        return false;
    }

    // Must contain at least one digit
    if !version.chars().any(|c| c.is_ascii_digit()) {
        return false;
    }

    // Only digits and dots allowed
    version.chars().all(|c| c.is_ascii_digit() || c == '.')
}

/// Check if a branch name is the main branch.
pub fn is_main_branch(name: &str) -> bool {
    name == "main" || name == "master"
}

/// Check if a branch name is the develop branch.
pub fn is_develop_branch(name: &str) -> bool {
    name == "develop" || name == "development"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_main_branch() {
        assert_eq!(parse_branch_type("main"), BranchType::Main);
        assert_eq!(parse_branch_type("master"), BranchType::Main);
    }

    #[test]
    fn test_parse_develop_branch() {
        assert_eq!(parse_branch_type("develop"), BranchType::Develop);
        assert_eq!(parse_branch_type("development"), BranchType::Develop);
    }

    #[test]
    fn test_parse_feature_branch() {
        assert_eq!(
            parse_branch_type("feature/login"),
            BranchType::Feature("login".to_string())
        );
        assert_eq!(
            parse_branch_type("feature/user-auth"),
            BranchType::Feature("user-auth".to_string())
        );
    }

    #[test]
    fn test_parse_release_branch() {
        assert_eq!(
            parse_branch_type("release/1.0.0"),
            BranchType::Release("1.0.0".to_string())
        );
    }

    #[test]
    fn test_parse_hotfix_branch() {
        assert_eq!(
            parse_branch_type("hotfix/critical-bug"),
            BranchType::Hotfix("critical-bug".to_string())
        );
    }

    #[test]
    fn test_parse_other_branch() {
        assert_eq!(
            parse_branch_type("experiment/test"),
            BranchType::Other("experiment/test".to_string())
        );
    }

    #[test]
    fn test_valid_feature_names() {
        assert!(is_valid_feature_name("login"));
        assert!(is_valid_feature_name("user-auth"));
        assert!(is_valid_feature_name("feature_123"));
        assert!(is_valid_feature_name("ABC123"));
    }

    #[test]
    fn test_invalid_feature_names() {
        assert!(!is_valid_feature_name(""));
        assert!(!is_valid_feature_name("path/to/feature"));
        assert!(!is_valid_feature_name("feature@name"));
    }

    #[test]
    fn test_valid_versions() {
        assert!(is_valid_version("1.0.0"));
        assert!(is_valid_version("2.1"));
        assert!(is_valid_version("10.20.30"));
    }

    #[test]
    fn test_invalid_versions() {
        assert!(!is_valid_version(""));
        assert!(!is_valid_version("v1.0.0")); // v prefix not allowed
        assert!(!is_valid_version("abc"));
    }
}
