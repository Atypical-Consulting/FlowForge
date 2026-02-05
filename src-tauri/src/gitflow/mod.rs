//! Gitflow state machine and policy validation module.
//!
//! This module provides:
//! - State machine for tracking Gitflow workflow state
//! - Policy validation for branch names
//! - Error types for Gitflow-specific operations
//! - Tauri commands for Gitflow operations

pub mod commands;
pub mod error;
pub mod init;
pub mod machine;
pub mod merge;
pub mod policy;
pub mod state;

pub use commands::{
    abort_gitflow, finish_feature, finish_hotfix, finish_release, get_gitflow_status,
    start_feature, start_hotfix, start_release,
};
pub use init::{init_gitflow, GitflowConfig, GitflowInitResult};
