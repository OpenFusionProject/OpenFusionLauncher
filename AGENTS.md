# AGENTS

## Overview
This repository contains **OpenFusionLauncher**, a desktop launcher built with a Next.js/React front‑end and a Rust backend running on [Tauri 2.0](https://tauri.app/).

* Front‑end code lives in the `app/` directory and uses TypeScript, SCSS and React‑Bootstrap.
* Backend logic lives under `src-tauri/` and is written in Rust (edition 2021).

## Development
- Requires Node.js 20+ and a recent Rust toolchain (see `src-tauri/Cargo.toml`).
- Use React functional components and TypeScript for UI code.
- `src-tauri` is built as a Tauri application; commands are defined as async functions with `#[tauri::command]`.

## Verification
Run these commands from the repository root before committing:

```bash
npm run lint             # TypeScript/React linting
cargo test --manifest-path src-tauri/Cargo.toml  # Rust tests (none currently)
```

`cargo test` will build the Rust backend and run any available tests.
