//! Safe branch-switching helpers shared by the Gitflow commands.
//!
//! Every Gitflow operation that moves HEAD goes through [`checkout_branch_safe`],
//! which never forces the working tree. A forced checkout silently discards
//! staged and unstaged modifications, which is never acceptable for a user
//! action that is not explicitly "discard my work".

use git2::{BranchType, ErrorCode, Repository};

use crate::gitflow::error::GitflowError;
use crate::gitflow::state::get_current_branch_name;

/// Switch HEAD to the local branch `branch` without discarding local changes.
///
/// - If `branch` is already checked out, nothing is touched and `Ok(false)` is
///   returned.
/// - Otherwise the working tree and index are updated with a *safe* checkout
///   (`git checkout <branch>` semantics): local modifications that do not
///   overlap with the differences between the two branches are carried over,
///   and any modification that would have to be overwritten aborts the switch
///   with [`GitflowError::CheckoutWouldOverwriteChanges`] before HEAD is moved.
/// - Returns `Ok(true)` once HEAD points at `branch`.
///
/// The working tree is updated *before* HEAD is moved so that a refused
/// checkout leaves the repository exactly as it was (HEAD, index and working
/// tree all still consistent with the previous branch).
pub fn checkout_branch_safe(repo: &Repository, branch: &str) -> Result<bool, GitflowError> {
    if get_current_branch_name(repo)?.as_deref() == Some(branch) {
        return Ok(false);
    }

    let commit = repo
        .find_branch(branch, BranchType::Local)
        .map_err(|_| GitflowError::BranchNotFound(branch.to_string()))?
        .get()
        .peel_to_commit()?;

    repo.checkout_tree(
        commit.as_object(),
        Some(git2::build::CheckoutBuilder::new().safe()),
    )
    .map_err(|e| {
        let msg = e.message();
        if e.code() == ErrorCode::Conflict
            || msg.contains("conflict")
            || msg.contains("overwrite")
        {
            GitflowError::CheckoutWouldOverwriteChanges(branch.to_string())
        } else {
            GitflowError::from(e)
        }
    })?;

    repo.set_head(&format!("refs/heads/{}", branch))?;
    Ok(true)
}

/// Check that the working tree has no staged or unstaged changes to tracked
/// files. Untracked and ignored files are allowed.
///
/// Returns `Err(DirtyWorkingTree)` when there is anything a merge or reset
/// could clobber.
pub fn ensure_clean_working_tree(repo: &Repository) -> Result<(), GitflowError> {
    let statuses = repo.statuses(Some(
        git2::StatusOptions::new()
            .include_untracked(false)
            .include_ignored(false),
    ))?;
    if !statuses.is_empty() {
        return Err(GitflowError::DirtyWorkingTree);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gitflow::test_support::{commit_file, init_repo, read_file, write_file};

    #[test]
    fn already_on_branch_is_a_noop_and_keeps_changes() {
        let (_dir, repo) = init_repo();
        commit_file(&repo, "a.txt", "one\n", "add a");

        // Stage one change and leave another unstaged on top of it.
        write_file(&repo, "a.txt", "one\nstaged\n");
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("a.txt")).unwrap();
        index.write().unwrap();
        write_file(&repo, "a.txt", "one\nstaged\nunstaged\n");

        let switched = checkout_branch_safe(&repo, "main").unwrap();
        assert!(!switched, "checking out the current branch must be a no-op");
        assert_eq!(read_file(&repo, "a.txt"), "one\nstaged\nunstaged\n");
        let statuses = repo.statuses(None).unwrap();
        let st = statuses
            .iter()
            .find(|s| s.path().ok() == Some("a.txt"))
            .unwrap();
        assert!(st.status().is_index_modified(), "staged change must survive");
        assert!(st.status().is_wt_modified(), "unstaged change must survive");
    }

    #[test]
    fn conflicting_local_change_is_refused_and_preserved() {
        let (_dir, repo) = init_repo();
        commit_file(&repo, "a.txt", "main\n", "add a on main");
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("other", &head, false).unwrap();
        assert!(checkout_branch_safe(&repo, "other").unwrap());
        commit_file(&repo, "a.txt", "other\n", "change a on other");
        assert!(checkout_branch_safe(&repo, "main").unwrap());

        // Local (unstaged) modification to a file that differs between the branches.
        write_file(&repo, "a.txt", "main\nlocal work\n");

        let err = checkout_branch_safe(&repo, "other").unwrap_err();
        assert!(
            matches!(err, GitflowError::CheckoutWouldOverwriteChanges(ref b) if b == "other"),
            "expected CheckoutWouldOverwriteChanges, got {err:?}"
        );
        assert_eq!(read_file(&repo, "a.txt"), "main\nlocal work\n");
        assert_eq!(
            repo.head().unwrap().shorthand().unwrap(),
            "main",
            "HEAD must not move when the checkout is refused"
        );
    }

    #[test]
    fn non_overlapping_local_change_is_carried_over() {
        let (_dir, repo) = init_repo();
        commit_file(&repo, "a.txt", "a\n", "add a");
        commit_file(&repo, "b.txt", "b\n", "add b");
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("other", &head, false).unwrap();
        assert!(checkout_branch_safe(&repo, "other").unwrap());
        commit_file(&repo, "a.txt", "a on other\n", "change a");
        assert!(checkout_branch_safe(&repo, "main").unwrap());

        // b.txt is identical on both branches, so editing it must not block the switch.
        write_file(&repo, "b.txt", "b edited\n");
        assert!(checkout_branch_safe(&repo, "other").unwrap());
        assert_eq!(repo.head().unwrap().shorthand().unwrap(), "other");
        assert_eq!(read_file(&repo, "b.txt"), "b edited\n");
        assert_eq!(read_file(&repo, "a.txt"), "a on other\n");
    }

    #[test]
    fn missing_branch_is_reported() {
        let (_dir, repo) = init_repo();
        let err = checkout_branch_safe(&repo, "nope").unwrap_err();
        assert!(matches!(err, GitflowError::BranchNotFound(ref b) if b == "nope"));
    }

    #[test]
    fn ensure_clean_ignores_untracked_but_not_staged() {
        let (_dir, repo) = init_repo();
        write_file(&repo, "notes.txt", "untracked\n");
        assert!(ensure_clean_working_tree(&repo).is_ok());

        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("notes.txt")).unwrap();
        index.write().unwrap();
        assert!(matches!(
            ensure_clean_working_tree(&repo),
            Err(GitflowError::DirtyWorkingTree)
        ));
    }
}
