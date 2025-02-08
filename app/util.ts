import { Config, ServerEntry } from "@/app/types";
import get_seed from "@/app/seed";
import { invoke } from "@tauri-apps/api/core";

function getSystemTheme() {
  if (typeof window !== "undefined" && window.matchMedia) {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
  }
  return "dark";
}

export function getTheme(config: Config) {
  const themeName = config.launcher.theme;
  if (themeName) {
    switch (themeName) {
      case "dexlabs_light":
        return "light";
      case "dexlabs_dark":
        return "dark";
    }
  }
  return getSystemTheme();
}

export function variantToLabel(variant: string) {
  switch (variant) {
    case "success":
      return "Success";
    case "danger":
      return "Error";
    case "warning":
      return "Warning";
    case "primary":
      return "Info";
    default:
      return "";
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getLogoImageUrlForServer(server?: ServerEntry) {
  if (server?.endpoint) {
    // HACK: add the counter to the url as a parameter to prevent caching across launches
    return (
      "https://" + server.endpoint + "/launcher/logo.png?seed=" + get_seed()
    );
  }
  return undefined;
}

export function getBackgroundImageUrlForServer(server?: ServerEntry) {
  if (server?.endpoint) {
    // HACK: add the counter to the url as a parameter to prevent caching across launches
    return (
      "https://" +
      server.endpoint +
      "/launcher/background.png?seed=" +
      get_seed()
    );
  }
  return undefined;
}

export function getBackgroundImageStyle(imageUrl?: string) {
  return {
    backgroundImage: imageUrl ? `url(${imageUrl})` : "none",
  };
}

export function getHostnameFromLink(link: string) {
  const url = new URL(link);
  return url.hostname;
}

let isDebugMode: boolean | undefined = undefined;
export async function getDebugMode() {
  if (isDebugMode === undefined) {
    const debugOn: boolean = await invoke("is_debug_mode");
    isDebugMode = debugOn;
  }
  return isDebugMode;
}

let useCustomTitlebar: boolean | undefined = undefined;
export async function getUseCustomTitlebar() {
  if (useCustomTitlebar === undefined) {
    const useCustom: boolean = await invoke("should_use_custom_titlebar");
    useCustomTitlebar = useCustom;
  }
  return useCustomTitlebar;
}

export function deepEqual(a: any, b: any) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Object.keys(a).length !== Object.keys(b).length) return false;
  for (const key in a) {
    if (!(key in b)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}
