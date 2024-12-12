mod endpoint;
mod state;
mod util;

use endpoint::{InfoResponse, RegisterResponse, Session};
use ffbuildtool::ItemProgress;
use serde::{Deserialize, Serialize};
use state::{get_app_statics, AppState, FlatServer, FrontendServers, Server, ServerInfo, Versions};

use std::{
    collections::HashSet,
    env,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, OnceLock,
    },
};
use tokio::sync::Mutex;

use log::*;
use tauri::{Emitter as _, Manager};
use uuid::Uuid;

type Error = Box<dyn std::error::Error>;
type Result<T> = std::result::Result<T, Error>;
type CommandResult<T> = std::result::Result<T, String>;

static GAME_CACHE_OPS: OnceLock<Mutex<HashSet<Uuid>>> = OnceLock::new();
static OFFLINE_CACHE_OPS: OnceLock<Mutex<HashSet<Uuid>>> = OnceLock::new();

const CACHE_PROGRESS_EVENT: &str = "cache_progress";

#[derive(Debug, Serialize, Clone)]
struct CacheProgress {
    uuid: Uuid,
    offline: bool,
    //
    bytes_processed: u64,
    is_corrupt: bool,
    is_done: bool,
}

#[derive(Debug, Serialize)]
struct ImportCounts {
    version_count: usize,
    server_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct NewServerDetails {
    description: String,
    ip: Option<String>,
    version: Option<String>,
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
async fn do_register(
    app_handle: tauri::AppHandle,
    server_uuid: Uuid,
    username: String,
    password: String,
    email: String,
) -> CommandResult<RegisterResponse> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let server = state
            .servers
            .get_entry(server_uuid)
            .ok_or(format!("Server {} not found", server_uuid))?;

        let ServerInfo::Endpoint(endpoint_host) = &server.info else {
            return Err("Server is not an endpoint server".into());
        };

        let response = endpoint::register_user(&username, &password, &email, endpoint_host).await?;
        Ok(response)
    };
    debug!("do_register");
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn do_login(
    app_handle: tauri::AppHandle,
    server_uuid: Uuid,
    username: String,
    password: String,
) -> CommandResult<()> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;
        let server = state
            .servers
            .get_entry(server_uuid)
            .ok_or(format!("Server {} not found", server_uuid))?;

        let ServerInfo::Endpoint(endpoint_host) = &server.info else {
            return Err("Server is not an endpoint server".into());
        };

        let refresh_token =
            endpoint::get_refresh_token(&username, &password, endpoint_host).await?;
        state.tokens.save_token(server_uuid, &refresh_token);
        state.save();
        Ok(())
    };
    debug!("do_login");
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn get_session(app_handle: tauri::AppHandle, server_uuid: Uuid) -> CommandResult<Session> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let server = state
            .servers
            .get_entry(server_uuid)
            .ok_or(format!("Server {} not found", server_uuid))?;

        let ServerInfo::Endpoint(endpoint_host) = &server.info else {
            return Err("Server is not an endpoint server".into());
        };

        let Some(refresh_token) = state.tokens.get_token(server_uuid) else {
            return Err("Not logged in".into());
        };

        let session = endpoint::get_session(refresh_token, endpoint_host).await?;
        Ok(session)
    };
    debug!("get_session");
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn prep_launch(
    app_handle: tauri::AppHandle,
    server_uuid: Uuid,
    version_uuid: Uuid,
    session_token: Option<String>,
) -> CommandResult<()> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;
        let server = state
            .servers
            .get_entry(server_uuid)
            .ok_or(format!("Server {} not found", server_uuid))?
            .clone();

        let addr;
        let mut versions = Vec::new();
        let mut custom_loading_screen = false;
        match &server.info {
            ServerInfo::Simple { ip, version } => {
                addr = ip.clone();
                versions.push(version.clone());
            }
            ServerInfo::Endpoint(endpoint_host) => {
                // Ask the endpoint server for the UUID of the current version
                let Ok(api_info) = endpoint::get_info(endpoint_host).await else {
                    return Err("Failed to contact API server".into());
                };

                if api_info.custom_loading_screen.is_some_and(|b| b) {
                    custom_loading_screen = true;
                }

                addr = api_info.login_address.clone();
                versions = api_info.get_supported_versions();
            }
        }

        // Ensure the version is supported
        if !versions.contains(&version_uuid.to_string()) {
            return Err(format!("Version {} not supported by server", version_uuid).into());
        }

        let ip = util::resolve_server_addr(&addr)?;

        let Some(version) = state.versions.get_entry(version_uuid) else {
            return Err(format!("Version {} not found", version_uuid).into());
        };

        let base_cache_dir = &state.config.game_cache_path;
        let cache_dir = util::get_cache_dir_for_version(base_cache_dir, version)?;
        std::fs::create_dir_all(&cache_dir)?;
        unsafe {
            env::set_var("UNITY_FF_CACHE_DIR", cache_dir);
        }

        let asset_url = version.get_asset_url();
        let main_url = format!("{}/main.unity3d", asset_url);
        let app_statics = get_app_statics();
        let working_dir = &app_statics.resource_dir;
        let mut ffrunner_path = working_dir.clone();
        ffrunner_path.push("ffrunner.exe");
        let log_file_path = &app_statics.ffrunner_log_path;

        let mut cmd = std::process::Command::new(ffrunner_path);
        cmd.current_dir(working_dir)
            .args(["-m", &main_url])
            .args(["-a", &ip])
            .args(["--asseturl", &format!("{}/", asset_url)])
            .args(["-l", log_file_path.to_str().ok_or("Invalid log file path")?]);

        if let ServerInfo::Endpoint(endpoint_host) = &server.info {
            match session_token {
                None => {
                    warn!("No session token provided for endpoint server");
                }
                Some(token) => {
                    let (username, cookie) = endpoint::get_cookie(&token, endpoint_host).await?;
                    cmd.args(["-u", &username]).args(["-t", &cookie]);
                }
            };

            let rankurl = format!("http://{}/getranks", endpoint_host);
            let images = format!("http://{}/upsell/", endpoint_host);
            let sponsor = format!("http://{}/upsell/sponsor.png", endpoint_host);
            cmd.args(["-r", &rankurl])
                .args(["-i", &images])
                .args(["-s", &sponsor]);

            if custom_loading_screen {
                let loading_images_url = format!("http://{}/launcher/loading", endpoint_host);
                cmd.args(["--loaderimages", &loading_images_url]);
            }
        }

        #[cfg(debug_assertions)]
        cmd.arg("-v"); // verbose logging

        state.launch_cmd = Some(cmd);
        Ok(())
    };
    debug!(
        "prep_launch server {} version {}",
        server_uuid, version_uuid
    );
    internal
        .await
        .map_err(|e: Box<dyn std::error::Error>| e.to_string())
}

