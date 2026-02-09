mod git;
mod gitflow;

use std::sync::Mutex;

use git::{
    RepositoryState, WatcherState,
    branch::{
        batch_delete_branches, checkout_branch, checkout_remote_branch, create_branch,
        delete_branch, get_recent_checkouts, list_all_branches, list_branches,
    },
    browse::{list_repo_files, read_repo_file},
    changelog::generate_changelog_cmd,
    clone::clone_repository,
    commands::{close_repository, get_repository_status, is_git_repository, open_repository},
    config::{get_git_global_config, set_git_global_config},
    commit::{create_commit, get_last_commit_message},
    conventional::{
        get_scope_suggestions, infer_scope_from_staged, suggest_commit_type,
        validate_conventional_commit,
    },
    diff::{get_commit_file_base64, get_commit_file_diff, get_file_base64, get_file_diff},
    gitignore::{
        detect_project_type, get_gitignore_template, list_gitignore_templates, write_init_files,
    },
    init::git_init,
    graph::get_commit_graph,
    history::{get_commit_details, get_commit_history, search_commits},
    merge::{abort_merge, get_merge_status, merge_branch},
    remote::{fetch_from_remote, get_remotes, pull_from_remote, push_to_remote},
    staging::{
        get_staging_status, stage_all, stage_file, stage_files, unstage_all, unstage_file,
        unstage_files,
    },
    stash::{list_stashes, stash_apply, stash_drop, stash_pop, stash_save},
    tag::{create_tag, delete_tag, list_tags},
    undo::{get_undo_info, undo_last_operation},
    worktree::{create_worktree, delete_worktree, list_worktrees},
};
use gitflow::{
    abort_gitflow, finish_feature, finish_hotfix, finish_release, get_gitflow_status, init_gitflow,
    start_feature, start_hotfix, start_release,
};
use specta_typescript::Typescript;
use tauri::Manager;
use tauri_specta::{Builder, collect_commands};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        // Repository commands
        open_repository,
        get_repository_status,
        is_git_repository,
        close_repository,
        // Staging commands
        get_staging_status,
        stage_file,
        unstage_file,
        stage_files,
        unstage_files,
        stage_all,
        unstage_all,
        // Diff commands
        get_file_diff,
        get_commit_file_diff,
        get_file_base64,
        get_commit_file_base64,
        // Commit commands
        create_commit,
        get_last_commit_message,
        // History commands
        get_commit_history,
        get_commit_details,
        search_commits,
        // Graph commands
        get_commit_graph,
        // Remote commands
        get_remotes,
        fetch_from_remote,
        push_to_remote,
        pull_from_remote,
        // Branch commands
        list_branches,
        create_branch,
        checkout_branch,
        delete_branch,
        list_all_branches,
        checkout_remote_branch,
        batch_delete_branches,
        get_recent_checkouts,
        // Stash commands
        list_stashes,
        stash_save,
        stash_apply,
        stash_pop,
        stash_drop,
        // Tag commands
        list_tags,
        create_tag,
        delete_tag,
        // Merge commands
        merge_branch,
        get_merge_status,
        abort_merge,
        // Gitflow commands
        init_gitflow,
        start_feature,
        finish_feature,
        start_release,
        finish_release,
        start_hotfix,
        finish_hotfix,
        get_gitflow_status,
        abort_gitflow,
        // Conventional commit commands
        validate_conventional_commit,
        suggest_commit_type,
        get_scope_suggestions,
        infer_scope_from_staged,
        generate_changelog_cmd,
        // Worktree commands
        list_worktrees,
        create_worktree,
        delete_worktree,
        // Undo commands
        get_undo_info,
        undo_last_operation,
        // Clone commands
        clone_repository,
        // Init commands
        git_init,
        // Gitignore commands
        list_gitignore_templates,
        get_gitignore_template,
        detect_project_type,
        write_init_files,
        // Browse commands
        list_repo_files,
        read_repo_file,
        // Config commands
        get_git_global_config,
        set_git_global_config,
    ]);

    #[cfg(debug_assertions)]
    {
        builder
            .export(Typescript::default(), "../src/bindings.ts")
            .expect("Failed to export TypeScript bindings");

        // Fix tauri-specta bug: generated `export type TAURI_CHANNEL<TSend> = null`
        // conflicts with the `Channel as TAURI_CHANNEL` import it also generates.
        let bindings_path = std::path::Path::new("../src/bindings.ts");
        if let Ok(content) = std::fs::read_to_string(bindings_path) {
            let fixed = content.replace("export type TAURI_CHANNEL<TSend> = null\n", "");
            std::fs::write(bindings_path, fixed).ok();
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .manage(RepositoryState::new())
        .manage(Mutex::new(WatcherState::new()))
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);

            // Show window after setup to prevent flash
            if let Some(window) = app.get_webview_window("main") {
                window.show().ok();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
