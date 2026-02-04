//! Gitflow state machine definition.

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::gitflow::error::GitflowError;

/// The current state of the Gitflow workflow.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "type", content = "data")]
pub enum GitflowState {
    /// No active workflow (on main, develop, or other)
    Idle,
    /// Working on a feature branch
    Feature { name: String },
    /// Working on a release branch
    Release { version: String },
    /// Working on a hotfix branch
    Hotfix { name: String },
}

impl Default for GitflowState {
    fn default() -> Self {
        GitflowState::Idle
    }
}

/// Events that trigger state transitions.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "type", content = "data")]
pub enum GitflowEvent {
    /// Start a new feature
    StartFeature { name: String },
    /// Finish current feature
    FinishFeature,
    /// Start a new release
    StartRelease { version: String },
    /// Finish current release
    FinishRelease,
    /// Start a new hotfix
    StartHotfix { name: String },
    /// Finish current hotfix
    FinishHotfix,
    /// Abort current workflow
    Abort,
}

/// The Gitflow state machine.
///
/// Tracks the current workflow state and validates transitions.
#[derive(Debug, Clone)]
pub struct GitflowMachine {
    state: GitflowState,
}

impl GitflowMachine {
    /// Create a new state machine in Idle state.
    pub fn new() -> Self {
        GitflowMachine {
            state: GitflowState::Idle,
        }
    }

    /// Create a state machine with a specific initial state.
    pub fn with_state(state: GitflowState) -> Self {
        GitflowMachine { state }
    }

    /// Get the current state.
    pub fn state(&self) -> &GitflowState {
        &self.state
    }

    /// Check if a transition is valid without performing it.
    pub fn can_handle(&self, event: &GitflowEvent) -> bool {
        match (&self.state, event) {
            // From Idle, can start any workflow
            (GitflowState::Idle, GitflowEvent::StartFeature { .. }) => true,
            (GitflowState::Idle, GitflowEvent::StartRelease { .. }) => true,
            (GitflowState::Idle, GitflowEvent::StartHotfix { .. }) => true,

            // From Feature, can finish or abort
            (GitflowState::Feature { .. }, GitflowEvent::FinishFeature) => true,
            (GitflowState::Feature { .. }, GitflowEvent::Abort) => true,

            // From Release, can finish or abort
            (GitflowState::Release { .. }, GitflowEvent::FinishRelease) => true,
            (GitflowState::Release { .. }, GitflowEvent::Abort) => true,

            // From Hotfix, can finish or abort
            (GitflowState::Hotfix { .. }, GitflowEvent::FinishHotfix) => true,
            (GitflowState::Hotfix { .. }, GitflowEvent::Abort) => true,

            // All other transitions are invalid
            _ => false,
        }
    }

    /// Handle an event and transition to a new state.
    ///
    /// Returns error if the transition is not valid from current state.
    pub fn handle(&mut self, event: GitflowEvent) -> Result<&GitflowState, GitflowError> {
        let new_state = match (&self.state, &event) {
            // Start workflows from Idle
            (GitflowState::Idle, GitflowEvent::StartFeature { name }) => {
                GitflowState::Feature { name: name.clone() }
            }
            (GitflowState::Idle, GitflowEvent::StartRelease { version }) => GitflowState::Release {
                version: version.clone(),
            },
            (GitflowState::Idle, GitflowEvent::StartHotfix { name }) => {
                GitflowState::Hotfix { name: name.clone() }
            }

            // Cannot start new workflow when one is in progress
            (GitflowState::Feature { name }, GitflowEvent::StartRelease { .. }) => {
                return Err(GitflowError::InvalidContext {
                    expected: "Idle".to_string(),
                    actual: format!("Feature({})", name),
                });
            }
            (GitflowState::Release { version }, GitflowEvent::StartFeature { .. }) => {
                return Err(GitflowError::ReleaseInProgress(version.clone()));
            }
            (GitflowState::Hotfix { name }, GitflowEvent::StartFeature { .. }) => {
                return Err(GitflowError::HotfixInProgress(name.clone()));
            }

            // Finish workflows
            (GitflowState::Feature { .. }, GitflowEvent::FinishFeature) => GitflowState::Idle,
            (GitflowState::Release { .. }, GitflowEvent::FinishRelease) => GitflowState::Idle,
            (GitflowState::Hotfix { .. }, GitflowEvent::FinishHotfix) => GitflowState::Idle,

            // Abort any workflow
            (GitflowState::Feature { .. }, GitflowEvent::Abort)
            | (GitflowState::Release { .. }, GitflowEvent::Abort)
            | (GitflowState::Hotfix { .. }, GitflowEvent::Abort) => GitflowState::Idle,

            // Invalid transitions
            (state, event) => {
                return Err(GitflowError::InvalidContext {
                    expected: format!("valid state for {:?}", event),
                    actual: format!("{:?}", state),
                });
            }
        };

        self.state = new_state;
        Ok(&self.state)
    }
}

impl Default for GitflowMachine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_machine_is_idle() {
        let machine = GitflowMachine::new();
        assert_eq!(machine.state(), &GitflowState::Idle);
    }

    #[test]
    fn test_start_feature() {
        let mut machine = GitflowMachine::new();
        let result = machine.handle(GitflowEvent::StartFeature {
            name: "login".to_string(),
        });
        assert!(result.is_ok());
        assert_eq!(
            machine.state(),
            &GitflowState::Feature {
                name: "login".to_string()
            }
        );
    }

    #[test]
    fn test_finish_feature() {
        let mut machine = GitflowMachine::with_state(GitflowState::Feature {
            name: "login".to_string(),
        });
        let result = machine.handle(GitflowEvent::FinishFeature);
        assert!(result.is_ok());
        assert_eq!(machine.state(), &GitflowState::Idle);
    }

    #[test]
    fn test_cannot_start_release_during_feature() {
        let mut machine = GitflowMachine::with_state(GitflowState::Feature {
            name: "login".to_string(),
        });
        let result = machine.handle(GitflowEvent::StartRelease {
            version: "1.0.0".to_string(),
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_abort_feature() {
        let mut machine = GitflowMachine::with_state(GitflowState::Feature {
            name: "login".to_string(),
        });
        let result = machine.handle(GitflowEvent::Abort);
        assert!(result.is_ok());
        assert_eq!(machine.state(), &GitflowState::Idle);
    }

    #[test]
    fn test_can_handle_predicate() {
        let machine = GitflowMachine::new();
        assert!(machine.can_handle(&GitflowEvent::StartFeature {
            name: "test".to_string()
        }));
        assert!(!machine.can_handle(&GitflowEvent::FinishFeature));
    }
}
