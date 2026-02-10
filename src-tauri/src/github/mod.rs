pub mod auth;
pub mod error;
pub mod rate_limit;
pub mod remote;
pub mod token;
pub mod types;

// Re-export Tauri commands for easy import in lib.rs
pub use auth::{github_poll_auth, github_start_device_flow};
pub use rate_limit::github_check_rate_limit;
pub use remote::github_detect_remotes;
pub use token::{github_get_auth_status, github_sign_out};
