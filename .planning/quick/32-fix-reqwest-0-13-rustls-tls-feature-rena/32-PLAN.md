# Quick Task 032: Fix reqwest 0.13 rustls-tls feature rename breaking Rust build

## Task

The dependabot PR #10 bumped reqwest from 0.12 to 0.13. In reqwest 0.13, the `rustls-tls` feature was renamed to `rustls`. This breaks `cargo build`.

## Steps

1. Update `src-tauri/Cargo.toml`: change `rustls-tls` to `rustls` in reqwest features
2. Verify `cargo check` passes
3. Commit and push
