export type ServerEntry = {
  uuid: string;
  description: string;
  ip?: string;
  version?: string;
  endpoint?: string;
};

export type NewServerDetails = {
  description: string;
  ip?: string;
  version?: string;
  endpoint?: string;
};

export type Servers = {
  servers: ServerEntry[];
  favorites: string[];
};

export type VersionEntry = {
  uuid: string;
  name?: string;
  description?: string;
  hidden?: boolean;
  total_compressed_size?: number;
  total_uncompressed_size?: number;
  main_file_info?: {
    size: number;
  };
};

export type Versions = {
  versions: VersionEntry[];
};

export type LauncherSettings = {
  check_for_updates: boolean;
  use_offline_caches: boolean;
  verify_offline_caches: boolean;
  delete_old_game_caches: boolean;
  launch_behavior: string;
  game_cache_path: string;
  offline_cache_path: string;
  theme?: string;
};

export type WindowSize = {
  width: number;
  height: number;
};

export type FpsLimit = {
  on_with_limiter: number;
};
export type FpsFix = "on" | FpsLimit | "off";

export type GameSettings = {
  graphics_api: string;
  window_size?: WindowSize;
  launch_command?: string;
  fps_fix: FpsFix;
};

export type Config = {
  launcher: LauncherSettings;
  game: GameSettings;
};

export type Alert = {
  variant: string;
  text: string;
  link?: string;
  id: number;
};

export type LoadingTask = {
  id: string;
  text?: string;
};

export type ImportCounts = {
  version_count: number;
  server_count: number;
};

export type LoginSession = {
  username: string;
  session_token: string;
};

export type AccountInfo = {
  username: string;
  email?: string;
};

export type RegistrationResult = {
  resp: string;
  can_login: boolean;
};

export type EndpointInfo = {
  email_required?: boolean;
};

export type SettingsContext = {
  alertSuccess?: (text: string) => void;
  alertInfo?: (text: string) => void;
  alertError?: (text: string) => void;
  alertWarning?: (text: string) => void;
  startLoading?: (id: string, text?: string) => void;
  stopLoading?: (id: string) => void;
  showConfirmationModal?: (
    message: string,
    confirmText: string,
    confirmVariant: string,
    onConfirm: () => void,
  ) => void;
};

export type VersionCacheData = {
  versionUuid: string;
  gameDone: boolean;
  gameItems: Record<string, VersionCacheProgressItem>;
  offlineDone: boolean;
  offlineItems: Record<string, VersionCacheProgressItem>;
};

export type VersionCacheProgress = {
  uuid: string;
  offline: boolean;
  items: Record<string, VersionCacheProgressItem>;
  done: boolean;
};

export type VersionCacheProgressItem = {
  item_size: number;
  corrupt: boolean;
  missing: boolean;
};

export type AlertEvent = {
  variant: string;
  message: string;
};

export type UpdateInfo = {
  version: string;
  url: string;
};

export type SettingsOption = {
  key: string;
  label: string;
  description?: string;
  value?: any;
};
