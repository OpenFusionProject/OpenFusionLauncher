#![allow(dead_code)]

use std::{
    collections::HashMap,
    env,
    path::{Path, PathBuf},
    process::Command,
    sync::{mpsc, OnceLock},
    time::Duration,
};

use dns_lookup::lookup_host;
use ffbuildtool::{FailReason, ItemProgress, Version};
use log::*;
use serde::Serialize;
use tauri::Emitter as _;
use uuid::Uuid;

use crate::{
    state::get_app_statics, CacheEvent, CacheProgress, CacheProgressItem, Result,
    CACHE_PROGRESS_EVENT,
};

static APP_USER_AGENT: &str = concat!(env!("CARGO_PKG_NAME"), "/", env!("CARGO_PKG_VERSION"));
static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
pub(crate) fn get_http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(APP_USER_AGENT)
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap()
    })
}

// for serde
pub(crate) fn true_fn() -> bool {
    true
}

// for serde
pub(crate) fn false_fn() -> bool {
    false
}

pub(crate) fn string_version_to_u32(version: &str) -> u32 {
    let mut version_parts = version.split('.').map(|part| part.parse::<u32>().unwrap());
    let major = version_parts.next().unwrap();
    let minor = version_parts.next().unwrap_or(0);
    let patch = version_parts.next().unwrap_or(0);
    (major << 16) | (minor << 8) | patch
}

pub(crate) fn get_timestamp() -> u64 {
    let now = std::time::SystemTime::now();
    now.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()
}

fn split_addr_port(addr_port: &str) -> Result<(String, u16)> {
    const DEFAULT_PORT: u16 = 23000;
    let mut parts = addr_port.split(':');
    let addr = parts.next().ok_or("Missing address")?.to_string();
    let port = if let Some(port) = parts.next() {
        port.parse::<u16>()?
    } else {
        DEFAULT_PORT
    };
    Ok((addr, port))
}

fn resolve_host(host: &str) -> Result<String> {
    let addrs = lookup_host(host)?;
    for addr in addrs {
        if let std::net::IpAddr::V4(addr) = addr {
            return Ok(addr.to_string());
        }
    }
    Err(format!("No IPv4 address found for {}", host).into())
}

pub(crate) fn resolve_server_addr(addr: &str) -> Result<String> {
    let (host, port) = split_addr_port(addr)?;
    let Ok(ip) = resolve_host(&host) else {
        return Err(format!("Failed to resolve game server address {}", addr).into());
    };
    debug!("Resolved {} to {}", host, ip);
    Ok(format!("{}:{}", ip, port))
}

pub(crate) fn get_default_cache_dir() -> String {
    get_app_statics().ff_cache_dir.to_string_lossy().to_string()
}

pub(crate) fn get_default_offline_cache_dir() -> String {
    get_app_statics()
        .offline_cache_dir
        .to_string_lossy()
        .to_string()
}

pub(crate) fn is_device_steam_deck() -> bool {
    if cfg!(target_os = "linux") {
        if let Ok(content) = std::fs::read_to_string("/sys/devices/virtual/dmi/id/board_vendor") {
            if content.trim() == "Valve" {
                return true;
            }
        }
    }
    false
}

fn get_steam_client_path() -> Option<PathBuf> {
    let home_path = PathBuf::from(env::var("HOME").ok()?);
    let steam_path = home_path.join(".steam/steam");
    if steam_path.exists() {
        Some(steam_path)
    } else {
        None
    }
}

fn get_steam_root_path() -> Option<PathBuf> {
    let home_path = PathBuf::from(env::var("HOME").ok()?);
    let steam_root_path = home_path.join(".steam/root");
    if steam_root_path.exists() {
        Some(steam_root_path)
    } else {
        None
    }
}

