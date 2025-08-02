"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
} from "react";
import { invoke } from "@tauri-apps/api/core";
export const availableLanguages = ["en", "ru"] as const;
export type Language = (typeof availableLanguages)[number];
export const languageNames: Record<Language, string> = {
  en: "English",
  ru: "Русский",
};

const localeCache: Partial<Record<Language, Record<string, string>>> = {};

async function loadLocale(lang: Language): Promise<Record<string, string>> {
  switch (lang) {
    case "en":
      return (await import("./locales/en.json")).default;
    case "ru":
      return (await import("./locales/ru.json")).default;
  }
  throw new Error(`Unsupported language: ${lang}`);
}

interface LangContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  translations: Record<string, string>;
}

const LangCtx = createContext<LangContextType>({
  lang: "en",
  setLang: () => {},
  translations: {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("lang") as Language | null;
      if (stored && availableLanguages.includes(stored as Language)) {
        return stored as Language;
      }
    }
    return "en";
  });
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!localeCache[lang]) {
        localeCache[lang] = await loadLocale(lang);
      }
      if (active) {
        setTranslations(localeCache[lang]!);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [lang]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (window.localStorage.getItem("lang")) {
      return;
    }
    const init = async () => {
      try {
        await invoke("reload_state");
        const cfg = await invoke<{ launcher: { language: Language } }>(
          "get_config",
        );
        setLang(cfg.launcher.language);
      } catch {
        // ignore errors
      }
    };
    init();
  }, []);

  useLayoutEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem("lang", lang);
  }, [lang]);

  return (
    <LangCtx.Provider value={{ lang, setLang, translations }}>
      {children}
    </LangCtx.Provider>
  );
}

export function useLanguage() {
  return useContext(LangCtx);
}

export function useT() {
  const { translations } = useLanguage();
  return (key: string) => translations[key] || key;
}
