mod state;
mod util;

use state::{get_app_statics, AppState, Server, Servers, Version};

use std::{path::PathBuf, sync::Mutex};

use log::*;
use tauri::Manager;
use uuid::Uuid;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;
type CommandResult = std::result::Result<(), String>;

fn save_app_state(app_handle: &tauri::AppHandle) {
    let app_state = app_handle.state::<Mutex<AppState>>();
    let app_state = app_state.lock().unwrap();
    app_state.save();
}

#[tauri::command]
fn get_servers(state: tauri::State<Mutex<AppState>>) -> Servers {
    match state.lock() {
        Ok(state) => state.servers.clone(),
        Err(e) => {
            error!("Failed to lock app state: {}", e);
            Servers::default()
        }
    }
}

fn get_assets_dir() -> Result<PathBuf> {
    let assets_dir = get_app_statics().app_data_dir.join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir(&assets_dir)?;
    }
    Ok(assets_dir)
}

fn configure_for_server(server: &Server) -> Result<()> {
    let assets_dir = get_assets_dir()?;

    // endpoint-specific stuff
    let rankurl_path = assets_dir.join("rankurl.txt");
    let images_path = assets_dir.join("images.php");
    let sponsor_path = assets_dir.join("sponsor.php");

    if let Some(endpoint) = &server.endpoint {
        let endpoint = endpoint.trim_end_matches('/');

        // rankurl.txt
        let rankurl_contents = format!("http://{}/getranks", endpoint);
        std::fs::write(rankurl_path, rankurl_contents.as_bytes())?;

        // images.php
        let images_contents = format!("http://{}/upsell/", endpoint);
        std::fs::write(images_path, images_contents.as_bytes())?;

        // sponsor.php
        let sponsor_contents = format!("http://{}/upsell/sponsor.png", endpoint);
        std::fs::write(sponsor_path, sponsor_contents.as_bytes())?;
    } else {
        // remove endpoint-specific files
        std::fs::remove_file(rankurl_path).ok();
        std::fs::remove_file(images_path).ok();
        std::fs::remove_file(sponsor_path).ok();
    }
    Ok(())
}

fn configure_for_version(version: &Version) -> Result<()> {
    let assets_dir = get_assets_dir()?;
    let asset_info_path = assets_dir.join("assetInfo.php");
    std::fs::write(asset_info_path, version.url.as_bytes())?;
    Ok(())
}

fn connect_to_server_internal(app_handle: tauri::AppHandle, uuid: String) -> Result<()> {
    let uuid = Uuid::parse_str(&uuid)?;
    let app_state = app_handle.state::<Mutex<AppState>>();
    let app_state = app_state.lock().unwrap();
    let server = app_state
        .servers
        .get_entry(uuid)
        .ok_or(format!("Server {} not found", uuid))?;
    configure_for_server(server)?;

    let version_name = &server.version;
    let version = app_state
        .versions
        .get_entry(version_name)
        .ok_or(format!("Version {} not found", version_name))?;
    configure_for_version(version)?;

    Ok(())
}

#[tauri::command]
fn connect_to_server(app_handle: tauri::AppHandle, uuid: String) -> CommandResult {
    debug!("connect_to_server {}", uuid);
    connect_to_server_internal(app_handle, uuid).map_err(|e| e.to_string())
}

#[allow(clippy::single_match)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    #[cfg(debug_assertions)]
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                    #[cfg(not(debug_assertions))]
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            state::init_app_statics(app);
            // N.B. AppState::load depends on APP_STATICS
            let app_state = AppState::load();
            app.manage(Mutex::new(app_state));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_servers, connect_to_server])
        .build(tauri::generate_context![])
        .unwrap()
        .run(|app_handle, event| match event {
            tauri::RunEvent::Exit { .. } => save_app_state(app_handle),
            _ => {}
        });
}
