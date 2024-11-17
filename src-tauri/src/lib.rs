mod state;
mod util;

use serde::{Deserialize, Serialize};
use state::{get_app_statics, AppState, Server, Servers, Versions};

use std::env;
use tokio::sync::Mutex;

use log::*;
use tauri::Manager;
use uuid::Uuid;

type Error = Box<dyn std::error::Error>;
type Result<T> = std::result::Result<T, Error>;
type CommandResult<T> = std::result::Result<T, String>;

#[derive(Debug, Serialize)]
struct ImportCounts {
    version_count: usize,
    server_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct NewServerDetails {
    description: String,
    ip: String,
    version: String,
    endpoint: Option<String>,
}

#[tauri::command]
async fn do_launch(app_handle: tauri::AppHandle) -> CommandResult<i32> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;
        let mut cmd = state.launch_cmd.take().ok_or("No launch prepared")?;
        let mut proc = cmd.spawn()?;
        let exit_code = proc.wait()?;
        Ok(exit_code.code().unwrap_or(0))
    };
    debug!("do_launch");
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn prep_launch(
    app_handle: tauri::AppHandle,
    uuid: Uuid,
    username: Option<String>,
    password: Option<String>,
) -> CommandResult<()> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;
        let server = state
            .servers
            .get_entry(uuid)
            .ok_or(format!("Server {} not found", uuid))?;

        let version_name = &server.version;
        let version = state
            .versions
            .get_entry(version_name)
            .ok_or(format!("Version {} not found", version_name))?;

        let cache_dir = util::get_cache_dir_for_version(version)?;
        unsafe {
            env::set_var("UNITY_FF_CACHE_DIR", cache_dir);
        }

        let asset_url = version.get_asset_url();
        let main_url = format!("{}main.unity3d", asset_url);
        let app_statics = get_app_statics();
        let working_dir = &app_statics.resource_dir;
        let mut ffrunner_path = working_dir.clone();
        ffrunner_path.push("ffrunner.exe");
        let log_file_path = &app_statics.ffrunner_log_path;

        let mut cmd = std::process::Command::new(ffrunner_path);
        cmd.current_dir(working_dir)
            .args(["-m", &main_url])
            .args(["-a", &util::resolve_server_addr(&server.ip)?])
            .args(["--asseturl", &asset_url])
            .args(["-l", log_file_path.to_str().ok_or("Invalid log file path")?]);

        if let Some(endpoint_host) = &server.endpoint {
            if username.is_none() || password.is_none() {
                return Err("Username and password required for endpoint".into());
            }
            let username = username.unwrap();
            let password = password.unwrap();
            let token = util::get_token(&username, &password, endpoint_host).await?;
            let rankurl = format!("http://{}/getranks", endpoint_host);
            let images = format!("http://{}/upsell/", endpoint_host);
            let sponsor = format!("http://{}/upsell/sponsor.png", endpoint_host);
            cmd.args(["-r", &rankurl])
                .args(["-i", &images])
                .args(["-s", &sponsor])
                .args(["-u", &username])
                .args(["-t", &token]);
        }

        #[cfg(debug_assertions)]
        cmd.arg("-v"); // verbose logging

        state.launch_cmd = Some(cmd);
        Ok(())
    };
    debug!("prep_launch {}", uuid);
    internal
        .await
        .map_err(|e: Box<dyn std::error::Error>| e.to_string())
}

#[tauri::command]
async fn import_from_openfusionclient(app_handle: tauri::AppHandle) -> CommandResult<ImportCounts> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;
        let version_count = state.import_versions()?;
        let server_count = state.import_servers()?;
        if version_count > 0 || server_count > 0 {
            state.save();
        }
        Ok(ImportCounts {
            version_count,
            server_count,
        })
    };
    debug!("import_from_openfusionclient");
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn reload_state(app_handle: tauri::AppHandle) -> bool {
    debug!("reload_state");
    let first_run = !get_app_statics().app_data_dir.exists();
    let state = app_handle.state::<Mutex<AppState>>();
    let mut state = state.lock().await;
    *state = AppState::load();
    state.save();
    first_run
}

#[tauri::command]
async fn add_server(
    app_handle: tauri::AppHandle,
    details: NewServerDetails,
) -> CommandResult<Uuid> {
    debug!("add_server {:?}", details);
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;

        // validate the version
        if state.versions.get_entry(&details.version).is_none() {
            return Err(format!("Version {} not found", details.version).into());
        }

        let new_uuid = state.servers.add_entry(details);
        state.save();
        Ok(new_uuid)
    };
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn update_server(app_handle: tauri::AppHandle, server_entry: Server) -> CommandResult<()> {
    debug!("update_server {:?}", server_entry);
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;
        state.servers.update_entry(server_entry)?;
        state.save();
        Ok(())
    };
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn delete_server(app_handle: tauri::AppHandle, uuid: Uuid) -> CommandResult<()> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;
        state.servers.remove_entry(uuid);
        state.save();
        Ok(())
    };
    debug!("delete_server {}", uuid);
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn get_servers(app_handle: tauri::AppHandle) -> Servers {
    debug!("get_servers");
    let state = app_handle.state::<Mutex<AppState>>();
    let state = state.lock().await;
    state.servers.clone()
}

#[tauri::command]
async fn get_versions(app_handle: tauri::AppHandle) -> Versions {
    debug!("get_versions");
    let state = app_handle.state::<Mutex<AppState>>();
    let state = state.lock().await;
    state.versions.clone()
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
            info!("OpenFusion Launcher v{}", get_app_statics().get_version());
            // N.B. AppState::load depends on APP_STATICS
            let app_state = AppState::default();
            app.manage(Mutex::new(app_state));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            reload_state,
            get_versions,
            get_servers,
            add_server,
            update_server,
            delete_server,
            import_from_openfusionclient,
            prep_launch,
            do_launch
        ])
        .build(tauri::generate_context![])
        .unwrap()
        .run(|_, _| ());
}
