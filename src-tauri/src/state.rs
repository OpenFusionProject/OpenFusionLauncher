use std::{collections::HashMap, path::PathBuf, process::Command, sync::OnceLock};

use ffbuildtool::Version;
use log::*;
use serde::{Deserialize, Serialize};
use tauri::{path::BaseDirectory, Manager};
use uuid::Uuid;

use crate::{
    config::{GameSettings, LauncherSettings},
    util::{self, AlertVariant},
    NewServerDetails, Result,
};

const OPENFUSIONCLIENT_PATH: &str = "OpenFusionClient";

static APP_STATICS: OnceLock<AppStatics> = OnceLock::new();

pub fn init_app_statics(app: &mut tauri::App) {
    let statics = AppStatics::load(app);
    dbg!(&statics);
    APP_STATICS.set(statics).unwrap();
}

pub fn get_app_statics() -> &'static AppStatics {
    APP_STATICS.get().unwrap()
}

#[derive(Debug)]
pub struct AppStatics {
    version: String,
    pub app_data_dir: PathBuf,
    pub resource_dir: PathBuf,
    pub ff_cache_dir: PathBuf,
    pub offline_cache_dir: PathBuf,
    pub compat_data_dir: PathBuf,
    pub ffrunner_log_path: PathBuf,
}
impl AppStatics {
    fn load(app: &mut tauri::App) -> Self {
        let version = app.handle().package_info().version.to_string();
        let path_resolver = app.handle().path();
        let app_data_dir = path_resolver.app_data_dir().unwrap();

        let mut resource_dir = path_resolver.resource_dir().unwrap();
        if !std::fs::exists(resource_dir.join("ffrunner.exe")).unwrap_or(false) {
            // Resource directory is incorrect. Assume standalone build
            // and use the current executable's directory as the resource dir.
            resource_dir = std::env::current_exe().unwrap().parent().unwrap().into();
        }

        let ff_cache_dir = path_resolver
            .resolve("ffcache", BaseDirectory::AppCache)
            .unwrap();
        let offline_cache_dir = path_resolver
            .resolve("offline_cache", BaseDirectory::AppCache)
            .unwrap();
        let compat_data_dir = path_resolver
            .resolve("compat_data", BaseDirectory::AppCache)
            .unwrap();
        let ffrunner_log_path = app_data_dir.join("ffrunner.log");

        Self {
            version,
            app_data_dir,
            resource_dir,
            ff_cache_dir,
            offline_cache_dir,
            compat_data_dir,
            ffrunner_log_path,
        }
    }

    pub fn get_version(&self) -> &str {
        &self.version
    }
}

#[derive(Default)]
pub struct AppState {
    pub config: Config,
    pub versions: Versions,
    pub servers: Servers,
    pub tokens: Tokens,
    //
    pub temp_tokens: HashMap<Uuid, String>,
    pub write_config: bool,
    pub launch_cmd: Option<Command>,
}
impl AppState {
    pub fn load(app_handle: tauri::AppHandle) -> Self {
        let config = Config::new();
        let (config, write_config) = match config {
            Ok(config) => (config, true),
            Err(e) => {
                let config_exists = get_app_statics().app_data_dir.join("config.json").exists();
                if config_exists {
                    // config exists but is malformed. warn and do not overwrite
                    let msg = format!("Failed to load config: {}", e);
                    warn!("{}", msg);
                    util::send_alert(app_handle, AlertVariant::Warning, &msg);
                }
                (Config::load_default(), !config_exists)
            }
        };

        let versions = Versions::new();
        let mut servers = Servers::new();
        let tokens = Tokens::new();

        // Old server entries use the version description instead of the UUID.
        // This migrates them to use the UUID instead.
        // The fixed entries will be written out on save.
        Self::fixup_server_versions(&mut servers, &versions);

        Self {
            config,
            versions,
            servers,
            tokens,
            //
            temp_tokens: HashMap::new(),
            write_config,
            launch_cmd: None,
        }
    }

    pub fn save(&self) {
        debug!("Saving app state");
        let app_data_dir = &get_app_statics().app_data_dir;
        if !app_data_dir.exists() {
            if let Err(e) = std::fs::create_dir_all(app_data_dir) {
                warn!(
                    "Failed to create app data dir: {}\nCan't save app state!",
                    e
                );
                return;
            }
        }

        // we don't want to override the config file on disk
        // if it was invalid at load time
        if self.write_config {
            if let Err(e) = self.config.save() {
                warn!("Failed to save config: {}", e);
            }
        }

        if let Err(e) = self.servers.save() {
            warn!("Failed to save servers: {}", e);
        }
        if let Err(e) = self.tokens.save() {
            warn!("Failed to save tokens: {}", e);
        }
    }

