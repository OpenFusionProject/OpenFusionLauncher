use std::{path::PathBuf, sync::OnceLock};

use log::*;
use serde::{Deserialize, Serialize};
use tauri::{path::BaseDirectory, Manager};
use uuid::Uuid;

use crate::{util, Result};

const CDN_URL: &str = "http://cdn.dexlabs.systems/ff/big";
const UNITY_CACHE_PATH: &str = "LocalLow/Unity/Web Player/Cache";
const DEFAULTS_PATH: &str = "defaults";

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
    defaults_dir: PathBuf,
    unity_cache_dir: PathBuf,
    cdn_url: String,
}
impl AppStatics {
    fn load(app: &mut tauri::App) -> Self {
        let version = app.handle().package_info().version.to_string();
        let path_resolver = app.handle().path();
        let app_data_dir = path_resolver.app_data_dir().unwrap();
        let defaults_dir = path_resolver
            .resolve(DEFAULTS_PATH, BaseDirectory::Resource)
            .unwrap();
        let unity_cache_dir = path_resolver
            .resolve(UNITY_CACHE_PATH, BaseDirectory::AppData)
            .unwrap();
        Self {
            version,
            app_data_dir,
            defaults_dir,
            unity_cache_dir,
            cdn_url: CDN_URL.to_string(),
        }
    }
}

#[derive(Debug, Default)]
pub struct AppState {
    pub config: Config,
    pub versions: Versions,
    pub servers: Servers,
}
impl AppState {
    pub fn load() -> Self {
        let config = Config::new();
        let versions = Versions::new();
        let servers = Servers::new();
        Self {
            config,
            versions,
            servers,
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

        if let Err(e) = self.config.save() {
            warn!("Failed to save config: {}", e);
        }
        if let Err(e) = self.versions.save() {
            warn!("Failed to save versions: {}", e);
        }
        if let Err(e) = self.servers.save() {
            warn!("Failed to save servers: {}", e);
        }
    }

    fn backup(last_version: &str) -> Result<()> {
        info!("Backing up app state from version {}", last_version);
        Config::backup(last_version)?;
        Versions::backup(last_version)?;
        Servers::backup(last_version)?;
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    #[serde(alias = "autoupdate-check")]
    #[serde(default = "util::true_fn")]
    autoupdate_check: bool,

    #[serde(alias = "cache-swapping")]
    #[serde(default = "util::true_fn")]
    cache_swapping: bool,

    #[serde(alias = "enable-offline-cache")]
    #[serde(default = "util::true_fn")]
    enable_offline_cache: bool,

    #[serde(alias = "verify-offline-cache")]
    #[serde(default = "util::false_fn")]
    verify_offline_cache: bool,

    #[serde(alias = "last-version-initialized")]
    #[serde(default = "util::version_zero")]
    last_version_initialized: String,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            autoupdate_check: true,
            cache_swapping: true,
            enable_offline_cache: true,
            verify_offline_cache: false,
            last_version_initialized: util::version_zero(),
        }
    }
}
impl Config {
    fn new() -> Self {
        let mut cfg = match Self::load() {
            Ok(config) => config,
            Err(_) => Self::load_default(),
        };
        if util::string_version_to_u32(&cfg.last_version_initialized)
            != util::string_version_to_u32(&get_app_statics().version)
        {
            if let Err(e) = AppState::backup(&cfg.last_version_initialized) {
                warn!("Failed to backup app state: {}", e);
            }
        }
        cfg.last_version_initialized
            .clone_from(&get_app_statics().version);
        cfg
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

    fn backup(version: &str) -> Result<()> {
        let config_path = get_app_statics().app_data_dir.join("config.json");
        let backup_path = get_app_statics()
            .app_data_dir
            .join(format!("config.json.bak.{}", version));
        std::fs::copy(config_path, backup_path)?;
        Ok(())
    }

    fn load_default() -> Self {
        info!("Loading default config");
        let default_config_path = get_app_statics().defaults_dir.join("config.json");
        let default_config_str =
            std::fs::read_to_string(default_config_path).expect("Default config not found");
        serde_json::from_str(&default_config_str).expect("Default config is invalid")
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Version {
    name: String,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Versions {
    versions: Vec<Version>,
}
impl Versions {
    fn new() -> Self {
        match Self::load() {
            Ok(versions) => versions,
            Err(_) => Self::load_default(),
        }
    }

    fn load() -> Result<Self> {
        let versions_path = get_app_statics().app_data_dir.join("versions.json");
        let versions_str = std::fs::read_to_string(versions_path)?;
        let versions: Self = serde_json::from_str(&versions_str)?;
        Ok(versions)
    }

    fn save(&self) -> Result<()> {
        let versions_path = get_app_statics().app_data_dir.join("versions.json");
        let versions_str = serde_json::to_string_pretty(self)?;
        std::fs::write(versions_path, versions_str)?;
        Ok(())
    }

    fn backup(version: &str) -> Result<()> {
        let versions_path = get_app_statics().app_data_dir.join("versions.json");
        let backup_path = get_app_statics()
            .app_data_dir
            .join(format!("versions.json.bak.{}", version));
        std::fs::copy(versions_path, backup_path)?;
        Ok(())
    }

    fn load_default() -> Self {
        info!("Loading default versions");
        let default_versions_path = get_app_statics().defaults_dir.join("versions.json");
        let default_versions_str =
            std::fs::read_to_string(default_versions_path).expect("Default versions not found");
        serde_json::from_str(&default_versions_str).expect("Default versions are invalid")
    }

    pub fn get_entry(&self, name: &str) -> Option<&Version> {
        self.versions.iter().find(|v| v.name == name)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Server {
    uuid: Uuid,
    description: String,
    pub ip: String,
    pub version: String,
    pub endpoint: Option<String>,
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
        let servers_str = std::fs::read_to_string(servers_path)?;
        let servers: Self = serde_json::from_str(&servers_str)?;
        Ok(servers)
    }

    fn save(&self) -> Result<()> {
        let servers_path = get_app_statics().app_data_dir.join("servers.json");
        let servers_str = serde_json::to_string_pretty(self)?;
        std::fs::write(servers_path, servers_str)?;
        Ok(())
    }

    fn backup(version: &str) -> Result<()> {
        let servers_path = get_app_statics().app_data_dir.join("servers.json");
        let backup_path = get_app_statics()
            .app_data_dir
            .join(format!("servers.json.bak.{}", version));
        std::fs::copy(servers_path, backup_path)?;
        Ok(())
    }

    fn load_default() -> Self {
        info!("Loading default servers");
        let default_servers_path = get_app_statics().defaults_dir.join("servers.json");
        let default_servers_str =
            std::fs::read_to_string(default_servers_path).expect("Default servers not found");
        serde_json::from_str(&default_servers_str).expect("Default servers are invalid")
    }

    pub fn get_entry(&self, uuid: Uuid) -> Option<&Server> {
        self.servers.iter().find(|s| s.uuid == uuid)
    }
}