fn find_proton() -> Option<PathBuf> {
    let steam_root = get_steam_root_path()?;
    let steamapps_common_path = steam_root.join("steamapps/common/");
    if !steamapps_common_path.exists() {
        return None;
    }

    // Find all installed Proton versions
    let entries = std::fs::read_dir(steamapps_common_path).ok()?;
    let mut candidates = Vec::new();
    for entry in entries {
        let entry = entry.ok()?;
        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy();
        if file_name_str.starts_with("Proton ") {
            let proton_path = entry.path().join("proton");
            if proton_path.exists() {
                let date = entry.metadata().ok()?.modified().ok()?;
                candidates.push((proton_path, date));
            }
        }
    }

    // Sort by modification date, newest first
    candidates.sort_by(|a, b| b.1.cmp(&a.1));
    candidates.first().map(|(path, _)| path.clone())
}

fn find_macos_wine() -> Option<PathBuf> {
    const CANDIDATES: [&str; 5] = [
        "/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/CrossOver-Hosted Application/wineloader",
        "/Applications/Wine Crossover.app/Contents/Resources/wine/bin/wine",
        "/Applications/Wine Stable.app/Contents/Resources/wine/bin/wine",
        "/Applications/Wine Devel.app/Contents/Resources/wine/bin/wine",
        "/Applications/Wine Staging.app/Contents/Resources/wine/bin/wine"
    ];

    for p in &CANDIDATES {
        let path = PathBuf::from(p);
        if path.exists() {
            return Some(path);
        }
    }
    None
}

pub(crate) fn get_default_launch_command() -> Option<String> {
    if cfg!(target_os = "windows") {
        None
    } else if cfg!(target_os = "macos") {
        if let Some(wine_path) = find_macos_wine() {
            Some(format!("\"{}\" {{}}", wine_path.to_string_lossy()))
        } else {
            Some("wine {}".to_string())
        }
    } else if is_device_steam_deck() {
        let steam_compat_data_path = get_app_statics().compat_data_dir.clone();
        let steam_compat_client_install_path = get_steam_client_path()?;
        let proton_path = find_proton()?;
        Some(format!(
            "STEAM_COMPAT_DATA_PATH=\"{}\" STEAM_COMPAT_CLIENT_INSTALL_PATH=\"{}\" \"{}\" run {{}}",
            steam_compat_data_path.to_string_lossy(),
            steam_compat_client_install_path.to_string_lossy(),
            proton_path.to_string_lossy()
        ))
    } else {
        Some("wine {}".to_string())
    }
}

pub(crate) fn get_cache_dir_for_version(base_cache_dir: &str, version: &Version) -> PathBuf {
    let cache_dir = PathBuf::from(base_cache_dir);
    cache_dir.join(version.get_uuid().to_string())
}

pub(crate) fn get_dir_size(dir: &PathBuf) -> Result<u64> {
    let mut size = 0;
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        if metadata.is_symlink() {
            continue;
        }
        if metadata.is_file() {
            size += metadata.len();
        } else if metadata.is_dir() {
            size += get_dir_size(&entry.path())?;
        }
    }
    Ok(size)
}

pub(crate) fn copy_dir(src: &PathBuf, dest: &PathBuf) -> Result<()> {
    if !dest.exists() {
        std::fs::create_dir_all(dest)?;
    }

    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let entry_type = entry.file_type()?;
        let dest_path = dest.join(entry.file_name());
        if entry_type.is_dir() {
            copy_dir(&entry.path(), &dest_path)?;
        } else {
            std::fs::copy(entry.path(), dest_path)?;
        }
    }

    Ok(())
}

pub(crate) fn delete_dir(dir: &PathBuf) -> Result<()> {
    if dir.exists() {
        std::fs::remove_dir_all(dir)?;
    }
    Ok(())
}

pub(crate) fn is_dir_empty(dir: &PathBuf) -> Result<bool> {
    match std::fs::read_dir(dir) {
        Ok(mut entries) => Ok(entries.next().is_none()),
        Err(e) => Err(e.into()),
    }
}

