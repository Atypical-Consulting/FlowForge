//! Window chrome integration.
//!
//! Tauri/WebKitGTK draws a GTK client-side title bar on Linux. Under tiling
//! Wayland compositors (Hyprland, sway, river, niri, ...) that bar is dead
//! weight: the compositor owns placement and there is nothing to drag or
//! click. This module detects those environments so the main window can be
//! created without client-side decorations, and exposes commands letting the
//! user override that decision from the settings blade.

/// Environment variables whose mere presence identifies a tiling compositor.
const COMPOSITOR_SOCKET_VARS: &[&str] = &["HYPRLAND_INSTANCE_SIGNATURE", "SWAYSOCK", "NIRI_SOCKET"];

/// Desktop names (lower-case) that identify a tiling window manager in
/// `XDG_CURRENT_DESKTOP` / `XDG_SESSION_DESKTOP`.
const TILING_DESKTOPS: &[&str] = &[
    "hyprland", "sway", "river", "niri", "dwl", "wayfire", "i3", "bspwm", "awesome", "qtile",
    "xmonad",
];

/// Variables holding a colon-separated list of desktop names.
const DESKTOP_LIST_VARS: &[&str] = &["XDG_CURRENT_DESKTOP", "XDG_SESSION_DESKTOP"];

/// Decide, from the environment alone, whether the running session is a
/// tiling compositor that draws (or deliberately omits) its own window
/// decorations, in which case client-side decorations should be hidden.
///
/// `env` abstracts `std::env::var` so the logic is unit-testable and
/// platform-independent; the platform gate lives in [`should_hide_decorations`].
pub fn prefers_server_side_decorations(env: impl Fn(&str) -> Option<String>) -> bool {
    if COMPOSITOR_SOCKET_VARS
        .iter()
        .any(|var| env(var).is_some_and(|value| !value.trim().is_empty()))
    {
        return true;
    }

    DESKTOP_LIST_VARS.iter().any(|var| {
        env(var).is_some_and(|value| {
            value
                .split(':')
                .map(|entry| entry.trim().to_ascii_lowercase())
                .any(|entry| TILING_DESKTOPS.contains(&entry.as_str()))
        })
    })
}

/// Whether the main window should start without client-side decorations on
/// this machine. Always `false` outside Linux: macOS and Windows keep their
/// native chrome.
pub fn should_hide_decorations() -> bool {
    if cfg!(target_os = "linux") {
        prefers_server_side_decorations(|name| std::env::var(name).ok())
    } else {
        false
    }
}

/// Apply the automatic decision to the main window at startup.
pub fn apply_startup_decorations(window: &tauri::WebviewWindow) {
    let hide = should_hide_decorations();
    println!(
        "[info] window decorations: {} (tiling compositor detected: {})",
        if hide { "hidden" } else { "shown" },
        hide
    );
    if hide
        && let Err(e) = window.set_decorations(false)
    {
        eprintln!("[warn] failed to hide window decorations: {e}");
    }
}

/// Show or hide the client-side decorations of the calling window.
///
/// Backs the `window.decorations` preference: `"always"` sends `true`,
/// `"never"` sends `false`, and `"auto"` sends whatever
/// [`get_default_window_decorations`] returns.
#[tauri::command]
#[specta::specta]
pub fn set_window_decorations(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    window.set_decorations(enabled).map_err(|e| e.to_string())
}

/// The decoration state the runtime detection picks on this machine
/// (`true` = decorations shown). Lets the frontend restore the automatic
/// behaviour when the user switches the preference back to `"auto"`.
#[tauri::command]
#[specta::specta]
pub fn get_default_window_decorations() -> bool {
    !should_hide_decorations()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn env_of(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> + use<> {
        let map: HashMap<String, String> = pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        move |name: &str| map.get(name).cloned()
    }

    #[test]
    fn empty_environment_keeps_decorations() {
        assert!(!prefers_server_side_decorations(|_| None));
    }

    #[test]
    fn hyprland_instance_signature_hides_decorations() {
        let env = env_of(&[("HYPRLAND_INSTANCE_SIGNATURE", "abc123_1700000000")]);
        assert!(prefers_server_side_decorations(env));
    }

    #[test]
    fn sway_socket_hides_decorations() {
        let env = env_of(&[("SWAYSOCK", "/run/user/1000/sway-ipc.1000.42.sock")]);
        assert!(prefers_server_side_decorations(env));
    }

    #[test]
    fn niri_socket_hides_decorations() {
        let env = env_of(&[("NIRI_SOCKET", "/run/user/1000/niri.sock")]);
        assert!(prefers_server_side_decorations(env));
    }

    #[test]
    fn empty_socket_variable_is_ignored() {
        let env = env_of(&[("SWAYSOCK", "   ")]);
        assert!(!prefers_server_side_decorations(env));
    }

    #[test]
    fn xdg_current_desktop_hyprland_hides_decorations() {
        let env = env_of(&[("XDG_CURRENT_DESKTOP", "Hyprland")]);
        assert!(prefers_server_side_decorations(env));
    }

    #[test]
    fn xdg_desktop_matching_is_case_insensitive_and_list_aware() {
        let env = env_of(&[("XDG_CURRENT_DESKTOP", "ubuntu:SWAY")]);
        assert!(prefers_server_side_decorations(env));
        let env = env_of(&[("XDG_SESSION_DESKTOP", "River")]);
        assert!(prefers_server_side_decorations(env));
    }

    #[test]
    fn every_known_tiling_desktop_hides_decorations() {
        for name in TILING_DESKTOPS {
            let env = env_of(&[("XDG_CURRENT_DESKTOP", name)]);
            assert!(
                prefers_server_side_decorations(env),
                "{name} should hide decorations"
            );
        }
    }

    #[test]
    fn gnome_keeps_decorations() {
        let env = env_of(&[("XDG_CURRENT_DESKTOP", "GNOME"), ("XDG_SESSION_DESKTOP", "gnome")]);
        assert!(!prefers_server_side_decorations(env));
        let env = env_of(&[("XDG_CURRENT_DESKTOP", "ubuntu:GNOME")]);
        assert!(!prefers_server_side_decorations(env));
    }

    #[test]
    fn substring_matches_do_not_count() {
        // "i3" must match as a whole entry, not inside another desktop name.
        let env = env_of(&[("XDG_CURRENT_DESKTOP", "mini3d")]);
        assert!(!prefers_server_side_decorations(env));
    }

    #[cfg(not(target_os = "linux"))]
    #[test]
    fn non_linux_never_hides_decorations() {
        assert!(!should_hide_decorations());
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_default_matches_pure_detection() {
        assert_eq!(
            should_hide_decorations(),
            prefers_server_side_decorations(|name| std::env::var(name).ok())
        );
    }
}
