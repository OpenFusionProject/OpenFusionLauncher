# OpenFusionLauncher (S.C.A.M.P.E.R.)

OpenFusionClient rewrite with Tauri 2.0, Next.js and React.

## Setup

1. Ensure you have all the required [prerequisites](https://v2.tauri.app/start/prerequisites/) installed
2. Install the Tauri CLI with `cargo install tauri-cli --version "^2.0.0" --locked`
3. Install dependencies with `npm install`

## Dev

Run `cargo tauri dev` to spawn the app. **Hot reload is on, so any changes you make will immediately reflect.**

## Production

Run `cargo tauri build` to build a production binary and any applicable installers or bundles for the current platform. Note that `cargo build --release` will not produce a useful binary as it does not embed the web pages into the application.
