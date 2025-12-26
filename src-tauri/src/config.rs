use crate::util;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum LauncherTheme {
    DexlabsDark,
    DexlabsLight,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LaunchBehavior {
    #[default]
    Hide,
    Quit,
    StayOpen,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LauncherSettings {
    #[serde(default = "util::true_fn")]
    pub check_for_updates: bool,

    // none = system default
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<LauncherTheme>,

    #[serde(default = "util::true_fn")]
    pub use_offline_caches: bool,

    #[serde(default = "util::false_fn")]
    pub verify_offline_caches: bool,

    #[serde(default = "util::false_fn")]
    pub delete_old_game_caches: bool,

    #[serde(default)]
    pub launch_behavior: LaunchBehavior,

    #[serde(default = "util::get_default_cache_dir")]
    pub game_cache_path: String,

    #[serde(default = "util::get_default_offline_cache_dir")]
    pub offline_cache_path: String,

    #[serde(default = "util::true_fn")]
    pub proxy_asset_downloads: bool,
}
impl Default for LauncherSettings {
    fn default() -> Self {
        Self {
            check_for_updates: true,
            theme: None,
            use_offline_caches: true,
            verify_offline_caches: false,
            delete_old_game_caches: false,
            launch_behavior: LaunchBehavior::Hide,
            game_cache_path: util::get_default_cache_dir(),
            offline_cache_path: util::get_default_offline_cache_dir(),
            proxy_asset_downloads: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, Default)]
#[serde(rename_all = "lowercase")]
pub enum GraphicsApi {
    #[default]
    Dx9,
    OpenGl,
    Vulkan,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, Default)]
#[serde(rename_all = "snake_case")]
pub enum FpsFix {
    #[default]
    On,
    OnWithLimiter(u32),
    Off,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
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

    #[serde(default = "util::get_default_launch_profile_id")]
    pub launch_profile: Uuid,
}
impl Default for GameSettings {
    #[allow(deprecated)]
    fn default() -> Self {
        Self {
            graphics_api: GraphicsApi::Dx9,
            fps_fix: FpsFix::On,
            window_size: None,
            launch_command: None,
            launch_profile: util::get_default_launch_profile_id(),
        }
    }
}
