import { Config, ServerEntry } from "@/app/types";
import get_seed from "@/app/seed";
import { invoke } from "@tauri-apps/api/core";

function getSystemTheme() {
  if (typeof window !== "undefined" && window.matchMedia) {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    } else {
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
    return "http://" + server.endpoint + "/launcher/logo.png?seed=" + get_seed();
  }
  return undefined;
}

export function getBackgroundImageUrlForServer(server?: ServerEntry) {
  if (server?.endpoint) {
    // HACK: add the counter to the url as a parameter to prevent caching across launches
    return "http://" + server.endpoint + "/launcher/background.png?seed=" + get_seed();
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
    try {
      const debugOn: boolean = await invoke("is_debug_mode");
      isDebugMode = debugOn;
    } catch (e) {}
  }
  return isDebugMode ?? false;
}
