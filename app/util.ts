import { Config } from "@/app/types";

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
