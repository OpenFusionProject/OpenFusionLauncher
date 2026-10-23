mod config;
mod endpoint;
mod state;
mod util;

use config::{LaunchBehavior, LauncherSettings};
use discord_sdk::activity::{ActivityBuilder, Assets, Button};
use endpoint::{AccountInfo, InfoResponse, RegisterResponse, Session};
use ffbuildtool::{ItemProgress, Version};
use regex::Regex;
use serde::{Deserialize, Serialize};
use state::{
    AppState, Config, FlatServer, FlatServers, Server, ServerInfo, Versions, get_app_statics,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;
use util::{AlertVariant, ProtocolActivation};
use zip::{ZipWriter, write::SimpleFileOptions};

use std::{
    collections::{HashMap, HashSet},
    process::Stdio,
    sync::{Arc, LazyLock, OnceLock, mpsc},
    time::SystemTime,
    vec,
};
use tokio::sync::{Mutex, Semaphore};

use log::*;
use tauri::Manager;
use uuid::Uuid;

use crate::{
    config::WebPlayerArchitecture,
    state::{LaunchInfo, LaunchProfile, LaunchProfilesView},
};

type Error = Box<dyn std::error::Error>;
type Result<T> = std::result::Result<T, Error>;
type CommandResult<T> = std::result::Result<T, String>;

static LOGIN_COOKIE_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r#"-t (\S+)"#).unwrap());

static VERSION_NUMBER_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^v?\d+(?:\.\d)*$").unwrap());
const UPDATE_CHECK_URL: &str =
    "https://api.github.com/repos/OpenFusionProject/OpenFusionLauncher/releases/latest";
const DOWNLOAD_PAGE_URL: &str = "https://openfusion.dev/download/";

#[derive(Debug, Deserialize)]
struct UpdateCheckResponse {
    tag_name: String,
}

#[derive(Debug, Serialize)]
struct UpdateInfo {
    version: String,
    url: String,
}

const MAX_CONCURRENT_VALIDATION_OPS: usize = 2; // compromise. 1 is a lot for an HDD, but SSDs can handle 3-5
static VALIDATION_SEMAPHORE: Semaphore = Semaphore::const_new(MAX_CONCURRENT_VALIDATION_OPS);

const MAX_CONCURRENT_DOWNLOAD_OPS: usize = 1;
static DOWNLOAD_SEMAPHORE: Semaphore = Semaphore::const_new(MAX_CONCURRENT_DOWNLOAD_OPS);

static GAME_CACHE_OPS: OnceLock<Mutex<HashSet<Uuid>>> = OnceLock::new();
static OFFLINE_CACHE_OPS: OnceLock<Mutex<HashSet<Uuid>>> = OnceLock::new();

const CACHE_PROGRESS_EVENT: &str = "cache_progress";

#[derive(Debug, Serialize, Clone)]
struct CacheProgressItem {
    item_size: u64,
    corrupt: bool,
    missing: bool,
}

#[derive(Debug)]
enum CacheEvent {
    ItemProcessed(String, CacheProgressItem),
    Done,
}

#[derive(Debug, Serialize, Clone)]
struct CacheProgress {
    uuid: Uuid,
    offline: bool,
    items: HashMap<String, CacheProgressItem>,
    done: bool,
}

#[derive(Debug, Serialize)]
struct ImportCounts {
    version_count: usize,
    server_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NewServerDetails {
    description: String,
    ip: Option<String>,
    version: Option<String>,
    endpoint: Option<String>,
}

#[tauri::command]
async fn do_launch(app_handle: tauri::AppHandle) -> CommandResult<u32> {
    debug!("do_launch");
    let state = app_handle.state::<Mutex<AppState>>();
    let mut state = state.lock().await;
    let LaunchInfo {
        mut command,
        asset_url,
        server_name,
        endpoint_url,
    } = state.launch_cmd.take().ok_or("No launch prepared")?;

    // Create a folder for the Unity logs
    let launch_time = chrono::Local::now();
    let launch_time_formatted = launch_time.format("%Y-%m-%d_%H-%M-%S").to_string();
    let unity_logs_dir = get_app_statics().unity_logs_dir.clone();
    let log_dir_name = format!("logs_{}", launch_time_formatted);
    let log_dir = unity_logs_dir.join(&log_dir_name);

    let _ = std::fs::create_dir_all(&log_dir);
    let ffrunner_log_path = if log_dir.exists() {
        command.env("UNITY_FF_LOG_DIR", &log_dir);
        debug!("Unity log path: {}", log_dir.display());
        log_dir.join("ffrunner.log")
    } else {
        warn!(
            "Could not create Unity logs directory ({}); logs will go to AppData",
            log_dir.display()
        );
        get_app_statics().fallback_ffrunner_log_path.clone()
    };

    command.arg("-l").arg(&ffrunner_log_path);

    // We don't need stdin. Void it to avoid issues.
    command.stdin(Stdio::null());

    // For stdout and stderr, log to respective .log files in the log dir.
    // If they can't be created, don't worry about piping them; just null them out.
    //
    // ffrunner should be *very* quiet on these pipes, as Unity tends to crash if you
    // write to stdout/stderr (especially during startup), but other tooling like Wine
    // debugging could benefit.
    let stdout_file_path = log_dir.join("stdout.log");
    match std::fs::File::create(&stdout_file_path) {
        Ok(stdout_file) => {
            command.stdout(Stdio::from(stdout_file));
        }
        Err(e) => {
            warn!(
                "Could not create stdout log file ({}); stdout will be null",
                e
            );
            command.stdout(Stdio::null());
        }
    }

    let stderr_file_path = log_dir.join("stderr.log");
    match std::fs::File::create(&stderr_file_path) {
        Ok(stderr_file) => {
            command.stderr(Stdio::from(stderr_file));
        }
        Err(e) => {
            warn!(
                "Could not create stderr log file ({}); stderr will be null",
                e
            );
            command.stderr(Stdio::null());
        }
    }

    util::log_command(&command);
    let cmd_str = util::get_launch_cmd_dbg_str(&command, false);
    let mut proc = command.spawn().map_err(|e| {
        // we want to censor the login cookie if present
        let censored_cmd_str = LOGIN_COOKIE_REGEX
            .replace_all(&cmd_str, "-t ***")
            .to_string();
        format!("{} (launch command was: {})", e, censored_cmd_str)
    })?;

    let do_discord_activity = state.config.launcher.discord_integration;

    // don't hold the state across the game process
    drop(state);

    // Discord activity
    let discord_client = if do_discord_activity {
        match util::get_discord_client().await {
            Ok(client) => Some(client),
            Err(e) => {
                debug!("Discord unavailable: {}", e);
                None
            }
        }
    } else {
        None
    };

    let mut activity_set = false;
    if let Some(discord_client) = discord_client {
        let mut activity =
            ActivityBuilder::default().start_timestamp(SystemTime::from(launch_time));

        if let Some(endpoint_url) = &endpoint_url {
            let server_name = server_name.unwrap();
            let endpoint_magnet_url = format!("http://{}/ofl", endpoint_url);

            // we include the timestamp in the URL to cache-bust
            let discord_icon_url = format!(
                "http://{}/launcher/discord.png?t={}",
                endpoint_url,
                launch_time.timestamp()
            );

            let mut assets = Assets::default();
            if util::does_web_file_exist(&discord_icon_url).await {
                assets.small_image = Some(discord_icon_url);
            }

            activity = activity.details(server_name).assets(assets).button(Button {
                label: "Launch in OpenFusionLauncher".to_owned(),
                url: endpoint_magnet_url,
            });
        }

        let activity_debug = format!("{:?}", activity);
        if let Err(e) = discord_client.discord.update_activity(activity).await {
            warn!("Failed to set Discord activity: {}", e);
        } else {
            activity_set = true;
            debug!("Set Discord activity successfully: {}", activity_debug);
        }
    }

    let exit_result = proc.wait();

    // End Discord activity
    if activity_set
        && let Some(discord_client) = discord_client
        && let Err(e) = discord_client.discord.clear_activity().await
    {
        warn!("Failed to clear Discord activity: {}", e);
    }

    // shutdown the asset proxy
    let state = app_handle.state::<Mutex<AppState>>();
    let mut state = state.lock().await;
    state.release_proxy_for_version(&asset_url);

    util::prune_unity_logs();

    // no need to do any error handling. quit now so the user doesn't see us again.
    if state.config.launcher.launch_behavior == LaunchBehavior::Quit {
        app_handle.exit(0);
        return Ok(0);
    }

    let exit_status = exit_result.map_err(|e| e.to_string())?;
    let exit_code = exit_status.code().map(|c| c as u32);
    debug!("Process exited with code: {:?}", exit_code);

    // we use DEADBEEF as a sentinel to indicate missing exit code
    // (on Unix, when a signal terminated the process we spawned directly).
    // Note that when running through a compatibility layer like Wine or Proton,
    // the spawned process is the wrapper, not ffrunner itself; if ffrunner gets
    // killed by a signal, Wine reports it as a regular exit code (1) instead.
    Ok(exit_code.unwrap_or(0xDEAD_BEEF))
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

        let ServerInfo::Endpoint { endpoint, .. } = server.info.clone() else {
            return Err("Server is not an endpoint server".into());
        };
        drop(state);

        let response = endpoint::register_user(&username, &password, &email, &endpoint).await?;
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
    remember: bool,
) -> CommandResult<()> {
    let internal = async {
        let _state = app_handle.state::<Mutex<AppState>>();
        let state = _state.lock().await;
        let mut server = state
            .servers
            .get_entry(server_uuid)
            .ok_or(format!("Server {} not found", server_uuid))?
            .clone();

        let ServerInfo::Endpoint { endpoint, .. } = server.info else {
            return Err("Server is not an endpoint server".into());
        };
        drop(state);

        let refresh_token = endpoint::get_refresh_token(&username, &password, &endpoint).await?;

        let mut state = _state.lock().await;

        // Clear the preferred version
        server.info = ServerInfo::Endpoint {
            preferred_version: None,
            endpoint,
        };
        if let Err(e) = state.servers.update_entry(server) {
            warn!("Failed to clear preferred version for server: {}", e);
        }

        if remember {
            state.tokens.save_token(server_uuid, &refresh_token);
            state.save();
        } else {
            state.temp_tokens.insert(server_uuid, refresh_token);
        }
        Ok(())
    };
    debug!("do_login");
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn do_logout(app_handle: tauri::AppHandle, server_uuid: Option<Uuid>) -> CommandResult<()> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;
        match server_uuid {
            Some(uuid) => {
                state.tokens.remove_token(uuid);
            }
            None => {
                state.tokens.clear();
            }
        }
        state.save();
        Ok(())
    };
    debug!("do_logout");
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn send_otp(
    app_handle: tauri::AppHandle,
    server_uuid: Uuid,
    email: String,
) -> CommandResult<()> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let server = state
            .servers
            .get_entry(server_uuid)
            .ok_or(format!("Server {} not found", server_uuid))?;

        let ServerInfo::Endpoint { endpoint, .. } = server.info.clone() else {
            return Err("Server is not an endpoint server".into());
        };
        drop(state);

        endpoint::send_otp(&endpoint, &email).await?;
        Ok(())
    };
    debug!("send_otp");
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn get_account_info(
    app_handle: tauri::AppHandle,
    server_uuid: Uuid,
    session_token: String,
) -> CommandResult<AccountInfo> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let server = state
            .servers
            .get_entry(server_uuid)
            .ok_or(format!("Server {} not found", server_uuid))?;

        let ServerInfo::Endpoint { endpoint, .. } = server.info.clone() else {
            return Err("Server is not an endpoint server".into());
        };
        drop(state);

        let info = endpoint::get_account_info(&session_token, &endpoint).await?;
        Ok(info)
    };
    debug!("get_account_info");
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn update_email(
    app_handle: tauri::AppHandle,
    server_uuid: Uuid,
    new_email: String,
    session_token: String,
) -> CommandResult<()> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let server = state
            .servers
            .get_entry(server_uuid)
            .ok_or(format!("Server {} not found", server_uuid))?;

        let ServerInfo::Endpoint { endpoint, .. } = server.info.clone() else {
            return Err("Server is not an endpoint server".into());
        };
        drop(state);

        endpoint::update_email(&endpoint, &session_token, &new_email).await?;
        Ok(())
    };
    debug!("update_email");
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn update_password(
    app_handle: tauri::AppHandle,
    server_uuid: Uuid,
    new_password: String,
    session_token: String,
) -> CommandResult<()> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let server = state
            .servers
            .get_entry(server_uuid)
            .ok_or(format!("Server {} not found", server_uuid))?;

        let ServerInfo::Endpoint { endpoint, .. } = server.info.clone() else {
            return Err("Server is not an endpoint server".into());
        };
        drop(state);

        endpoint::update_password(&endpoint, &session_token, &new_password).await?;
        Ok(())
    };
    debug!("update_password");
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn get_session(app_handle: tauri::AppHandle, server_uuid: Uuid) -> CommandResult<Session> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;
        let server = state
            .servers
            .get_entry(server_uuid)
            .ok_or(format!("Server {} not found", server_uuid))?;

        let ServerInfo::Endpoint { endpoint, .. } = server.info.clone() else {
            return Err("Server is not an endpoint server".into());
        };

        // We first check the temp tokens, then the saved tokens.
        // Temp tokens are one-time use, so they are removed here
        let token = match state.temp_tokens.remove(&server_uuid) {
            Some(token) => Some(token),
            None => state.tokens.get_token(server_uuid),
        };

        let Some(refresh_token) = token else {
            return Err("Not logged in".into());
        };
        let refresh_token = refresh_token.to_string();
        drop(state);

        let session = endpoint::get_session(&refresh_token, &endpoint).await?;
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
) -> CommandResult<Option<usize>> {
    let internal = async {
        // timeout in seconds, for giving the user time
        // to see any warnings before launch
        let mut timeout_sec = None;

        let app_statics = get_app_statics();
        let working_dir = &app_statics.resource_dir;
        let mut ffrunner_path = working_dir.clone();

        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;

        ffrunner_path.push(match state.config.game.web_player_architecture {
            WebPlayerArchitecture::X64 => "ffrunner64.exe",
            WebPlayerArchitecture::X86 => "ffrunner.exe",
        });

        let mut cmd = std::process::Command::new(ffrunner_path.clone());
        cmd.current_dir(working_dir);

        let server = state
            .servers
            .get_entry(server_uuid)
            .ok_or(format!("Server {} not found", server_uuid))?
            .clone();

        let mut server_name = server.get_description();
        let addr;
        let mut versions = Vec::new();
        let mut custom_loading_screen = false;
        let mut custom_icon_url = None;
        match &server.info {
            ServerInfo::Simple { ip, version } => {
                addr = ip.clone();
                versions.push(version.clone());
            }
            ServerInfo::Endpoint { endpoint, .. } => {
                // Ask the endpoint server for the UUID of the current version
                let Ok(api_info) = endpoint::get_info(endpoint).await else {
                    return Err("Failed to contact API server".into());
                };

                if api_info.custom_loading_screen.is_some_and(|b| b) {
                    custom_loading_screen = true;
                }

                if let Ok(icon_url) = endpoint::get_custom_icon_url(endpoint).await {
                    custom_icon_url = icon_url;
                }

                server_name = Some(api_info.server_name.clone());
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

        let base_cache_dir = &state.config.launcher.game_cache_path;
        let cache_dir = util::get_cache_dir_for_version(base_cache_dir, version);
        if !cache_dir.exists() {
            // check for cache upgrade
            if let Some(parent_uuid) = version.get_parent_uuid()
                && let Some(parent_version) = state.versions.get_entry(parent_uuid)
            {
                let parent_cache_dir =
                    util::get_cache_dir_for_version(base_cache_dir, parent_version);

                if parent_cache_dir.exists() {
                    if let Err(e) = util::copy_dir(&parent_cache_dir, &cache_dir) {
                        warn!(
                            "Failed to upgrade cache from parent version {} for {}: {}",
                            parent_uuid, version_uuid, e
                        );
                    } else {
                        info!(
                            "Upgraded cache from parent version {} for {}",
                            parent_uuid, version_uuid
                        );

                        if state.config.launcher.delete_old_game_caches
                            && state.get_version_use_count(parent_uuid) == 0
                        {
                            if let Err(e) = util::delete_dir(&parent_cache_dir) {
                                warn!(
                                    "Failed to delete cache for parent version {}: {}",
                                    parent_uuid, e
                                );
                            } else {
                                info!("Deleted cache for parent version {}", parent_uuid);
                            }
                        }
                    }
                }
            }
        }

        let _ = std::fs::create_dir_all(&cache_dir);
        cmd.env("UNITY_FF_CACHE_DIR", cache_dir);

        let original_asset_url = version.get_asset_url();
        let mut asset_url = original_asset_url.clone();
        let mut main_url = version
            .get_main_file_url()
            .unwrap_or(format!("{}/main.unity3d", asset_url));

        // use offline cache if available
        let base_offline_cache_dir = &state.config.launcher.offline_cache_path;
        let offline_cache_dir = util::get_cache_dir_for_version(base_offline_cache_dir, version);
        if state.config.launcher.use_offline_caches && offline_cache_dir.exists() {
            let offline_asset_url = util::get_path_as_file_uri(&offline_cache_dir);
            let offline_cache_dir = offline_cache_dir.to_string_lossy().to_string();
            let offline_main_url = format!("{}\\main.unity3d", offline_cache_dir);

            let use_offline_cache = if state.config.launcher.verify_offline_caches {
                match version
                    .validate_compressed_stop_on_first_fail(&offline_cache_dir, None)
                    .await
                {
                    Ok(corrupted) => {
                        let is_corrupt = corrupted.is_some();
                        if is_corrupt {
                            let msg = format!(
                                "Offline cache for version {} is corrupt. Not using.",
                                util::get_version_name(version)
                            );
                            warn!("{}", msg);
                            util::send_alert(app_handle.clone(), AlertVariant::Warning, &msg);
                            timeout_sec = Some(3);
                        }
                        !is_corrupt
                    }
                    Err(e) => {
                        let msg = format!(
                            "Failed to validate offline cache for version {}: {:?}",
                            util::get_version_name(version),
                            e
                        );
                        error!("{}", msg);
                        util::send_alert(app_handle.clone(), AlertVariant::Error, &msg);
                        false
                    }
                }
            } else {
                true
            };

            if use_offline_cache {
                let msg = format!(
                    "Using offline cache for version {}",
                    util::get_version_name(version)
                );
                info!("{}", msg);
                util::send_alert(app_handle.clone(), AlertVariant::Success, &msg);

                asset_url = offline_asset_url;
                main_url = offline_main_url;
            }
        } else {
            // Assets served over web.
            // The 64-bit web player uses ffrunner for asset downloading, so try to
            // upgrade the asset URL to HTTPS, if it's available, since ffrunner supports it
            if asset_url.starts_with("http://")
                && state.config.game.web_player_architecture == WebPlayerArchitecture::X64
            {
                let new_asset_url = asset_url.replacen("http://", "https://", 1);
                if util::supports_https(&new_asset_url).await {
                    asset_url = new_asset_url;
                }
            }

            // We are still fetching over plain HTTP. Spin up the proxy if configured.
            if asset_url.starts_with("http://") && state.config.launcher.proxy_asset_downloads {
                let new_asset_url = state.acquire_proxy_for_version(&asset_url).await?;
                asset_url = new_asset_url;
            }
        }

        // Upgrade the main URL to HTTPS, if it's available, since ffrunner supports it
        if main_url.starts_with("http://") {
            let main_url_upgraded = main_url.replacen("http://", "https://", 1);
            if util::does_web_file_exist(&main_url_upgraded).await {
                main_url = main_url_upgraded;
            } else if !util::does_web_file_exist(&main_url).await {
                return Err(format!("Main file not found: {}", main_url).into());
            }
        }

        debug!("Asset URL: {}", asset_url);
        debug!("Main URL: {}", main_url);

        cmd.args(["-m", &main_url])
            .args(["-a", &ip])
            .args(["--asseturl", &format!("{}/", asset_url)]);

        if let Some(server_name) = &server_name {
            // window title
            cmd.args(["-n", server_name]);
        }

        if let Some(icon_url) = custom_icon_url {
            // window icon
            cmd.args(["-i", &icon_url]);
        }

        let mut endpoint_url = None;
        if let ServerInfo::Endpoint { endpoint, .. } = &server.info {
            match session_token {
                None => {
                    warn!("No session token provided for endpoint server");
                }
                Some(token) => {
                    let (username, cookie) = endpoint::get_cookie(&token, endpoint).await?;
                    cmd.args(["-u", &username]).args(["-t", &cookie]);
                }
            };

            cmd.args(["-e", endpoint]);
            endpoint_url = Some(endpoint.to_string());

            if custom_loading_screen {
                cmd.arg("--loader-images");
            }
        }

        // Window size
        if let Some(window_size) = &state.config.game.window_size {
            cmd.args([
                "--width",
                &window_size.width.to_string(),
                "--height",
                &window_size.height.to_string(),
            ]);
        }

        // Graphics API overrides
        match state.config.game.graphics_api {
            config::GraphicsApi::Dx9 => {}
            // config::GraphicsApi::OpenGl => {
            //     cmd.arg("--force-opengl");
            // }
            config::GraphicsApi::Vulkan => {
                cmd.arg("--force-vulkan");
                #[cfg(debug_assertions)]
                cmd.env("DXVK_HUD", "1");
            }
        }

        // FPS behavior
        match state.config.game.fps_fix {
            config::FpsFix::On => {}
            config::FpsFix::OnWithLimiter(limit) => {
                cmd.env("UNITY_FF_FPS_CAP", limit.to_string());
            }
            config::FpsFix::Off => {
                cmd.env("UNITY_FF_FPS_CAP", "old");
            }
        }

        #[cfg(debug_assertions)]
        cmd.arg("-v"); // verbose logging

        if !state.launch_profiles.has_entries() {
            // First check if there are any presets that may have become available since startup.
            state.launch_profiles.reload_presets(true);
            if let Some(new_default_profile) = state.launch_profiles.get_default() {
                state.config.game.launch_profile = new_default_profile.get_id();
                state.write_config = true;
                state.save();
            } else {
                let detailed_instructions = match std::env::consts::OS {
                    "linux" => {
                        "Install a compatibility layer, such as Proton from Steam, or Wine from your distribution's package manager. Then restart OpenFusionLauncher."
                    }
                    "macos" => {
                        "Download a compatibility layer, such as CrossOver or Wine, and install the .app into your Applications folder. Then restart OpenFusionLauncher."
                    }
                    "windows" => {
                        "Please ensure you have extracted OpenFusionLauncher, or download the installer instead."
                    }
                    _ => {
                        "Please create one that uses an appropriate compatibility layer for your system."
                    }
                };

                return Err(format!(
                    "No launch profiles found in game settings.\n\n{}",
                    detailed_instructions
                )
                .into());
            }
        }

        let selected_launch_profile = state.config.game.launch_profile;
        let profile = state
            .launch_profiles
            .get(selected_launch_profile)
            .ok_or(format!(
                "Launch profile '{}' not found",
                selected_launch_profile
            ))?;

        let launch_fmt = profile.get_command();
        cmd = util::gen_launch_command(cmd, launch_fmt)?;

        #[cfg(not(target_os = "windows"))]
        {
            // Compat setup
            let mut ensure_compat_dir = true;
            let mut compat_data_dir = app_statics.compat_data_dir.clone();
            compat_data_dir.push(profile.get_id().to_string());

            let compat_program = std::path::Path::new(cmd.get_program())
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("");

            if compat_program.contains("proton") || compat_program.contains("_v2-entry-point") {
                #[cfg(target_os = "linux")]
                {
                    if util::get_env_var_value(&cmd, "STEAM_COMPAT_CLIENT_INSTALL_PATH").is_none() {
                        if let Some(steam_client_dir) = protontools::get_steam_client_path() {
                            cmd.env(
                                "STEAM_COMPAT_CLIENT_INSTALL_PATH",
                                steam_client_dir.into_os_string(),
                            );
                        } else {
                            return Err("Proton requires Steam to be installed".into());
                        }
                    }

                    if let Some(proton_prefix) =
                        util::get_env_var_value(&cmd, "STEAM_COMPAT_DATA_PATH")
                    {
                        compat_data_dir = proton_prefix.into();
                    } else {
                        cmd.env("STEAM_COMPAT_DATA_PATH", &compat_data_dir);
                    }
                    // proton sets WINEPREFIX internally
                }

                #[cfg(not(target_os = "linux"))]
                return Err("Proton is only supported on Linux".into());
            } else if compat_program.contains("wine") {
                if let Some(wine_prefix) = util::get_env_var_value(&cmd, "WINEPREFIX") {
                    compat_data_dir = wine_prefix.into();
                } else {
                    cmd.env("WINEPREFIX", compat_data_dir.clone().into_os_string());
                }
            } else {
                // unknown compat layer
                ensure_compat_dir = false;
            }

            if ensure_compat_dir && !compat_data_dir.exists() {
                debug!("Creating prefix at {}", compat_data_dir.to_string_lossy());
                std::fs::create_dir_all(&compat_data_dir)?;
            }
        }

        state.launch_cmd = Some(LaunchInfo {
            command: cmd,
            asset_url: original_asset_url,
            server_name,
            endpoint_url,
        });

        Ok(timeout_sec)
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
async fn validate_cache(app_handle: tauri::AppHandle, uuid: Uuid, offline: bool) {
    let internal = async {
        let _permit = VALIDATION_SEMAPHORE.acquire().await?;
        let ops = if offline {
            &OFFLINE_CACHE_OPS
        } else {
            &GAME_CACHE_OPS
        };

        let (tx, rx) = mpsc::channel();
        let tx_clone = tx.clone();
        let cb = move |_version_uuid: &Uuid, item_name: &str, progress: ItemProgress| {
            util::cache_progress_callback(tx_clone.clone(), item_name, progress);
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
            util::get_cache_dir_for_version(&state.config.launcher.offline_cache_path, &version)
        } else {
            util::get_cache_dir_for_version(&state.config.launcher.game_cache_path, &version)
        };
        drop(state);

        {
            let mut ops = ops.get_or_init(|| Mutex::new(HashSet::new())).lock().await;
            if ops.contains(&uuid) {
                return Err("Cache operation in progress".into());
            }
            ops.insert(uuid);
        }

        tauri::async_runtime::spawn_blocking(move || {
            util::cache_progress_loop(offline, app_handle, rx, uuid);
        });

        tauri::async_runtime::spawn(async move {
            let _permit = _permit; // move into the async block
            if !util::is_dir_empty(&path).unwrap_or(true) {
                let path = path.to_string_lossy().to_string();
                if offline {
                    let _ = version.validate_compressed(&path, Some(cb)).await;
                } else {
                    let _ = version.validate_uncompressed(&path, Some(cb)).await;
                }
            }

            {
                let mut ops = ops.get_or_init(|| Mutex::new(HashSet::new())).lock().await;
                ops.remove(&uuid);
            }

            if let Err(e) = tx.send(CacheEvent::Done) {
                error!("Failed to send cache done event: {}", e);
            }
        });
        Ok(())
    };
    debug!("validate_cache {} {}", uuid, offline);
    let res: Result<()> = internal.await;
    if let Err(e) = res {
        error!("validate_cache {} {}: {}", uuid, offline, e);
    }
}

#[tauri::command]
async fn download_cache(
    app_handle: tauri::AppHandle,
    uuid: Uuid,
    offline: bool,
    repair: bool,
) -> CommandResult<()> {
    let internal = async {
        let _permit = DOWNLOAD_SEMAPHORE.acquire().await?;
        let ops = if offline {
            &OFFLINE_CACHE_OPS
        } else {
            &GAME_CACHE_OPS
        };

        if !offline {
            return Err("Not implemented".into());
        }

        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let version = state
            .versions
            .get_entry(uuid)
            .ok_or("Version not found")?
            .clone();
        let path = if offline {
            util::get_cache_dir_for_version(&state.config.launcher.offline_cache_path, &version)
        } else {
            util::get_cache_dir_for_version(&state.config.launcher.game_cache_path, &version)
        };
        drop(state);

        std::fs::create_dir_all(&path)?;
        if !repair && !util::is_dir_empty(&path)? {
            return Err("Cache directory not empty".into());
        }

        let (tx, rx) = mpsc::channel();
        let tx_clone = tx.clone();
        let cb = move |_version_uuid: &Uuid, item_name: &str, progress: ItemProgress| {
            util::cache_progress_callback(tx_clone.clone(), item_name, progress);
        };
        let cb = Arc::new(cb);

        {
            let mut ops = ops.get_or_init(|| Mutex::new(HashSet::new())).lock().await;
            if ops.contains(&uuid) {
                return Err("Cache operation in progress".into());
            }
            ops.insert(uuid);
        }

        tauri::async_runtime::spawn_blocking(move || {
            util::cache_progress_loop(offline, app_handle, rx, uuid);
        });

        let path = path.to_string_lossy().to_string();
        tauri::async_runtime::spawn(async move {
            let _permit = _permit; // move into the async block
            if repair {
                let _ = version.repair(&path, Some(cb)).await;
            } else {
                let _ = version.download_compressed(&path, Some(cb)).await;
            }

            {
                let mut ops = ops.get_or_init(|| Mutex::new(HashSet::new())).lock().await;
                ops.remove(&uuid);
            }

            if let Err(e) = tx.send(CacheEvent::Done) {
                error!("Failed to send cache done event: {}", e);
            }
        });
        Ok(())
    };
    debug!("download_cache {} {} {}", uuid, offline, repair);
    internal.await.map_err(|e: Error| e.to_string())
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

        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let version = state.versions.get_entry(uuid).ok_or("Version not found")?;
        let path = if offline {
            util::get_cache_dir_for_version(&state.config.launcher.offline_cache_path, version)
        } else {
            util::get_cache_dir_for_version(&state.config.launcher.game_cache_path, version)
        };

        {
            let mut ops = ops.get_or_init(|| Mutex::new(HashSet::new())).lock().await;
            if ops.contains(&uuid) {
                return Err("Cache operation in progress".into());
            }
            ops.insert(uuid);
        }

        let result = std::fs::remove_dir_all(&path);

        {
            let mut ops = ops.get_or_init(|| Mutex::new(HashSet::new())).lock().await;
            ops.remove(&uuid);
        }
        Ok(result?)
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
    // Activations aren't persisted state; keep any the frontend hasn't taken yet.
    let pending_activations = std::mem::take(&mut state.pending_activations);
    *state = AppState::load(app_handle.clone());
    state.save();
    state.pending_activations = pending_activations;
    drop(state);
    state::mark_app_state_ready();
    first_run
}

#[tauri::command]
async fn live_check(url: String) -> bool {
    debug!("live_check {}", url);
    util::do_live_check(&url).await
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
        let ServerInfo::Endpoint { endpoint, .. } = server.info.clone() else {
            return Err("Server is not an endpoint server".into());
        };
        drop(state);

        let info = endpoint::get_info(&endpoint).await?;
        Ok(info.clone())
    };
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn get_announcements_for_server(
    app_handle: tauri::AppHandle,
    uuid: Uuid,
) -> CommandResult<String> {
    debug!("get_announcements_for_server {}", uuid);
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let server = state.servers.get_entry(uuid).ok_or("Server not found")?;
        let ServerInfo::Endpoint { endpoint, .. } = server.info.clone() else {
            return Err("Server is not an endpoint server".into());
        };
        drop(state);

        let announcements = endpoint::get_announcements(&endpoint).await?;
        Ok(announcements)
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
        let ServerInfo::Endpoint { endpoint, .. } = server.info.clone() else {
            return Err("Server is not an endpoint server".into());
        };
        drop(state);

        let status = endpoint::get_status(&endpoint).await?;
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
async fn import_version(app_handle: tauri::AppHandle, uri: String) -> CommandResult<String> {
    let internal = async {
        let Ok(version) = Version::from_manifest(&uri).await else {
            return Err("Invalid manifest".into());
        };

        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;

        if state.versions.get_entry(version.get_uuid()).is_some() {
            return Err("Version already imported".into());
        }

        let version_label = match version.get_name() {
            Some(name) => name.to_string(),
            None => version.get_uuid().to_string(),
        };
        util::import_versions(vec![version.clone()])?;
        state.versions.add_entry(version);
        Ok(version_label)
    };
    debug!("import_build");
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn add_version_manual(
    app_handle: tauri::AppHandle,
    name: String,
    asset_url: String,
) -> CommandResult<()> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;
        let version = Version::build_barebones(&asset_url, Some(&name));
        util::import_versions(vec![version.clone()])?;
        state.versions.add_entry(version);
        Ok(())
    };
    debug!("add_build_manual");
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn remove_version(
    app_handle: tauri::AppHandle,
    uuid: Uuid,
    delete_caches: bool,
) -> CommandResult<()> {
    let internal = async {
        let _state = app_handle.state::<Mutex<AppState>>();
        let state = _state.lock().await;
        let version = state.versions.get_entry(uuid).ok_or("Version not found")?;
        let base_cache_dir = &state.config.launcher.game_cache_path;
        let cache_dir = util::get_cache_dir_for_version(base_cache_dir, version);
        let base_offline_cache_dir = &state.config.launcher.offline_cache_path;
        let offline_cache_dir = util::get_cache_dir_for_version(base_offline_cache_dir, version);
        util::remove_version(uuid, state.versions.get_file_names())?;
        drop(state);

        let mut state = _state.lock().await;
        state.versions.remove_entry(uuid);

        if delete_caches {
            if cache_dir.exists() && std::fs::remove_dir_all(&cache_dir).is_err() {
                warn!("Failed to remove game cache directory for version {}", uuid);
            }
            if offline_cache_dir.exists() && std::fs::remove_dir_all(&offline_cache_dir).is_err() {
                warn!(
                    "Failed to remove offline cache directory for version {}",
                    uuid
                );
            }
        }

        Ok(())
    };
    debug!("remove_build {} {}", uuid, delete_caches);
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn open_folder_for_version(
    app_handle: tauri::AppHandle,
    uuid: Uuid,
    offline: bool,
) -> CommandResult<()> {
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let state = state.lock().await;
        let version = state.versions.get_entry(uuid).ok_or("Version not found")?;
        let base_cache_dir = if offline {
            &state.config.launcher.offline_cache_path
        } else {
            &state.config.launcher.game_cache_path
        };
        let cache_dir = util::get_cache_dir_for_version(base_cache_dir, version);
        drop(state);

        if cache_dir.exists() {
            app_handle
                .opener()
                .open_path(cache_dir.to_str().unwrap(), None::<&str>)?;
        } else {
            return Err("Cache directory does not exist".into());
        }
        Ok(())
    };
    debug!("open_folder_for_version {} {}", uuid, offline);
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn get_versions_for_server(
    app_handle: tauri::AppHandle,
    uuid: Uuid,
) -> CommandResult<Vec<Uuid>> {
    let internal = async {
        let _state = app_handle.state::<Mutex<AppState>>();
        let state = _state.lock().await;
        let server = state.servers.get_entry(uuid).ok_or("Server not found")?;
        let ServerInfo::Endpoint { endpoint, .. } = server.info.clone() else {
            return Err("Server is not an endpoint server".into());
        };
        let state_versions = state.versions.clone();
        drop(state);

        let info = endpoint::get_info(&endpoint).await?;
        let supported_versions = info.get_supported_versions();
        let mut new_versions = Vec::new();
        let mut supported_version_uuids = Vec::new();
        for version_uuid in supported_versions {
            let Ok(version_uuid) = Uuid::parse_str(&version_uuid) else {
                warn!("Invalid version UUID: {}", version_uuid);
                continue;
            };
            supported_version_uuids.push(version_uuid);

            if state_versions.get_entry(version_uuid).is_some() {
                debug!("Already have version {}", version_uuid);
                continue;
            }

            let Ok(version) = endpoint::fetch_version(&endpoint, version_uuid).await else {
                warn!("Failed to fetch version {}", version_uuid);
                continue;
            };
            new_versions.push(version);
        }

        if let Err(e) = util::import_versions(new_versions.clone()) {
            warn!("Failed to import versions for server {}: {}", uuid, e);
        }

        let mut state = _state.lock().await;
        for version in new_versions {
            state.versions.add_entry(version);
        }
        Ok(supported_version_uuids)
    };
    debug!("get_versions_for_server {}", uuid);
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn get_servers(app_handle: tauri::AppHandle) -> FlatServers {
    debug!("get_servers");
    let state = app_handle.state::<Mutex<AppState>>();
    let state = state.lock().await;
    let servers = state.servers.clone();
    let flat_servers: FlatServers = servers.into();
    flat_servers
}

#[tauri::command]
async fn get_versions(app_handle: tauri::AppHandle) -> Versions {
    debug!("get_versions");
    let state = app_handle.state::<Mutex<AppState>>();
    let state = state.lock().await;
    state.versions.clone()
}

#[tauri::command]
async fn get_launch_profiles(app_handle: tauri::AppHandle) -> LaunchProfilesView {
    debug!("get_launch_profiles");
    let state = app_handle.state::<Mutex<AppState>>();
    let state = state.lock().await;
    LaunchProfilesView::from(&state.launch_profiles)
}

#[tauri::command]
async fn get_config(app_handle: tauri::AppHandle) -> Config {
    debug!("get_config");
    let state = app_handle.state::<Mutex<AppState>>();
    let state = state.lock().await;
    state.config.clone()
}

#[tauri::command]
async fn add_launch_profile(
    app_handle: tauri::AppHandle,
    name: String,
    command: String,
) -> CommandResult<Uuid> {
    debug!("add_launch_profile");
    let state = app_handle.state::<Mutex<AppState>>();
    let mut state = state.lock().await;
    let profile_id = state.launch_profiles.add_entry(&name, &command);
    state.save();
    Ok(profile_id)
}

#[tauri::command]
async fn update_launch_profile(
    app_handle: tauri::AppHandle,
    profile: LaunchProfile,
) -> CommandResult<()> {
    debug!("update_launch_profile");
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut state = state.lock().await;
        state.launch_profiles.update_entry(profile)?;
        state.save();
        Ok(())
    };
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn delete_launch_profile(app_handle: tauri::AppHandle, uuid: Uuid) -> CommandResult<()> {
    debug!("delete_launch_profile");
    let internal = async {
        let state = app_handle.state::<Mutex<AppState>>();
        {
            // Delete the profile and save to disk
            let mut state = state.lock().await;
            state.launch_profiles.remove_entry(uuid);
            state.save();
        }

        // Delete compat dir if it exists
        #[cfg(not(target_os = "windows"))]
        {
            let statics = get_app_statics();
            let compat_dir = statics.compat_data_dir.join(uuid.to_string());
            if compat_dir.exists()
                && let Err(e) = std::fs::remove_dir_all(&compat_dir)
            {
                warn!(
                    "Failed to remove compat data directory for launch profile {}: {}",
                    uuid, e
                );
            }
        }

        Ok(())
    };
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn update_config(app_handle: tauri::AppHandle, config: Config) -> CommandResult<()> {
    debug!("update_config");
    let state = app_handle.state::<Mutex<AppState>>();
    let mut state = state.lock().await;
    state.config = config;
    state.write_config = true;
    state.save();
    Ok(())
}

#[tauri::command]
async fn reset_launcher_config(app_handle: tauri::AppHandle) -> CommandResult<()> {
    debug!("reset_launcher_config");
    let default_launcher_config = LauncherSettings::default();
    let state = app_handle.state::<Mutex<AppState>>();
    let mut state = state.lock().await;
    state.config.launcher = default_launcher_config;
    state.write_config = true;
    state.save();
    Ok(())
}

#[tauri::command]
async fn reset_game_config(app_handle: tauri::AppHandle) -> CommandResult<()> {
    debug!("reset_game_config");
    let mut default_game_config = config::GameSettings::default();
    let state = app_handle.state::<Mutex<AppState>>();
    let mut state = state.lock().await;

    state.launch_profiles.reload_presets(true);
    if let Some(new_default_profile) = state.launch_profiles.get_default() {
        default_game_config.launch_profile = new_default_profile.get_id();
    }

    state.config.game = default_game_config;
    state.write_config = true;
    state.save();

    // Also wipe prefixes
    let compat_data_dir = get_app_statics().compat_data_dir.clone();
    if compat_data_dir.exists()
        && let Ok(entries) = std::fs::read_dir(&compat_data_dir)
    {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir()
                && let Err(e) = std::fs::remove_dir_all(&path)
            {
                warn!(
                    "Failed to remove compat data subdirectory {}: {}",
                    path.display(),
                    e
                );
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn create_log_package() -> CommandResult<Option<String>> {
    debug!("create_log_package");
    let internal = async {
        let statics = get_app_statics();
        let launcher_log_path = &statics.launcher_logs_dir;

        if !statics.log_packages_dir.exists() {
            std::fs::create_dir_all(&statics.log_packages_dir)?;
        }

        let timestamp = util::get_timestamp();
        let log_package_path = statics
            .log_packages_dir
            .join(format!("logs_{}.zip", timestamp));

        let file = std::fs::File::create(&log_package_path)?;
        let mut zip = ZipWriter::new(file);

        // Copy all .log files in the launcher logs folder
        if let Ok(dir) = std::fs::read_dir(launcher_log_path) {
            for entry in dir.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().is_some_and(|ext| ext == "log") {
                    let name = path.file_name().unwrap();
                    zip.start_file_from_path(name, SimpleFileOptions::default())?;
                    if let Err(e) = std::io::copy(&mut std::fs::File::open(&path)?, &mut zip) {
                        warn!(
                            "Failed to copy file {} to log package: {}",
                            path.display(),
                            e
                        );
                    }
                }
            }
        }

        // Copy all retained game logs
        if let Ok(dir) = std::fs::read_dir(&statics.unity_logs_dir) {
            for entry in dir.flatten() {
                let entry_path = entry.path();
                if entry_path.is_dir() {
                    let entry_name = entry_path.file_name().unwrap();
                    if let Ok(files) = std::fs::read_dir(&entry_path) {
                        for file_entry in files.flatten() {
                            let file_path = file_entry.path();
                            if file_path.is_file() {
                                let name = file_path.file_name().unwrap();
                                zip.start_file_from_path(
                                    format!(
                                        "{}/{}",
                                        entry_name.to_string_lossy(),
                                        name.to_string_lossy()
                                    ),
                                    SimpleFileOptions::default(),
                                )?;

                                if let Err(e) =
                                    std::io::copy(&mut std::fs::File::open(&file_path)?, &mut zip)
                                {
                                    warn!(
                                        "Failed to copy file {} to log package: {}",
                                        file_path.display(),
                                        e
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        // Copy config.json
        let config_path = get_app_statics().app_data_dir.join("config.json");
        if config_path.is_file() {
            zip.start_file_from_path("config.json", SimpleFileOptions::default())?;

            if let Err(e) = std::io::copy(&mut std::fs::File::open(&config_path)?, &mut zip) {
                warn!("Failed to copy config.json to log package: {}", e);
            }
        }

        // Copy launch_profiles.json
        let launch_profiles_path = get_app_statics().app_data_dir.join("launch_profiles.json");
        if launch_profiles_path.is_file() {
            zip.start_file_from_path("launch_profiles.json", SimpleFileOptions::default())?;

            if let Err(e) =
                std::io::copy(&mut std::fs::File::open(&launch_profiles_path)?, &mut zip)
            {
                warn!("Failed to copy launch_profiles.json to log package: {}", e);
            }
        }

        zip.finish()?;

        match tauri_plugin_opener::reveal_item_in_dir(&log_package_path) {
            Ok(()) => Ok(None), // Revealed in file explorer; don't need the path in the toast
            Err(_) => Ok(Some(log_package_path.display().to_string())),
        }
    };
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
async fn check_for_update() -> CommandResult<Option<UpdateInfo>> {
    debug!("check_for_update");
    let internal = async {
        let resp_raw = util::do_simple_get(UPDATE_CHECK_URL).await?;
        let resp: UpdateCheckResponse = serde_json::from_str(&resp_raw)?;
        if !VERSION_NUMBER_REGEX.is_match(&resp.tag_name) {
            return Err(format!("Invalid version number: {}", resp.tag_name).into());
        }
        let current_version = util::string_version_to_u32(get_app_statics().get_version());
        let latest_version = util::string_version_to_u32(resp.tag_name.trim_start_matches("v"));
        if latest_version <= current_version {
            return Ok(None);
        }
        Ok(Some(UpdateInfo {
            version: resp.tag_name,
            url: String::from(DOWNLOAD_PAGE_URL),
        }))
    };
    internal.await.map_err(|e: Error| e.to_string())
}

#[tauri::command]
fn should_use_custom_titlebar() -> bool {
    debug!("should_use_custom_titlebar");

    // The window decorations on Linux seem correct now
    //cfg!(target_os = "linux")
    false
}

#[tauri::command]
fn get_platform() -> &'static str {
    debug!("get_platform");
    std::env::consts::OS
}

#[tauri::command]
fn get_ffrunner_version() -> String {
    fn get_from_git_tree() -> String {
        let git_command = "git submodule status";
        let output = std::process::Command::new("sh")
            .arg("-c")
            .arg(git_command)
            .output();

        if let Ok(output) = output
            && output.status.success()
            && let Ok(stdout) = String::from_utf8(output.stdout)
        {
            let mut rev = stdout.split_whitespace().next().unwrap_or("unknown");
            if rev.len() > 7 {
                // Trim to short revision hash
                rev = &rev[..7];
            }
            return rev.to_string();
        }

        String::from("unknown")
    }

    debug!("get_ffrunner_version");
    // This is stamped during the CI build
    option_env!("FFRUNNER_VERSION")
        .map(String::from)
        .unwrap_or_else(
            // Dev build running locally; grab it from the local Git tree.
            get_from_git_tree,
        )
}

#[tauri::command]
fn get_webplayer_dll_version() -> &'static str {
    debug!("get_webplayer_dll_version");
    // This is stamped during the CI build
    option_env!("WEBPLAYER_DLL_VERSION").unwrap_or("unknown")
}

#[tauri::command]
fn is_debug_mode() -> bool {
    debug!("is_debug_mode");
    cfg!(debug_assertions)
}

#[tauri::command]
async fn take_pending_activations(app_handle: tauri::AppHandle) -> Vec<ProtocolActivation> {
    debug!("take_pending_activations");
    let state = app_handle.state::<Mutex<AppState>>();
    let mut state = state.lock().await;
    std::mem::take(&mut state.pending_activations)
}

fn show_windows(app_handle: &tauri::AppHandle) {
    app_handle.webview_windows().values().for_each(|w| {
        let _ = w.show(); // show in case it's hidden for a launch
        let _ = w.set_focus();
    });
}

fn handle_deep_links(app_handle: &tauri::AppHandle, urls: Vec<url::Url>) {
    for url in urls {
        let url_str = url.as_str();
        debug!("Handling deep link: {}", url_str);

        #[cfg(debug_assertions)]
        util::send_alert(
            app_handle.clone(),
            AlertVariant::Info,
            &format!("Handling deep link: {}", url_str),
        );

        util::handle_protocol_activation(app_handle.clone(), url_str);
    }
}

#[allow(clippy::single_match)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Single instance plugin needs to be first.
        // With the `deep-link`` feature, this forwards deep links in args to the deep-link plugin.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_windows(app);
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(5)) // 40 KB per file; just keep 5
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    })
                    .filter(|meta| meta.level() != log::Level::Trace),
                ])
                .build(),
        )
        .setup(|app| {
            #[cfg(any(windows, target_os = "linux"))]
            app.deep_link().register_all()?;

            #[cfg(target_os = "linux")]
            if let Err(e) = util::install_appimage_desktop_entry(app.handle()) {
                warn!("Failed to install AppImage desktop entry: {}", e);
            }

            // we have a custom title bar on Linux
            if should_use_custom_titlebar() {
                app.webview_windows().values_mut().for_each(|w| {
                    debug!("dec off");
                    let _ = w.set_decorations(false);
                });
            }

            state::init_app_statics(app);
            info!("OpenFusion Launcher v{}", get_app_statics().get_version());
            // N.B. AppState::load depends on APP_STATICS
            let app_state = AppState::default();
            app.manage(Mutex::new(app_state));

            // The cold start deep link is captured before setup runs, so the listener below misses it
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                handle_deep_links(app.handle(), urls);
            }

            // Warm start callback
            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                show_windows(&app_handle);
                handle_deep_links(&app_handle, event.urls());
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            reload_state,
            should_use_custom_titlebar,
            get_platform,
            get_ffrunner_version,
            get_webplayer_dll_version,
            is_debug_mode,
            take_pending_activations,
            check_for_update,
            create_log_package,
            get_versions,
            get_servers,
            get_launch_profiles,
            get_config,
            add_launch_profile,
            update_launch_profile,
            delete_launch_profile,
            update_config,
            reset_launcher_config,
            reset_game_config,
            add_server,
            update_server,
            delete_server,
            import_version,
            add_version_manual,
            remove_version,
            open_folder_for_version,
            live_check,
            get_info_for_server,
            get_announcements_for_server,
            get_versions_for_server,
            get_player_count_for_server,
            import_from_openfusionclient,
            do_register,
            do_login,
            do_logout,
            get_session,
            get_account_info,
            send_otp,
            update_email,
            update_password,
            prep_launch,
            do_launch,
            validate_cache,
            download_cache,
            delete_cache,
        ])
        .build(tauri::generate_context![])
        .unwrap()
        .run(|_, _| ());
}