    pub fn import_servers(&mut self) -> Result<usize> {
        let imported_servers = Servers::load_from_openfusionclient()?;
        if let Some(mut servers) = imported_servers {
            Self::fixup_server_versions(&mut servers, &self.versions);
            Ok(self.servers.merge(&servers))
        } else {
            Ok(0)
        }
    }

    pub fn fixup_server_versions(servers: &mut Servers, versions: &Versions) {
        for server in &mut servers.servers {
            if let ServerInfo::Simple { version, .. } = &mut server.info {
                if let Some(correct_version) = versions.get_entry_by_name(version) {
                    *version = correct_version.get_uuid().to_string();
                }
            }
        }
    }

    pub fn import_versions(&mut self) -> Result<usize> {
        let versions = &mut self.versions.versions;
        let legacy_versions = Versions::load_from_openfusionclient()?;
        let to_import = Versions::calculate_merge(versions, legacy_versions);
        let imported = util::import_versions(to_import)?;
        let num_imported = imported.len();
        versions.extend(imported);
        Ok(num_imported)
    }

    pub fn get_version_use_count(&self, uuid: Uuid) -> usize {
        self.servers
            .servers
            .iter()
            .filter(|s| match &s.info {
                ServerInfo::Simple { version, .. } => version == &uuid.to_string(),
                // for endpoint servers, this is less straightforward since we don't know the versions
                // until we query the endpoint, and we really don't want to query every endpoint server to get this info.
                // we can use the user's preferred version as a best guess here
                // and it'll be fine since most cache upgrades happen only when a version is deprecated by a server anyway.
                ServerInfo::Endpoint {
                    preferred_version, ..
                } => preferred_version.as_ref() == Some(&uuid.to_string()),
            })
            .count()
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Config {
    pub launcher: LauncherSettings,
    pub game: GameSettings,
}
impl Config {
    fn new() -> Result<Self> {
        Self::load()
    }

    fn load() -> Result<Self> {
        let config_path = get_app_statics().app_data_dir.join("config.json");
        let config_str = std::fs::read_to_string(config_path)?;
        let config: Self = serde_json::from_str(&config_str)?;
        Ok(config)
    }

    fn save(&self) -> Result<()> {
        let config_path = get_app_statics().app_data_dir.join("config.json");
        let config_str = serde_json::to_string_pretty(self)?;
        std::fs::write(config_path, config_str)?;
        Ok(())
    }

    fn load_default() -> Self {
        info!("Loading default config");
        let default_config_path = get_app_statics().resource_dir.join("defaults/config.json");
        let default_config_str =
            std::fs::read_to_string(default_config_path).expect("Default config not found");
        serde_json::from_str(&default_config_str).expect("Default config is invalid")
    }
}

#[derive(Debug, Deserialize)]
struct LegacyVersions {
    versions: Vec<LegacyVersion>,
}

#[derive(Debug, Deserialize, Clone)]
struct LegacyVersion {
    name: String,
    url: String,
}
impl LegacyVersion {
    fn get_asset_url(&self) -> String {
        let mut url = self.url.clone();
        if url.ends_with('/') {
            url.pop();
        }
        url
    }
}
impl From<LegacyVersion> for Version {
    fn from(version: LegacyVersion) -> Self {
        let asset_url = version.get_asset_url();
        let description = version.name;
        Version::build_barebones(&asset_url, Some(&description))
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Versions {
    versions: Vec<Version>,
    filenames: HashMap<Uuid, String>,
}
impl Versions {
    fn new() -> Self {
        let mut versions = Vec::new();
        let mut filenames = HashMap::new();

        match Self::load_builtins(&mut filenames) {
            Ok(builtins) => {
                info!("Loaded {} built-in versions", builtins.len());
                versions.extend(builtins);
            }
            Err(e) => warn!("Failed to load built-in versions: {}", e),
        }

        match Self::load_appdata(&mut filenames) {
            Ok(loaded) => {
                let to_merge = Self::calculate_merge(&versions, loaded);
                info!("Loaded {} versions from app data", to_merge.len());
                versions.extend(to_merge);
            }
            Err(e) => warn!("Failed to load versions: {}", e),
        };

        Self {
            versions,
            filenames,
        }
    }

    fn load_internal(path: &str, filenames: &mut HashMap<Uuid, String>) -> Result<Vec<Version>> {
        if !std::fs::exists(path)? {
            return Ok(Vec::new());
        }

        let files = std::fs::read_dir(path)?;
        let mut versions = Vec::new();
        for file in files {
            let file = file?;
            let path = file.path();
            if path.is_file() && path.extension().is_some_and(|ext| ext == "json") {
                match Version::from_manifest_file(&path.to_string_lossy()) {
                    Ok(version) => {
                        let filename = path.file_name().unwrap().to_string_lossy().to_string();
                        filenames.insert(version.get_uuid(), filename);
                        versions.push(version);
                    }
                    Err(e) => {
                        warn!("Failed to load version: {}", e);
                    }
                };
            }
        }

        // explicit sort to give a consistent ordering
        versions.sort_by(|v1, v2| v1.get_name().cmp(&v2.get_name()));
        Ok(versions)
    }

    fn load_appdata(filenames: &mut HashMap<Uuid, String>) -> Result<Vec<Version>> {
        let versions_path = get_app_statics().app_data_dir.join("versions");
        Self::load_internal(&versions_path.to_string_lossy(), filenames)
    }

    fn load_builtins(filenames: &mut HashMap<Uuid, String>) -> Result<Vec<Version>> {
        let builtins_path = get_app_statics().resource_dir.join("defaults/versions");
        Self::load_internal(&builtins_path.to_string_lossy(), filenames)
    }

    fn load_from_openfusionclient() -> Result<Vec<Version>> {
        let versions_path = get_app_statics()
            .app_data_dir
            .join("../")
            .join(OPENFUSIONCLIENT_PATH)
            .join("versions.json");
        if !versions_path.exists() {
            return Ok(Vec::new());
        }
        let legacy_versions: LegacyVersions =
            serde_json::from_str(&std::fs::read_to_string(versions_path)?)?;
        let versions: Vec<Version> = legacy_versions
            .versions
            .into_iter()
            .map(Version::from)
            .collect();
        Ok(versions)
    }

    fn calculate_merge(a: &[Version], b: Vec<Version>) -> Vec<Version> {
        let mut to_merge = Vec::with_capacity(b.len());
        for version in b {
            if !a.iter().any(|v| v.get_uuid() == version.get_uuid())
                && !a
                    .iter()
                    .any(|v| v.get_asset_url() == version.get_asset_url())
            {
                to_merge.push(version);
            }
        }
        to_merge
    }

    pub fn add_entry(&mut self, version: Version) {
        self.versions.push(version);
    }

    pub fn remove_entry(&mut self, uuid: Uuid) {
        self.versions.retain(|v| v.get_uuid() != uuid);
    }

    pub fn get_entry(&self, uuid: Uuid) -> Option<&Version> {
        self.versions.iter().find(|v| v.get_uuid() == uuid)
    }

    pub fn get_entry_by_name(&self, name: &str) -> Option<&Version> {
        self.versions.iter().find(|v| v.get_name() == Some(name))
    }

    pub fn get_file_names(&self) -> &HashMap<Uuid, String> {
        &self.filenames
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ServerInfo {
    Simple {
        ip: String,
        version: String,
    },
    Endpoint {
        endpoint: String,
        preferred_version: Option<String>,
    },
}

/// We store servers in a "flat" format for ease of serialization on disk
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FlatServer {
    uuid: Uuid,
    description: Option<String>,
    ip: Option<String>,
    version: Option<String>,
    endpoint: Option<String>,
}
impl From<Server> for FlatServer {
    fn from(server: Server) -> Self {
        let info = server.info;
        match info {
            ServerInfo::Simple { ip, version } => Self {
                uuid: server.uuid,
                description: server.description,
                ip: Some(ip),
                version: Some(version),
                endpoint: None,
            },
            ServerInfo::Endpoint {
                endpoint,
                preferred_version,
            } => Self {
                uuid: server.uuid,
                description: server.description,
                ip: None,
                version: preferred_version,
                endpoint: Some(endpoint),
            },
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FlatServers {
    servers: Vec<FlatServer>,
    favorites: Vec<Uuid>,
}
impl From<Servers> for FlatServers {
    fn from(servers: Servers) -> Self {
        Self {
            servers: servers.servers.into_iter().map(FlatServer::from).collect(),
            favorites: servers.favorites,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Server {
    uuid: Uuid,
    description: Option<String>,
    pub info: ServerInfo,
}
impl From<FlatServer> for Server {
    fn from(flat: FlatServer) -> Self {
        let info = if let Some(endpoint) = flat.endpoint {
            ServerInfo::Endpoint {
                endpoint,
                preferred_version: flat.version,
            }
        } else {
            ServerInfo::Simple {
                ip: flat.ip.unwrap(),
                version: flat.version.unwrap(),
            }
        };
        Self {
            uuid: flat.uuid,
            description: flat.description,
            info,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Servers {
    servers: Vec<Server>,
    favorites: Vec<Uuid>,
}
impl Servers {
    fn new() -> Self {
        match Self::load() {
            Ok(servers) => servers,
            Err(_) => Self::load_default(),
        }
    }

    fn load() -> Result<Self> {
        let servers_path = get_app_statics().app_data_dir.join("servers.json");
        Self::load_internal(&servers_path.to_string_lossy())
    }

    fn load_internal(path: &str) -> Result<Self> {
        let servers_str = std::fs::read_to_string(path)?;
        let flat_servers: FlatServers = serde_json::from_str(&servers_str)?;
        let servers: Self = flat_servers.into();
        Ok(servers)
    }

    fn load_from_openfusionclient() -> Result<Option<Self>> {
        let servers_path = get_app_statics()
            .app_data_dir
            .join("../")
            .join(OPENFUSIONCLIENT_PATH)
            .join("servers.json");
        if !servers_path.exists() {
            return Ok(None);
        }
        let servers_str = std::fs::read_to_string(servers_path)?;
        // OpenFusionClient legacy servers are stored flat
        let flat_servers: FlatServers = serde_json::from_str(&servers_str)?;
        let servers: Self = flat_servers.into();
        Ok(Some(servers))
    }

    fn merge(&mut self, other: &Self) -> usize {
        let mut count = 0;
        for server in &other.servers {
            if !self.servers.iter().any(|s| s.uuid == server.uuid) {
                self.servers.push(server.clone());
                count += 1;
            }
        }
        count
    }

    fn save(&self) -> Result<()> {
        let flat_servers: FlatServers = self.clone().into();
        let servers_path = get_app_statics().app_data_dir.join("servers.json");
        let servers_str = serde_json::to_string_pretty(&flat_servers)?;
        std::fs::write(servers_path, servers_str)?;
        Ok(())
    }

    fn load_default() -> Self {
        info!("Loading default servers");
        let default_servers_path = get_app_statics().resource_dir.join("defaults/servers.json");
        match Self::load_internal(&default_servers_path.to_string_lossy()) {
            Ok(servers) => servers,
            Err(e) => {
                warn!("Failed to load default servers: {}", e);
                Self::default()
            }
        }
    }

    pub fn get_entry(&self, uuid: Uuid) -> Option<&Server> {
        self.servers.iter().find(|s| s.uuid == uuid)
    }

    pub fn remove_entry(&mut self, uuid: Uuid) {
        self.servers.retain(|s| s.uuid != uuid);
    }

    pub fn add_entry(&mut self, details: NewServerDetails) -> Uuid {
        let uuid = Uuid::new_v4();
        let description = details.description;
        let info = if let Some(endpoint) = details.endpoint {
            ServerInfo::Endpoint {
                endpoint,
                preferred_version: None,
            }
        } else {
            ServerInfo::Simple {
                ip: details.ip.unwrap(),
                version: details.version.unwrap(),
            }
        };
        self.servers.push(Server {
            uuid,
            description: Some(description),
            info,
        });
        uuid
    }

    pub fn update_entry(&mut self, entry: Server) -> Result<()> {
        for server in &mut self.servers {
            if server.uuid == entry.uuid {
                *server = entry;
                return Ok(());
            }
        }
        Err(format!("Server with UUID {} not found", entry.uuid).into())
    }
}

impl From<FlatServers> for Servers {
    fn from(flat: FlatServers) -> Self {
        Self {
            servers: flat.servers.into_iter().map(Server::from).collect(),
            favorites: flat.favorites,
        }
    }
}

/// Refresh tokens for each server
#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Tokens {
    tokens: HashMap<Uuid, String>,
}
impl Tokens {
    fn new() -> Self {
        Self::load().unwrap_or_default()
    }

    fn load() -> Result<Self> {
        let tokens_path = get_app_statics().app_data_dir.join("tokens.json");
        let tokens_str = std::fs::read_to_string(tokens_path)?;
        let tokens: Self = serde_json::from_str(&tokens_str)?;
        Ok(tokens)
    }

    fn save(&self) -> Result<()> {
        let tokens_path = get_app_statics().app_data_dir.join("tokens.json");
        let tokens_str = serde_json::to_string_pretty(self)?;
        std::fs::write(tokens_path, tokens_str)?;
        Ok(())
    }

    pub fn save_token(&mut self, server_uuid: Uuid, token: &str) {
        self.tokens.insert(server_uuid, token.to_string());
    }

    pub fn get_token(&self, server_uuid: Uuid) -> Option<String> {
        self.tokens.get(&server_uuid).cloned()
    }

    pub fn remove_token(&mut self, server_uuid: Uuid) {
        self.tokens.remove(&server_uuid);
    }

    pub fn clear(&mut self) {
        self.tokens.clear();
    }
}
