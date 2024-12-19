import { Config } from "@/app/types";

function getSystemTheme() {
  if (typeof window !== "undefined" && window.matchMedia) {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  }
  return "light";
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
