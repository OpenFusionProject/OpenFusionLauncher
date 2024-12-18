use crate::util;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum LauncherTheme {
    DexlabsDark,
    DexlabsLight,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "snake_case")]
pub enum LaunchBehavior {
    #[default]
    Hide,
    Quit,
    StayOpen,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
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

    #[serde(default)]
    pub launch_behavior: LaunchBehavior,

    #[serde(default = "util::get_default_cache_dir")]
    pub game_cache_path: String,

    #[serde(default = "util::get_default_offline_cache_dir")]
    pub offline_cache_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "lowercase")]
pub enum GraphicsApi {
    #[default]
    Dx9,
    OpenGl,
    Vulkan,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "snake_case")]
pub enum FpsFix {
    #[default]
    On,
    OnWithLimiter(u32),
    Off,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct GameSettings {
    #[serde(default)]
    pub graphics_api: GraphicsApi,

    #[serde(default)]
    pub fps_fix: FpsFix,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_size: Option<WindowSize>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub launch_command: Option<String>,
}
