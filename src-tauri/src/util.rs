#![allow(dead_code)]

use std::{
    collections::HashMap,
    env,
    ffi::{OsStr, OsString},
    path::{Path, PathBuf},
    process::Command,
    sync::{OnceLock, mpsc},
    time::Duration,
};

use discord_sdk::{
    Discord, DiscordApp, Subscriptions,
    wheel::{UserState, Wheel},
};
use dns_lookup::lookup_host;
use ffbuildtool::{FailReason, ItemProgress, Version};
use log::*;
use serde::Serialize;
use tauri::{Emitter as _, Manager as _};
use uuid::Uuid;

use crate::{
    CACHE_PROGRESS_EVENT, CacheEvent, CacheProgress, CacheProgressItem, NewServerDetails, Result,
    state::{self, AppState, LaunchProfile, get_app_statics},
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

pub(crate) struct DiscordClient {
    pub discord: Discord,
    pub wheel: Wheel,
}

static DISCORD_CLIENT: tokio::sync::OnceCell<DiscordClient> = tokio::sync::OnceCell::const_new();
pub(crate) async fn get_discord_client() -> Result<&'static DiscordClient> {
    // This timeout doesn't block game launch; just anything that uses Discord, like the activity.
    const DISCORD_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

    let client = DISCORD_CLIENT
        .get_or_try_init(|| async { make_discord_client() })
        .await?;

    // discord-sdk never reports a failure to connect (it only retries), so a
    // missing/closed Discord would otherwise make us wait forever.
    debug!("Waiting for Discord handshake...");
    let mut user = client.wheel.user();
    match tokio::time::timeout(
        DISCORD_CONNECT_TIMEOUT,
        user.0
            .wait_for(|state| matches!(state, UserState::Connected(_))),
    )
    .await
    {
        Ok(Ok(_)) => {}
        Ok(Err(e)) => return Err(format!("Discord handler closed: {}", e).into()),
        Err(_) => return Err("Timed out waiting for Discord connection".into()),
    }

    debug!("Connected to Discord");
    Ok(client)
}

