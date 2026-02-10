pub mod auth;
pub mod client;
pub mod error;
pub mod issues;
pub mod pulls;
pub mod rate_limit;
pub mod remote;
pub mod token;
pub mod types;

// Re-export Tauri commands for easy import in lib.rs
pub use auth::{github_poll_auth, github_start_device_flow};
pub use issues::{github_get_issue, github_list_issues};
pub use pulls::{github_get_pull_request, github_list_pull_requests};
pub use rate_limit::github_check_rate_limit;
pub use remote::github_detect_remotes;
pub use token::{github_get_auth_status, github_sign_out};
