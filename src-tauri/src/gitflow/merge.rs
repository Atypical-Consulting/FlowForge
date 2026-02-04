//! No-fast-forward merge implementation for Gitflow.

use git2::{BranchType, Oid, Repository};

use crate::gitflow::error::GitflowError;

/// Merge source branch into target branch, always creating a merge commit (--no-ff behavior).
///
/// This function implements the --no-ff merge behavior that git2-rs doesn't directly support.
/// It always creates a merge commit with two parents, even when a fast-forward would be possible.
pub fn merge_no_ff(
    repo: &Repository,
    source_branch: &str,
    target_branch: &str,
    message: &str,
) -> Result<Oid, GitflowError> {
    // 1. Get source commit
    let source = repo
        .find_branch(source_branch, BranchType::Local)?
        .get()
        .peel_to_commit()?;

    // 2. Checkout target branch
    let target_ref = format!("refs/heads/{}", target_branch);
    repo.set_head(&target_ref)?;
    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;

    // 3. Get target commit (now HEAD)
    let target = repo.head()?.peel_to_commit()?;

    // 4. Get annotated commit for merge analysis
    let annotated = repo.find_annotated_commit(source.id())?;

    // 5. Run merge analysis
    let (analysis, _) = repo.merge_analysis(&[&annotated])?;

    if analysis.is_up_to_date() {
        return Ok(target.id());
    }

    if analysis.is_unborn() {
        return Err(GitflowError::UnbornHead);
    }

    // 6. Perform merge (this stages changes into index)
    repo.merge(&[&annotated], None, None)?;

    // 7. Check for conflicts
    let index = repo.index()?;
    if index.has_conflicts() {
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
