mod git;
mod gitflow;

use git::{
    branch::{checkout_branch, create_branch, delete_branch, list_branches},
    commands::{close_repository, get_repository_status, is_git_repository, open_repository},
    commit::create_commit,
    diff::get_file_diff,
    history::{get_commit_details, get_commit_history},
    merge::{abort_merge, get_merge_status, merge_branch},
    remote::{fetch_from_remote, get_remotes, pull_from_remote, push_to_remote},
    staging::{get_staging_status, stage_all, stage_file, unstage_all, unstage_file},
    stash::{list_stashes, stash_apply, stash_drop, stash_pop, stash_save},
    tag::{create_tag, delete_tag, list_tags},
    RepositoryState,
};
use gitflow::{
    abort_gitflow, finish_feature, finish_hotfix, finish_release, get_gitflow_status,
    start_feature, start_hotfix, start_release,
};
use specta_typescript::Typescript;
use tauri::Manager;
use tauri_specta::{collect_commands, Builder};

#[tauri::command]
#[specta::specta]
async fn greet(name: String) -> String {
    format!("Hello, {}! Welcome to FlowForge.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        greet,
        // Repository commands
        open_repository,
        get_repository_status,
        is_git_repository,
        close_repository,
        // Staging commands
        get_staging_status,
        stage_file,
        unstage_file,
        stage_all,
        unstage_all,
        // Diff commands
        get_file_diff,
        // Commit commands
        create_commit,
        // History commands
        get_commit_history,
        get_commit_details,
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
        start_feature,
        finish_feature,
        start_release,
        finish_release,
        start_hotfix,
        finish_hotfix,
        get_gitflow_status,
        abort_gitflow,
    ]);

    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("Failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .manage(RepositoryState::new())
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
