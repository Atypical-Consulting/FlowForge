//! No-fast-forward merge implementation for Gitflow.

use git2::{BranchType, Oid, Repository};

use crate::gitflow::checkout::{checkout_branch_safe, ensure_clean_working_tree};
use crate::gitflow::error::GitflowError;

/// Merge source branch into target branch, always creating a merge commit (--no-ff behavior).
///
/// This function implements the --no-ff merge behavior that git2-rs doesn't directly support.
/// It always creates a merge commit with two parents, even when a fast-forward would be possible.
///
/// The working tree must be clean (no staged or unstaged changes to tracked
/// files); otherwise [`GitflowError::DirtyWorkingTree`] is returned before
/// anything is touched. Switching to the target branch uses a safe checkout,
/// so local work is never discarded. If the merge produces conflicts, the
/// target branch is restored to its pre-merge state (which is known to be
/// clean) and [`GitflowError::MergeConflict`] is returned.
pub fn merge_no_ff(
    repo: &Repository,
    source_branch: &str,
    target_branch: &str,
    message: &str,
) -> Result<Oid, GitflowError> {
    // 0. Refuse to run on a dirty tree: the conflict rollback below resets the
    //    working tree, which is only safe when there is nothing of the user's
    //    to lose.
    ensure_clean_working_tree(repo)?;

    // 1. Get source commit
    let source = repo
        .find_branch(source_branch, BranchType::Local)?
        .get()
        .peel_to_commit()?;

    // 2. Checkout target branch (safe: never overwrites local changes; no-op if
    //    already on it)
    checkout_branch_safe(repo, target_branch)?;

    // 3. Get target commit (now HEAD)
    let target = repo.head()?.peel_to_commit()?;

    // 4. Get annotated commit for merge analysis
    let annotated = repo.find_annotated_commit(source.id())?;

    // 5. Run merge analysis
    let (analysis, _) = repo.merge_analysis(&[&annotated])?;

    if analysis.is_up_to_date() {
        // Even when up-to-date, create a merge commit (true --no-ff behavior)
        let tree_oid = repo.index()?.write_tree()?;
        let tree = repo.find_tree(tree_oid)?;
        let sig = repo.signature()?;
        let commit_oid = repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            message,
            &tree,
            &[&target, &source],
        )?;
        return Ok(commit_oid);
    }

    if analysis.is_unborn() {
        return Err(GitflowError::UnbornHead);
    }

    // 6. Perform merge (this stages changes into index)
    repo.merge(&[&annotated], None, None)?;

    // 7. Check for conflicts
    let index = repo.index()?;
    if index.has_conflicts() {
        // Clean up merge state so repo isn't left in MERGING state
        repo.cleanup_state()?;
        // Restore index and working tree to the target commit, discarding only
        // what the merge itself produced (the tree was verified clean above).
        // A forced checkout alone would leave conflict entries in the index.
        repo.reset(target.as_object(), git2::ResetType::Hard, None)?;
        return Err(GitflowError::MergeConflict);
    }

    // 8. Create merge commit with two parents (--no-ff behavior)
    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;
    let sig = repo.signature()?;

    let commit_oid = repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        message,
        &tree,
        &[&target, &source],
    )?;

    // 9. Clean up merge state
    repo.cleanup_state()?;

    Ok(commit_oid)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gitflow::test_support::{
        checkout, commit_file, create_and_checkout, current_branch, init_repo,
        modification_state, read_file, stage_file, write_file,
    };

    #[test]
    fn merge_creates_merge_commit_with_two_parents() {
        let (_dir, repo) = init_repo();
        create_and_checkout(&repo, "develop");
        create_and_checkout(&repo, "feature/x");
        commit_file(&repo, "f.txt", "feature\n", "feature work");

        let oid = merge_no_ff(&repo, "feature/x", "develop", "Merge feature/x").unwrap();
        let commit = repo.find_commit(oid).unwrap();
        assert_eq!(commit.parent_count(), 2);
        assert_eq!(current_branch(&repo), "develop");
        assert_eq!(read_file(&repo, "f.txt"), "feature\n");
    }

    #[test]
    fn merge_refuses_dirty_tree_and_keeps_changes() {
        let (_dir, repo) = init_repo();
        commit_file(&repo, "a.txt", "a\n", "add a");
        create_and_checkout(&repo, "develop");
        create_and_checkout(&repo, "feature/x");
        commit_file(&repo, "f.txt", "feature\n", "feature work");

        write_file(&repo, "a.txt", "a\nwip\n");
        stage_file(&repo, "a.txt");
        write_file(&repo, "a.txt", "a\nwip\nmore\n");

        let err = merge_no_ff(&repo, "feature/x", "develop", "Merge").unwrap_err();
        assert!(matches!(err, GitflowError::DirtyWorkingTree), "got {err:?}");
        assert_eq!(current_branch(&repo), "feature/x");
        assert_eq!(read_file(&repo, "a.txt"), "a\nwip\nmore\n");
        assert_eq!(modification_state(&repo, "a.txt"), (true, true));
    }

    #[test]
    fn merge_refuses_to_clobber_untracked_file_present_on_target() {
        let (_dir, repo) = init_repo();
        create_and_checkout(&repo, "develop");
        commit_file(&repo, "notes.txt", "committed on develop\n", "notes");
        checkout(&repo, "main");
        create_and_checkout(&repo, "feature/x");
        commit_file(&repo, "f.txt", "feature\n", "feature work");

        // Untracked file that would be overwritten by checking out develop.
        write_file(&repo, "notes.txt", "my precious untracked notes\n");

        let err = merge_no_ff(&repo, "feature/x", "develop", "Merge").unwrap_err();
        assert!(
            matches!(err, GitflowError::CheckoutWouldOverwriteChanges(ref b) if b == "develop"),
            "got {err:?}"
        );
        assert_eq!(current_branch(&repo), "feature/x");
        assert_eq!(read_file(&repo, "notes.txt"), "my precious untracked notes\n");
    }

    #[test]
    fn conflicting_merge_is_rolled_back_to_clean_target() {
        let (_dir, repo) = init_repo();
        commit_file(&repo, "shared.txt", "base\n", "base");
        create_and_checkout(&repo, "develop");
        commit_file(&repo, "shared.txt", "develop\n", "develop edit");
        checkout(&repo, "main");
        create_and_checkout(&repo, "feature/x");
        commit_file(&repo, "shared.txt", "feature\n", "feature edit");

        let err = merge_no_ff(&repo, "feature/x", "develop", "Merge").unwrap_err();
        assert!(matches!(err, GitflowError::MergeConflict), "got {err:?}");
        assert_eq!(repo.state(), git2::RepositoryState::Clean);
        assert!(!repo.index().unwrap().has_conflicts());
        assert_eq!(current_branch(&repo), "develop");
        assert_eq!(read_file(&repo, "shared.txt"), "develop\n");
        assert!(ensure_clean_working_tree(&repo).is_ok());
    }
}
