mod state;
mod util;

use serde::Serialize;
use state::{get_app_statics, AppState, Servers, Version};

use std::{env, path::PathBuf, sync::Mutex};

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

fn get_cache_dir_for_version(version: &Version) -> Result<PathBuf> {
    let mut cache_dir = get_app_statics().ff_cache_dir.clone();
    cache_dir.push(&version.name);
    std::fs::create_dir_all(&cache_dir)?;
    Ok(cache_dir)
}

fn prep_launch_internal(state: tauri::State<Mutex<AppState>>, uuid: String) -> Result<()> {
    let uuid = Uuid::parse_str(&uuid)?;
    let mut state = state.lock().unwrap();
    let server = state
        .servers
        .get_entry(uuid)
        .ok_or(format!("Server {} not found", uuid))?;

    let version_name = &server.version;
    let version = state
        .versions
        .get_entry(version_name)
        .ok_or(format!("Version {} not found", version_name))?;

    let cache_dir = get_cache_dir_for_version(version)?;
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
        let rankurl = format!("http://{}/getranks", endpoint_host);
        let images = format!("http://{}/upsell/", endpoint_host);
        let sponsor = format!("http://{}/upsell/sponsor.png", endpoint_host);
        cmd.args(["-r", &rankurl])
            .args(["-i", &images])
            .args(["-s", &sponsor]);
    }

    #[cfg(debug_assertions)]
    cmd.arg("-v"); // verbose logging

    state.launch_cmd = Some(cmd);
    Ok(())
}

fn do_launch_internal(state: tauri::State<Mutex<AppState>>) -> Result<i32> {
    let mut state = state.lock().unwrap();
    let mut cmd = state.launch_cmd.take().ok_or("No launch prepared")?;
    let mut proc = cmd.spawn()?;
    let exit_code = proc.wait()?;
    Ok(exit_code.code().unwrap_or(0))
}

fn import_from_openfusionclient_internal(
    state: tauri::State<Mutex<AppState>>,
) -> Result<ImportCounts> {
    let mut app_state = state.lock().unwrap();
    let version_count = app_state.import_versions()?;
    let server_count = app_state.import_servers()?;
    if version_count > 0 || server_count > 0 {
        app_state.save();
    }
    Ok(ImportCounts {
        version_count,
        server_count,
    })
}

#[tauri::command]
fn do_launch(state: tauri::State<Mutex<AppState>>) -> CommandResult<i32> {
    debug!("do_launch");
    do_launch_internal(state).map_err(|e| e.to_string())
}

#[tauri::command]
fn prep_launch(state: tauri::State<Mutex<AppState>>, uuid: String) -> CommandResult<()> {
    debug!("prep_launch {}", uuid);
    prep_launch_internal(state, uuid).map_err(|e| e.to_string())
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
            info!("OpenFusion Launcher v{}", get_app_statics().get_version());
            // N.B. AppState::load depends on APP_STATICS
            let app_state = AppState::default();
            app.manage(Mutex::new(app_state));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            reload_state,
            get_servers,
            import_from_openfusionclient,
            prep_launch,
            do_launch
        ])
        .build(tauri::generate_context![])
        .unwrap()
        .run(|app_handle, event| match event {
            tauri::RunEvent::Exit { .. } => save_app_state(app_handle),
            _ => {}
        });
}
