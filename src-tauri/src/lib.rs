mod state;
mod util;

use serde::Serialize;
use state::{get_app_statics, AppState, Server, Servers, Version};

use std::{path::PathBuf, sync::Mutex};

use log::*;
use tauri::Manager;
use uuid::Uuid;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;
type CommandResult<T> = std::result::Result<T, String>;

#[derive(Debug, Serialize)]
struct ImportCounts {
    version_count: usize,
    server_count: usize,
}

fn save_app_state(app_handle: &tauri::AppHandle) {
    let app_state = app_handle.state::<Mutex<AppState>>();
    let app_state = app_state.lock().unwrap();
    app_state.save();
}

fn get_assets_dir() -> Result<PathBuf> {
    let assets_dir = get_app_statics().app_data_dir.join("assets");
    if !assets_dir.exists() {
        Err("Assets directory does not exist".into())
    } else {
        Ok(assets_dir)
    }
}

fn configure_for_server(server: &Server) -> Result<()> {
    let assets_dir = get_assets_dir()?;

    let login_info_path = assets_dir.join("loginInfo.php");
    // if the address is not already an IP, resolve it.
    // whether it's an IP or not, it will have :PORT appended to it
    let addr = server.ip.clone();
    debug!("Server address is {}", addr);
    let (mut addr, port) = util::split_addr_port(&addr)?;
    if addr.parse::<std::net::IpAddr>().is_err() {
        addr = util::resolve_host(&addr)?;
        debug!("Resolved server hostname to {}", addr);
    }
    let login_info_contents = format!("{}:{}", addr, port);
    std::fs::write(login_info_path, login_info_contents.as_bytes())?;

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

fn import_from_openfusionclient_internal(
    state: tauri::State<Mutex<AppState>>,
) -> Result<ImportCounts> {
    let mut app_state = state.lock().unwrap();
    let version_count = app_state.import_versions()?;
    let server_count = app_state.import_servers()?;
    app_state.save();
    Ok(ImportCounts {
        version_count,
        server_count,
    })
}

#[tauri::command]
fn connect_to_server(app_handle: tauri::AppHandle, uuid: String) -> CommandResult<()> {
    debug!("connect_to_server {}", uuid);
    connect_to_server_internal(app_handle, uuid).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_from_openfusionclient(
    state: tauri::State<Mutex<AppState>>,
) -> CommandResult<ImportCounts> {
    debug!("import_from_openfusionclient");
    import_from_openfusionclient_internal(state).map_err(|e| e.to_string())
}

#[tauri::command]
fn reload_state(state: tauri::State<Mutex<AppState>>) {
    debug!("reload_state");
    let mut app_state = state.lock().unwrap();
    *app_state = AppState::load();
    app_state.save();
}

#[tauri::command]
fn get_servers(state: tauri::State<Mutex<AppState>>) -> Servers {
    debug!("get_servers");
    match state.lock() {
        Ok(state) => state.servers.clone(),
        Err(e) => {
            error!("Failed to lock app state: {}", e);
            Servers::default()
        }
    }
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
            let app_state = AppState::default();
            app.manage(Mutex::new(app_state));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            reload_state,
            get_servers,
            import_from_openfusionclient,
            connect_to_server
        ])
        .build(tauri::generate_context![])
        .unwrap()
        .run(|app_handle, event| match event {
            tauri::RunEvent::Exit { .. } => save_app_state(app_handle),
            _ => {}
        });
}
