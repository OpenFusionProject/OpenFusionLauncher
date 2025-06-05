import { Config, ServerEntry } from "@/app/types";
import get_seed from "@/app/seed";
import { invoke } from "@tauri-apps/api/core";

export function validateUsername(username: string) {
  // From OpenFusion:
  // Login has to be 4 - 32 characters long and can't contain
  // special characters other than dash and underscore
  const regex = /^[a-zA-Z0-9_-]{4,32}$/;
  return regex.test(username);
}

export function validatePassword(password: string) {
  // From OpenFusion:
  // Password has to be 8 - 32 characters long
  const regex = /^.{8,32}$/;
  return regex.test(password);
}

export function validateEmail(email: string, allow_empty: boolean) {
  if (email.length == 0 && allow_empty) return true;

  // normal email regex
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

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
  // const themeName = config.launcher.theme;
  // if (themeName) {
  //   switch (themeName) {
  //     case "dexlabs_light":
  //       return "light";
  //     case "dexlabs_dark":
  //       return "dark";
  //   }
  // }
  // return getSystemTheme();
  // TODO: uncomment when light theme is ready
  return "dark";
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

export function getPrivacyPolicyUrlForServer(server: ServerEntry) {
  return "https://" + server.endpoint + "/privacy";
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