#[tauri::command]
async fn get_cache_size(
    app_handle: tauri::AppHandle,
    uuid: Uuid,
    offline: bool,
) -> CommandResult<u64> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let version = state.versions.get_entry(uuid).ok_or("Version not found")?;
        let path = if offline {
            util::get_cache_dir_for_version(&state.config.offline_cache_path, version)?
        } else {
            util::get_cache_dir_for_version(&state.config.game_cache_path, version)?
        };
        if util::is_dir_empty(&path)? {
            return Err("No cache data".into());
        }
        let sz = util::get_dir_size(&path)?;
        Ok(sz)
    };
    debug!("get_cache_size {} {}", uuid, offline);
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn validate_cache(app_handle: tauri::AppHandle, uuid: Uuid, offline: bool) {
    let internal = async {
        let ops = if offline {
            &OFFLINE_CACHE_OPS
        } else {
            &GAME_CACHE_OPS
        };

        {
            let mut ops = ops.get_or_init(|| Mutex::new(HashSet::new())).lock().await;
            if ops.contains(&uuid) {
                return Err("Cache operation in progress".into());
            }
            ops.insert(uuid);
        }

        let byte_counter = Arc::new(AtomicU64::new(0));
        let corrupt_flag = Arc::new(AtomicBool::new(false));

        let app_handle_clone = app_handle.clone();
        let byte_counter_clone = byte_counter.clone();
        let corrupt_flag_clone = corrupt_flag.clone();
        let cb = move |version_uuid: &Uuid, _item_name: &str, progress: ItemProgress| {
            let cache_progress = match progress {
                ItemProgress::Failed => {
                    corrupt_flag_clone.store(true, Ordering::Release);
                    CacheProgress {
                        uuid: *version_uuid,
                        offline,
                        //
                        bytes_processed: byte_counter_clone.load(Ordering::Acquire),
                        is_corrupt: true,
                        is_done: false,
                    }
                }
                ItemProgress::Completed(item_sz) => {
                    let old_sz = byte_counter_clone.fetch_add(item_sz, Ordering::AcqRel);
                    CacheProgress {
                        uuid: *version_uuid,
                        offline,
                        //
                        bytes_processed: old_sz + item_sz,
                        is_corrupt: corrupt_flag_clone.load(Ordering::Relaxed),
                        is_done: false,
                    }
                }
                _ => return,
            };

            if let Err(e) = app_handle_clone.emit(CACHE_PROGRESS_EVENT, cache_progress) {
                warn!("Failed to emit cache progress: {}", e);
            }
        };
        let cb = Arc::new(cb);

        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let version = state
            .versions
            .get_entry(uuid)
            .ok_or("Version not found")?
            .clone();
        let path = if offline {
            util::get_cache_dir_for_version(&state.config.offline_cache_path, &version)?
        } else {
            util::get_cache_dir_for_version(&state.config.game_cache_path, &version)?
        };
        drop(state);

        if !util::is_dir_empty(&path)? {
            let path = path.to_string_lossy().to_string();
            if offline {
                version.validate_compressed(&path, Some(cb)).await
            } else {
                version.validate_uncompressed(&path, Some(cb)).await
            }?;

            let progress = CacheProgress {
                uuid,
                offline,
                bytes_processed: byte_counter.load(Ordering::Acquire),
                is_corrupt: corrupt_flag.load(Ordering::Acquire),
                is_done: true,
            };
            if let Err(e) = app_handle.emit(CACHE_PROGRESS_EVENT, progress) {
                warn!("Failed to emit cache progress: {}", e);
            }
        }

        {
            let mut ops = ops.get_or_init(|| Mutex::new(HashSet::new())).lock().await;
            ops.remove(&uuid);
        }
        Ok(())
    };
    debug!("validate_cache {} {}", uuid, offline);
    let res: Result<()> = internal.await;
    if let Err(e) = res {
        error!("validate_cache {} {}: {}", uuid, offline, e);
    }
}