fn make_discord_client() -> Result<DiscordClient> {
    const DISCORD_APP_ID: i64 = 745676299997020302;
    const DISCORD_SUBSCRIPTIONS: Subscriptions = Subscriptions::ACTIVITY;

    let (wheel, handler) = Wheel::new(Box::new(|err| {
        warn!("Discord error: {:?}", err);
    }));

    let discord = Discord::new(
        DiscordApp::PlainId(DISCORD_APP_ID),
        DISCORD_SUBSCRIPTIONS,
        Box::new(handler),
    )?;

    Ok(DiscordClient { discord, wheel })
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
    let whole_part = version.split('-').next().unwrap_or(version);
    let mut version_parts = whole_part
        .split('.')
        .map(|part| part.parse::<u32>().unwrap());
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

    // if we alredy have an IP, nothing to resolve
    if host.parse::<std::net::IpAddr>().is_ok() {
        return Ok(addr.to_string());
    }

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

pub(crate) fn get_env_var_value(cmd: &Command, var: &str) -> Option<String> {
    // Check vars on command first
    for env_var in cmd.get_envs() {
        if let (key, Some(value)) = env_var {
            let value = value.to_string_lossy().to_string();
            if key == var && !value.is_empty() {
                return Some(value);
            }
        }
    }

    // Check env
    if let Ok(value) = env::var(var)
        && !value.is_empty()
    {
        return Some(value);
    }

    None
}

#[cfg(target_os = "macos")]
fn find_macos_wine_installs() -> Vec<(String, PathBuf, isize)> {
    const CANDIDATES: [&str; 5] = [
        "/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/CrossOver-Hosted Application/wineloader",
        "/Applications/Wine Crossover.app/Contents/Resources/wine/bin/wine",
        "/Applications/Wine Stable.app/Contents/Resources/wine/bin/wine",
        "/Applications/Wine Devel.app/Contents/Resources/wine/bin/wine",
        "/Applications/Wine Staging.app/Contents/Resources/wine/bin/wine",
    ];

    let mut installs = Vec::new();
    for (i, p) in CANDIDATES.iter().enumerate() {
        let path = PathBuf::from(p);
        if path.exists() {
            let app_name = path
                .to_string_lossy()
                .split("/")
                .nth(2)
                .unwrap()
                .trim_end_matches(".app")
                .to_string();

            let weight = (CANDIDATES.len() as isize - i as isize) * 10;
            installs.push((app_name, path, weight));
        }
    }
    installs
}

/// Returns a list of preset launch profiles based on the OS and
/// available compatibility layers, in order of preference.
pub(crate) fn get_preset_launch_profiles() -> Vec<LaunchProfile> {
    let mut profiles = Vec::new();

    #[cfg(target_os = "windows")]
    {
        // On Windows, we can just run the game directly with no compatibility layer
        profiles.push(LaunchProfile::new_preset("Native", "{}", None));
    }

    #[cfg(target_os = "macos")]
    {
        // Find Wine installs
        for (app_name, wine_path, weight) in find_macos_wine_installs() {
            let wine_cmd = format!("{} {{}}", quote_launch_arg(&wine_path.to_string_lossy()));
            profiles.push(LaunchProfile::new_preset(
                &app_name,
                &wine_cmd,
                Some(weight),
            ));
        }
    }

    #[cfg(target_os = "linux")]
    {
        use regex::Regex;
        use std::sync::LazyLock;

        static PROTON_NAME_REGEX: LazyLock<Regex> =
            LazyLock::new(|| Regex::new(r#"^Proton ([+-]?\d+)(?:\.\d+)?$"#).unwrap());

        // Find Proton installs
        for proton_install in protontools::find_all_proton_installs() {
            let steam_linux_runtime_path = proton_install.get_runtime().get_exe_path();
            let proton_path = proton_install.get_exe_path();
            let profile_name = proton_install.get_name();
            let proton_version = PROTON_NAME_REGEX
                .captures(profile_name)
                .and_then(|caps| caps.get(1))
                .map(|m| m.as_str().to_string());

            // Weigh by Proton version (prefers higher versions)
            let profile_weight = proton_version.and_then(|v| v.parse::<isize>().ok());

            let launch_command = format!(
                "{} --verb=run -- {} run {{}}",
                quote_launch_arg(&steam_linux_runtime_path.to_string_lossy()),
                quote_launch_arg(&proton_path.to_string_lossy())
            );

            profiles.push(LaunchProfile::new_preset(
                profile_name,
                &launch_command,
                profile_weight,
            ));
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Look for Wine on PATH
        if let Ok(wine) = which::which("wine") {
            let name = format!("Wine ({})", wine.to_string_lossy());
            let wine_cmd = format!("{} {{}}", quote_launch_arg(&wine.to_string_lossy()));

            // Weigh negative to prefer Proton and specialized Wine installs
            profiles.push(LaunchProfile::new_preset(&name, &wine_cmd, Some(-1)));
        }
    }

    profiles
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
    trace!("=> GET {}", url);
    let response = get_http_client().get(url).send().await?;
    if !response.status().is_success() {
        return Err(format!("Failed to GET {}: {}", url, response.status()).into());
    }
    let text = response.text().await?;
    trace!("<= {}", text);
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

/// Whether this copy of the launcher was installed in a way the updater plugin can replace.
/// Portable/standalone builds have to be updated manually.
pub(crate) fn is_auto_update_supported(app_handle: &tauri::AppHandle) -> bool {
    if cfg!(debug_assertions) {
        return false;
    }

    #[cfg(target_os = "linux")]
    {
        app_handle.env().appimage.is_some()
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = app_handle;
        let Ok(exe) = env::current_exe() else {
            return false;
        };

        if cfg!(target_os = "windows") {
            // The NSIS installer drops an uninstaller next to the executable
            exe.parent()
                .is_some_and(|dir| dir.join("uninstall.exe").is_file())
        } else if cfg!(target_os = "macos") {
            exe.to_string_lossy().contains(".app/Contents/MacOS/")
        } else {
            false
        }
    }
}

#[allow(clippy::enum_variant_names)]
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub(crate) enum ProtocolActivation {
    AddServer(NewServerDetails),
    ShowExistingServer(Uuid),
    LaunchServer(Uuid),
}

async fn queue_activation(app_handle: tauri::AppHandle, activation: ProtocolActivation) {
    // since this might run on cold start, the app state might not be ready yet
    state::wait_for_app_state().await;
    let state = app_handle.state::<tokio::sync::Mutex<AppState>>();
    state.lock().await.pending_activations.push(activation);

    if let Err(e) = app_handle.emit("activation_pending", ()) {
        error!("Failed to emit activation pending event: {}", e);
    }
}

fn handle_server_activation(app_handle: tauri::AppHandle, details: NewServerDetails) {
    tauri::async_runtime::spawn(async move {
        state::wait_for_app_state().await;
        let state = app_handle.state::<tokio::sync::Mutex<AppState>>();
        let existing_server = {
            let state = state.lock().await;

            // Check if the server is already added.
            if let Some(endpoint) = &details.endpoint {
                state.servers.find_endpoint_entry(endpoint).cloned()
            } else if let Some(ip) = &details.ip
                && let Some(version) = &details.version
            {
                state.servers.find_simple_entry(ip, version).cloned()
            } else {
                None
            }
        };

        let activation = match existing_server {
            Some(server) => {
                let existing_server_uuid = server.get_uuid();
                if server.is_trusted() {
                    ProtocolActivation::LaunchServer(existing_server_uuid)
                } else {
                    ProtocolActivation::ShowExistingServer(existing_server_uuid)
                }
            }
            None => ProtocolActivation::AddServer(details),
        };

        queue_activation(app_handle, activation).await;
    });
}

fn parse_protocol_query(query: &str) -> HashMap<String, String> {
    url::form_urlencoded::parse(query.as_bytes())
        .into_owned()
        .collect()
}

pub(crate) fn handle_protocol_activation(app_handle: tauri::AppHandle, uri: &str) {
    let Some(stripped_uri) = uri.strip_prefix("ofl://") else {
        warn!("Invalid protocol activation URI: {}", uri);
        return;
    };

    let parts: Vec<&str> = stripped_uri.splitn(2, '?').collect();
    let command = parts[0].trim_end_matches('/'); // some systems/browsers add a trailing slash
    let mut params = HashMap::new();
    if parts.len() > 1 {
        params = parse_protocol_query(parts[1]);
    }

    debug!("Protocol activation command: {}", command);
    debug!("Protocol activation params: {:?}", params);

    match command {
        "server" => {
            handle_server_activation(
                app_handle,
                NewServerDetails {
                    description: params.get("description").cloned().unwrap_or_default(),
                    ip: params.get("ip").cloned(),
                    version: params.get("version").cloned(),
                    endpoint: params.get("endpoint").cloned(),
                },
            );
        }
        _ => {
            warn!("Unknown protocol activation command: {}", command);
            send_alert(app_handle, AlertVariant::Error, "Invalid link");
        }
    }
}

/// Splits a launch format string into arguments. Single and double quotes group text,
/// and `\"` outside single quotes is a literal double quote. Other backslashes are
/// literal so Windows paths work unquoted.
fn tokenize_launch_command(launch_cmd: &str) -> Result<Vec<String>> {
    let mut tokens = Vec::new();
    let mut current_token = String::new();
    // Distinguishes an empty quoted argument ("") from no argument at all
    let mut has_token = false;
    let mut in_single_quotes = false;
    let mut in_double_quotes = false;
    let mut chars = launch_cmd.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '\\' if !in_single_quotes && chars.peek() == Some(&'"') => {
                chars.next();
                current_token.push('"');
                has_token = true;
            }
            '\'' if !in_double_quotes => {
                in_single_quotes = !in_single_quotes;
                has_token = true;
            }
            '"' if !in_single_quotes => {
                in_double_quotes = !in_double_quotes;
                has_token = true;
            }
            ' ' if !in_single_quotes && !in_double_quotes => {
                if has_token {
                    tokens.push(std::mem::take(&mut current_token));
                    has_token = false;
                }
            }
            _ => {
                current_token.push(c);
                has_token = true;
            }
        }
    }

    if in_single_quotes || in_double_quotes {
        return Err("Invalid launch format string: unclosed quote".into());
    }

    if has_token {
        tokens.push(current_token);
    }

    Ok(tokens)
}

/// Double-quotes an argument so that `tokenize_launch_command` reads it back verbatim.
fn quote_launch_arg(arg: &str) -> String {
    // A backslash right before the closing quote would escape it, so trailing
    // backslashes go after the closing quote, where they are literal.
    let body = arg.trim_end_matches('\\');
    let trailing = &arg[body.len()..];
    format!("\"{}\"{}", body.replace('"', "\\\""), trailing)
}

fn quote_launch_arg_if_needed(arg: &str) -> String {
    if arg.is_empty() || arg.contains([' ', '"', '\'']) {
        quote_launch_arg(arg)
    } else {
        arg.to_string()
    }
}

fn extract_env_vars_from_tokens(tokens: &mut Vec<String>) -> HashMap<String, String> {
    let mut env_vars = HashMap::new();
    let mut i = 0;
    while i < tokens.len() {
        if !tokens[i].starts_with("-")
            && let Some((key, value)) = tokens[i].split_once('=')
            && !key.trim().is_empty()
        {
            env_vars.insert(key.to_string(), value.to_string());
            tokens.remove(i);
        } else {
            i += 1;
        }
    }
    env_vars
}

const BASE_CMD_PLACEHOLDER: &str = "{}";

fn expand_env_placeholders(token: &str) -> Result<String> {
    let mut out = String::new();
    let mut rest = token;
    while let Some(start) = rest.find('{') {
        let Some(len) = rest[start..].find('}') else {
            break;
        };
        let name = &rest[start + 1..start + len];
        if name.is_empty() {
            return Err(format!(
                "Invalid launch format string: {} must be a standalone argument",
                BASE_CMD_PLACEHOLDER
            )
            .into());
        }
        let value = env::var(name).map_err(|_| format!("Environment variable {} not set", name))?;
        out.push_str(&rest[..start]);
        out.push_str(&value);
        rest = &rest[start + len + 1..];
    }
    out.push_str(rest);
    Ok(out)
}

pub(crate) fn gen_launch_command(base_cmd: Command, launch_fmt: &str) -> Result<Command> {
    // Only the user-provided format string is tokenized. The base command's program and
    // args are spliced in afterwards as discrete args so they never get re-split.
    let launch_fmt = launch_fmt.replace("\r\n", " ").replace('\n', " ");
    let mut tokens = tokenize_launch_command(&launch_fmt)?
        .into_iter()
        .map(|token| {
            if token == BASE_CMD_PLACEHOLDER {
                Ok(token)
            } else {
                expand_env_placeholders(&token)
            }
        })
        .collect::<Result<Vec<_>>>()?;

    let user_env_vars = extract_env_vars_from_tokens(&mut tokens);
    let base_args: Vec<OsString> = std::iter::once(base_cmd.get_program())
        .chain(base_cmd.get_args())
        .map(OsStr::to_os_string)
        .collect();

    let mut base_replaced = false;
    let mut args: Vec<OsString> = Vec::new();
    for token in tokens {
        if token == BASE_CMD_PLACEHOLDER {
            args.extend(base_args.iter().cloned());
            base_replaced = true;
        } else {
            args.push(token.into());
        }
    }

    if !base_replaced {
        return Err(format!(
            "Invalid launch format string: missing {}",
            BASE_CMD_PLACEHOLDER
        )
        .into());
    }

    let mut launch_command = Command::new(&args[0]);
    launch_command.current_dir(
        base_cmd
            .get_current_dir()
            .ok_or("Invalid working directory".to_string())?,
    );

    for env in base_cmd.get_envs() {
        launch_command.env(env.0, env.1.unwrap());
    }
    for (key, value) in user_env_vars {
        launch_command.env(key, value);
    }

    launch_command.args(&args[1..]);
    Ok(launch_command)
}

pub(crate) fn get_launch_cmd_dbg_str(command: &Command, with_env: bool) -> String {
    let mut command_str = quote_launch_arg(&command.get_program().to_string_lossy());
    for arg in command.get_args() {
        command_str.push(' ');
        command_str.push_str(&quote_launch_arg_if_needed(&arg.to_string_lossy()));
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

pub(crate) async fn does_web_file_exist(url: &str) -> bool {
    let client = get_http_client();
    match client.head(url).send().await {
        Ok(response) => response.status().is_success(),
        Err(e) => {
            warn!("Failed to check if web file exists: {}", e);
            false
        }
    }
}

pub(crate) async fn supports_https(url: &str) -> bool {
    let Ok(mut url) = reqwest::Url::parse(url) else {
        return false;
    };

    url.set_scheme("https").ok();
    url.set_path("/");
    url.set_query(None);
    url.set_fragment(None);

    get_http_client().head(url).send().await.is_ok()
}

pub(crate) fn prune_unity_logs() {
    const MAX_COPIED_UNITY_LOG_DIRS: usize = 10;

    let logs_dir = get_app_statics().unity_logs_dir.clone();
    let Ok(entries) = std::fs::read_dir(&logs_dir) else {
        return;
    };

    // The timestamp format in the directory names sorts chronologically
    let mut log_dirs: Vec<PathBuf> = entries
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .filter(|e| e.file_name().to_string_lossy().starts_with("logs_"))
        .map(|e| e.path())
        .collect();

    log_dirs.sort_unstable_by(|a, b| b.cmp(a));

    for old_dir in log_dirs.into_iter().skip(MAX_COPIED_UNITY_LOG_DIRS) {
        if let Err(e) = std::fs::remove_dir_all(&old_dir) {
            warn!("Failed to remove old Unity logs at {:?}: {}", old_dir, e);
        }
    }
}

#[cfg(target_os = "linux")]
pub(crate) fn install_appimage_desktop_entry(app: &tauri::AppHandle) -> Result<()> {
    const GENERATED_MARKER: &str = "X-OpenFusionLauncher-Generated=true";

    let Some(appimage) = app.env().appimage else {
        return Ok(());
    };

    // GTK derives the app ID from the executable name
    let exe = tauri::utils::platform::current_exe()?;
    let app_id = exe
        .file_name()
        .ok_or("executable has no file name")?
        .to_string_lossy()
        .to_string();

    let data_dir = app.path().data_dir()?;
    let desktop_path = data_dir
        .join("applications")
        .join(format!("{}.desktop", app_id));

    if let Ok(existing) = std::fs::read_to_string(&desktop_path)
        && !existing.lines().any(|l| l == GENERATED_MARKER)
    {
        debug!("Not overwriting user-provided {}", desktop_path.display());
        return Ok(());
    }

    // Referenced by absolute path; running processes like plasmashell cache icon theme
    // lookups, so a freshly installed theme icon may not resolve until they restart.
    let icon_path = data_dir
        .join("icons/hicolor/256x256/apps")
        .join(format!("{}.png", app_id));

    write_if_changed(&icon_path, include_bytes!("../icons/128x128@2x.png"))?;

    let name = app
        .config()
        .product_name
        .clone()
        .unwrap_or_else(|| app_id.clone());

    // NoDisplay to avoid duplicating menu entries made by AppImage integration tools
    let desktop_entry = format!(
        "[Desktop Entry]\n\
         Type=Application\n\
         Name={name}\n\
         Exec={exec}\n\
         Icon={icon}\n\
         StartupWMClass={app_id}\n\
         Terminal=false\n\
         NoDisplay=true\n\
         {GENERATED_MARKER}\n",
        name = escape_desktop_string(&name)?,
        exec = escape_desktop_string(&quote_desktop_exec_arg(&appimage.to_string_lossy()))?,
        icon = escape_desktop_string(&icon_path.to_string_lossy())?,
    );

    write_if_changed(&desktop_path, desktop_entry.as_bytes())
}

#[cfg(target_os = "linux")]
fn escape_desktop_string(value: &str) -> Result<String> {
    if value.chars().any(char::is_control) {
        return Err(format!("{:?} cannot be stored in a desktop entry", value).into());
    }
    Ok(value.replace('\\', "\\\\"))
}

#[cfg(target_os = "linux")]
fn quote_desktop_exec_arg(arg: &str) -> String {
    let mut quoted = String::from('"');
    for c in arg.chars() {
        match c {
            '"' | '`' | '$' | '\\' => {
                quoted.push('\\');
                quoted.push(c);
            }
            '%' => quoted.push_str("%%"),
            _ => quoted.push(c),
        }
    }
    quoted.push('"');
    quoted
}

#[cfg(target_os = "linux")]
fn write_if_changed(path: &Path, contents: &[u8]) -> Result<()> {
    if std::fs::read(path).is_ok_and(|existing| existing == contents) {
        return Ok(());
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(path, contents)?;
    debug!("Wrote {:?}", path);
    Ok(())
}
