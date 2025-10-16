# OpenFusionLauncher (S.C.A.M.P.E.R.)

OpenFusionClient rewrite with Tauri 2.0, Next.js and React.

## Setup

### Setup development environment

1. Ensure you have all the required [prerequisites](https://v2.tauri.app/start/prerequisites/) installed
2. Install the Tauri CLI with `cargo install tauri-cli --version "^2.0.0" --locked`
3. Install dependencies with `npm install`

### Setup required assets

#### Setup all assets in one go

1. Open the latest workflow at <https://github.com/OpenFusionProject/OpenFusionLauncher/actions>
2. Download the artifact named `ffrunner-mingw`
3. Copy contents to `resources/ffrunner`

#### Setup assets separately

1. FFRunner binary
   1. To build locally on Ubuntu
      1. run `sudo apt update && sudo apt install -y gcc-mingw-w64-i686 wget`
      2. run `make -C resources/ffrunner`
   2. Can't build locally? Consider a prebuilt binary
      1. Open the latest workflow at <https://github.com/OpenFusionProject/ffrunner/actions>
      2. Download the artifact named `ffrunner`
      3. Copy contents to `resources/ffrunner`
2. Webplayer DLLs
   1. run `wget -r -l 7 -np -R "index.html*" -nH --cut-dirs=2 https://cdn.dexlabs.systems/webplayer/patched-latest/ -P resources/ffrunner/`
3. Vulkan wrapper DLL
   1. run `wget https://github.com/doitsujin/dxvk/releases/download/v1.10.3/dxvk-1.10.3.tar.gz`
   2. run `tar -xvf dxvk-1.10.3.tar.gz`
   3. run `mv dxvk-1.10.3/x32/d3d9.dll resources/ffrunner/d3d9_vulkan.dll`

## Development

Run `cargo tauri dev` to spawn the app. **Hot reload is on, so any changes you make will immediately reflect.**

## Production

Run `cargo tauri build` to build a production binary and any applicable installers or bundles for the current platform.
