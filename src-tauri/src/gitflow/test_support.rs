//! Shared helpers for Gitflow unit tests (temporary git2 repositories).

use git2::Repository;
use tempfile::TempDir;

/// Create a fresh repository with an initial commit on `main` and a deterministic
/// signature so commits/merges succeed without relying on a global git config.
pub fn init_repo() -> (TempDir, Repository) {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    {
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@example.com").unwrap();
    }
    // Point HEAD at an unborn `main` so the initial commit lands on `main`
    // regardless of the system's configured default branch name.
    repo.set_head("refs/heads/main").unwrap();
    let sig = repo.signature().unwrap();
    let tree_oid = {
        let mut index = repo.index().unwrap();
        index.write_tree().unwrap()
    };
    {
        let tree = repo.find_tree(tree_oid).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "initial", &tree, &[])
            .unwrap();
    }
    (dir, repo)
}

/// Write `contents` to `name` inside the working tree (no staging).
pub fn write_file(repo: &Repository, name: &str, contents: &str) {
    let workdir = repo.workdir().unwrap().to_path_buf();
    std::fs::write(workdir.join(name), contents).unwrap();
}

/// Read `name` from the working tree.
pub fn read_file(repo: &Repository, name: &str) -> String {
    let workdir = repo.workdir().unwrap().to_path_buf();
    std::fs::read_to_string(workdir.join(name)).unwrap()
}

/// Stage `name` (must already exist in the working tree).
pub fn stage_file(repo: &Repository, name: &str) {
    let mut index = repo.index().unwrap();
    index.add_path(std::path::Path::new(name)).unwrap();
    index.write().unwrap();
}

/// Add and commit a file with the given contents on the current HEAD.
pub fn commit_file(repo: &Repository, name: &str, contents: &str, msg: &str) -> git2::Oid {
    write_file(repo, name, contents);
    stage_file(repo, name);
    let sig = repo.signature().unwrap();
    let mut index = repo.index().unwrap();
    let tree_oid = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_oid).unwrap();
    let parent = repo.head().unwrap().peel_to_commit().unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &[&parent])
        .unwrap()
}

/// Create `branch` at the current HEAD and switch to it (safe checkout).
pub fn create_and_checkout(repo: &Repository, branch: &str) {
    let head = repo.head().unwrap().peel_to_commit().unwrap();
    repo.branch(branch, &head, false).unwrap();
    crate::gitflow::checkout::checkout_branch_safe(repo, branch).unwrap();
}

/// Switch to an existing branch (safe checkout).
pub fn checkout(repo: &Repository, branch: &str) {
    crate::gitflow::checkout::checkout_branch_safe(repo, branch).unwrap();
}

/// Current branch shorthand.
pub fn current_branch(repo: &Repository) -> String {
    repo.head().unwrap().shorthand().unwrap().to_string()
}

/// Whether `name` has a staged (index) modification and/or an unstaged
/// (working tree) modification, as `(staged, unstaged)`.
pub fn modification_state(repo: &Repository, name: &str) -> (bool, bool) {
    let statuses = repo.statuses(None).unwrap();
    statuses
        .iter()
        .find(|s| s.path().ok() == Some(name))
        .map(|s| {
            let st = s.status();
            (
                st.is_index_modified() || st.is_index_new(),
                st.is_wt_modified() || st.is_wt_new(),
            )
        })
        .unwrap_or((false, false))
}
