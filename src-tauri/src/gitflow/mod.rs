//! Gitflow state machine and policy validation module.
//!
//! This module provides:
//! - State machine for tracking Gitflow workflow state
//! - Policy validation for branch names
//! - Error types for Gitflow-specific operations

pub mod error;
pub mod machine;
pub mod policy;
pub mod state;

pub use error::GitflowError;
pub use machine::{GitflowEvent, GitflowMachine, GitflowState};
pub use state::{reconstruct_state, GitflowContext};