pub(crate) fn get_path_as_file_uri(path: &Path) -> String {
    let protocol = if cfg!(target_os = "windows") {
        "file:///"
    } else {
        "file://"
    };

    let mut uri = String::from(protocol);
    uri.push_str(&path.to_string_lossy());
    uri.replace("\\", "/")
}

pub(crate) fn get_version_name(version: &Version) -> String {
    if let Some(name) = version.get_name() {
        name.to_string()
    } else {
        version.get_uuid().to_string()
    }
}

pub(crate) fn import_versions(to_import: Vec<Version>) -> Result<Vec<Version>> {
    let versions_path = get_app_statics().app_data_dir.join("versions");
    if !versions_path.exists() {
        std::fs::create_dir_all(&versions_path)?;
    }

    let mut versions = Vec::new();
    for version in to_import {
        let version_path = versions_path.join(format!("{}.json", version.get_uuid()));
        if let Err(e) = version.export_manifest(&version_path.to_string_lossy()) {
            warn!("Failed to import version: {}", e);
            continue;
        }
        debug!("Imported version to {}", version_path.to_string_lossy());
        versions.push(version);
    }
    Ok(versions)
}

pub(crate) fn remove_version(uuid: Uuid, filenames: &HashMap<Uuid, String>) -> Result<()> {
    let versions_path = get_app_statics().app_data_dir.join("versions");
    let filename = match filenames.get(&uuid) {
        Some(filename) => filename.clone(),
        None => format!("{}.json", uuid),
    };
    let version_path = versions_path.join(filename);
    if version_path.exists() {
        std::fs::remove_file(version_path)?;
    } else {
        return Err(format!("Version file not found: {}", version_path.to_string_lossy()).into());
    }
    Ok(())
}

pub(crate) async fn do_live_check(url: &str) -> bool {
    let client = get_http_client();
    let Ok(res) = client.get(url).send().await else {
        return false;
    };
    let status = res.status();
    status.is_success()
}

pub(crate) async fn do_simple_get(url: &str) -> Result<String> {
    debug!("=> GET {}", url);
    let response = get_http_client().get(url).send().await?;
    if !response.status().is_success() {
        return Err(format!("Failed to GET {}: {}", url, response.status()).into());
    }
    let text = response.text().await?;
    debug!("<= {}", text);
    Ok(text)
}

pub(crate) fn cache_progress_loop(
    offline: bool,
    app_handle: tauri::AppHandle,
    item_rx: mpsc::Receiver<CacheEvent>,
    uuid: Uuid,
) {
    const POLL_INTERVAL: std::time::Duration = std::time::Duration::from_millis(250);

    let mut items = HashMap::new();
    let mut done = false;
    while !done {
        std::thread::sleep(POLL_INTERVAL);
        while let Ok(event) = item_rx.try_recv() {
            match event {
                CacheEvent::ItemProcessed(name, item) => {
                    items.insert(name, item);
                }
                CacheEvent::Done => {
                    done = true;
                }
            }
        }

        let progress = CacheProgress {
            offline,
            uuid,
            items: items.clone(),
            done,
        };
        if let Err(e) = app_handle.emit(CACHE_PROGRESS_EVENT, progress) {
            error!("Failed to emit cache progress event: {}", e);
        }
    }
}