#[tauri::command]
async fn delete_cache(
    app_handle: tauri::AppHandle,
    uuid: Uuid,
    offline: bool,
) -> CommandResult<()> {
    let internal = async {
        let ops = if offline {
            &OFFLINE_CACHE_OPS
        } else {
            &GAME_CACHE_OPS
        };

        {
            let mut ops = ops.get_or_init(|| Mutex::new(HashSet::new())).lock().await;
            if ops.contains(&uuid) {
                return Err("Cache operation in progress".into());
            }
            ops.insert(uuid);
        }

        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let version = state.versions.get_entry(uuid).ok_or("Version not found")?;
        let path = if offline {
            util::get_cache_dir_for_version(&state.config.offline_cache_path, version)?
        } else {
            util::get_cache_dir_for_version(&state.config.game_cache_path, version)?
        };
        std::fs::remove_dir_all(&path)?;

        {
            let mut ops = ops.get_or_init(|| Mutex::new(HashSet::new())).lock().await;
            ops.remove(&uuid);
        }
        Ok(())
    };
    debug!("delete_cache {} {}", uuid, offline);
    internal.await.map_err(|e: Error| e.to_string())
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
    let state = app_handle.state::<Mutex<AppState>>();
    let mut state = state.lock().await;
    let first_run = !get_app_statics().app_data_dir.exists();
    *state = AppState::load();
    state.save();
    first_run
}

#[tauri::command]
async fn get_info_for_server(
    app_handle: tauri::AppHandle,
    uuid: Uuid,
) -> CommandResult<InfoResponse> {
    debug!("get_info_for_server {}", uuid);
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let server = state.servers.get_entry(uuid).ok_or("Server not found")?;
        let ServerInfo::Endpoint(endpoint_host) = &server.info else {
            return Err("Server is not an endpoint server".into());
        };
        let info = endpoint::get_info(endpoint_host).await?;
        Ok(info)
    };
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn get_player_count_for_server(
    app_handle: tauri::AppHandle,
    uuid: Uuid,
) -> CommandResult<usize> {
    debug!("get_player_count_for_server {}", uuid);
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let server = state.servers.get_entry(uuid).ok_or("Server not found")?;
        let ServerInfo::Endpoint(endpoint_host) = &server.info else {
            return Err("Server is not an endpoint server".into());
        };
        let status = endpoint::get_status(endpoint_host).await?;
        Ok(status.player_count)
    };
    internal.await.map_err(|e: Error| e.to_string())
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
        if let Some(version) = &details.version {
            let version_uuid = Uuid::parse_str(version)?;
            if state.versions.get_entry(version_uuid).is_none() {
                return Err(format!("Version {} not found", version).into());
            }
        }

        let new_uuid = state.servers.add_entry(details);
        state.save();
        Ok(new_uuid)
    };
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn update_server(
    app_handle: tauri::AppHandle,
    server_entry: FlatServer,
) -> CommandResult<()> {
    debug!("update_server {:?}", server_entry);
    let internal = async {
        let server: Server = server_entry.into();
        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;
        state.servers.update_entry(server)?;
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
async fn get_servers(app_handle: tauri::AppHandle) -> FrontendServers {
    debug!("get_servers");
    let state = app_handle.state::<Mutex<AppState>>();
    let mut state = state.lock().await;
    let servers = state.servers.clone();
    let mut flat_servers: FrontendServers = servers.into();
    flat_servers.refresh_all(&mut state.versions).await;
    flat_servers
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
            app.handle().plugin(tauri_plugin_shell::init())?;

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
            get_info_for_server,
            get_player_count_for_server,
            import_from_openfusionclient,
            do_register,
            do_login,
            get_session,
            prep_launch,
            do_launch,
            get_cache_size,
            validate_cache,
            delete_cache,
        ])
        .build(tauri::generate_context![])
        .unwrap()
        .run(|_, _| ());
}
