use crate::util;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReleaseChannel {
    #[serde(alias = "pre_release")]
    Prerelease,

    #[serde(other)]
    Release,
}

impl Default for ReleaseChannel {
    fn default() -> Self {
        let version = env!("CARGO_PKG_VERSION");
        if version.contains("-") {
            ReleaseChannel::Prerelease
        } else {
            ReleaseChannel::Release
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum LauncherTheme {
    DexlabsDark,
    DexlabsLight,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LaunchBehavior {
    Quit,
    StayOpen,

    #[default]
    #[serde(other)]
    Hide,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LauncherSettings {
    #[serde(default = "util::true_fn")]
    pub check_for_updates: bool,

    #[serde(default)]
    pub release_channel: ReleaseChannel,

    #[serde(default = "util::true_fn")]
    pub discord_integration: bool,

    // none = system default
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<LauncherTheme>,

    #[serde(default = "util::true_fn")]
    pub use_offline_caches: bool,

    #[serde(default = "util::false_fn")]
    pub verify_offline_caches: bool,

    #[serde(default = "util::true_fn")]
    pub delete_old_game_caches: bool,

    #[serde(default)]
    pub launch_behavior: LaunchBehavior,

    #[serde(default = "util::get_default_cache_dir")]
    pub game_cache_path: String,

    #[serde(default = "util::get_default_offline_cache_dir")]
    pub offline_cache_path: String,

    #[serde(default = "util::true_fn")]
    pub proxy_asset_downloads: bool,

    #[serde(default = "util::true_fn")]
    pub enable_easter_eggs: bool,
}
impl Default for LauncherSettings {
    fn default() -> Self {
        Self {
            check_for_updates: true,
            release_channel: ReleaseChannel::default(),
            discord_integration: true,
            theme: None,
            use_offline_caches: true,
            verify_offline_caches: false,
            delete_old_game_caches: true,
            launch_behavior: LaunchBehavior::default(),
            game_cache_path: util::get_default_cache_dir(),
            offline_cache_path: util::get_default_offline_cache_dir(),
            proxy_asset_downloads: true,
            enable_easter_eggs: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, Default)]
#[serde(rename_all = "lowercase")]
pub enum GraphicsApi {
    // OpenGl,
    Vulkan,

    #[default]
    #[serde(other)]
    Dx9,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, Default)]
#[serde(rename_all = "snake_case")]
pub enum FpsFix {
    OnWithLimiter(u32),
    Off,

    #[default]
    #[serde(other)]
    On,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WebPlayerArchitecture {
    X86,

    #[default]
    #[serde(other)]
    X64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameSettings {
    #[serde(default)]
    pub graphics_api: GraphicsApi,

    #[serde(default)]
    pub fps_fix: FpsFix,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_size: Option<WindowSize>,

    #[deprecated]
    #[serde(skip_serializing)]
    pub launch_command: Option<String>,

    #[serde(default = "Uuid::nil")]
    pub launch_profile: Uuid,

    #[serde(default)]
    pub web_player_architecture: WebPlayerArchitecture,
}
impl Default for GameSettings {
    #[allow(deprecated)]
    fn default() -> Self {
        Self {
            graphics_api: GraphicsApi::default(),
            fps_fix: FpsFix::default(),
            window_size: None,
            launch_command: None,
            launch_profile: Uuid::nil(),
            web_player_architecture: WebPlayerArchitecture::default(),
        }
    }
}