pub(crate) fn cache_progress_callback(
    item_tx: mpsc::Sender<CacheEvent>,
    item_name: &str,
    progress: ItemProgress,
) {
    let item = match progress {
        ItemProgress::Failed { item_size, reason } => CacheProgressItem {
            item_size,
            corrupt: true,
            missing: matches!(reason, FailReason::Missing),
        },
        ItemProgress::Passed { item_size } => CacheProgressItem {
            item_size,
            corrupt: false,
            missing: false,
        },
        _ => return,
    };

    let event = CacheEvent::ItemProcessed(item_name.to_string(), item);
    if let Err(e) = item_tx.send(event) {
        error!("Failed to send cache progress event: {}", e);
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AlertVariant {
    Info,
    Warning,
    Error,
    Success,
}

#[derive(Clone, Serialize)]
struct AlertEvent {
    variant: AlertVariant,
    message: String,
}

pub(crate) fn send_alert(app_handle: tauri::AppHandle, variant: AlertVariant, message: &str) {
    let payload = AlertEvent {
        variant,
        message: message.to_string(),
    };
    if let Err(e) = app_handle.emit("alert", payload) {
        error!("Failed to emit alert event: {}", e);
    }
}

fn tokenize_launch_command(launch_cmd: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current_token = String::new();
    let mut in_single_quotes = false;
    let mut in_double_quotes = false;
    let mut chars = launch_cmd.chars().peekable();

    while let Some(&c) = chars.peek() {
        match c {
            '\'' if !in_double_quotes => {
                in_single_quotes = !in_single_quotes;
                chars.next();
            }
            '"' if !in_single_quotes => {
                in_double_quotes = !in_double_quotes;
                chars.next();
            }
            ' ' if !in_single_quotes && !in_double_quotes => {
                if !current_token.is_empty() {
                    tokens.push(current_token.clone());
                    current_token.clear();
                }
                chars.next();
            }
            _ => {
                current_token.push(c);
                chars.next();
            }
        }
    }

    if !current_token.is_empty() {
        tokens.push(current_token);
    }

    tokens
}

fn extract_env_vars_from_tokens(tokens: &mut Vec<String>) -> HashMap<String, String> {
    let mut env_vars = HashMap::new();
    let mut i = 0;
    while i < tokens.len() {
        if tokens[i].contains('=') {
            let mut parts = tokens[i].split('=');
            let key = parts.next().unwrap();
            if key.trim().is_empty() {
                i += 1;
                continue;
            }

            let value = parts.next().unwrap();
            env_vars.insert(key.to_string(), value.to_string());
            tokens.remove(i);
        } else {
            i += 1;
        }
    }
    env_vars
}

pub(crate) fn gen_launch_command(base_cmd: Command, launch_fmt: &str) -> Command {
    const REPLACEMENT_TOKEN: &str = "{}";

    let mut base_command_str = base_cmd.get_program().to_string_lossy().to_string();
    for arg in base_cmd.get_args() {
        base_command_str.push(' ');
        base_command_str.push_str(arg.to_string_lossy().to_string().as_str());
    }

    let launch_command_str = launch_fmt.replace(REPLACEMENT_TOKEN, &base_command_str);
    let mut launch_command_tokens = tokenize_launch_command(&launch_command_str);
    let user_env_vars = extract_env_vars_from_tokens(&mut launch_command_tokens);

    let mut launch_command = Command::new(&launch_command_tokens[0]);
    launch_command.current_dir(base_cmd.get_current_dir().unwrap());

    for env in base_cmd.get_envs() {
        launch_command.env(env.0, env.1.unwrap());
    }
    for (key, value) in user_env_vars {
        assert!(!key.trim().is_empty());
        launch_command.env(key, value);
    }

    launch_command.args(&launch_command_tokens[1..]);
    launch_command
}

pub(crate) fn get_launch_cmd_dbg_str(command: &Command, with_env: bool) -> String {
    let mut command_str = format!("\"{}\"", command.get_program().to_string_lossy());
    for arg in command.get_args() {
        command_str.push(' ');
        command_str.push_str(arg.to_string_lossy().to_string().as_str());
    }

    if with_env {
        for env in command.get_envs() {
            command_str.push_str("\n\t");
            let env_str = format!(
                "{}={}",
                env.0.to_string_lossy(),
                env.1.unwrap().to_string_lossy()
            );
            command_str.push_str(&env_str);
        }
    }

    command_str
}

pub(crate) fn log_command(command: &Command) {
    let command_str = get_launch_cmd_dbg_str(command, true);
    debug!("Launching game: {}", command_str);
}
