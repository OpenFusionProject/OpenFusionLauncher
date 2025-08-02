"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

export const translations = { en, ru } as const;
export type Language = keyof typeof translations;
export const availableLanguages = Object.keys(translations) as Language[];
export const languageNames: Record<Language, string> = {
  en: "English",
  ru: "Русский",
};

interface LangContextType {
  lang: Language;
  setLang: (lang: Language) => void;
}

const LangCtx = createContext<LangContextType>({ lang: "en", setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("lang") as Language | null;
      if (stored && stored in translations) {
        return stored as Language;
      }
    }
    return "en";
  });

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

  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

export function useLanguage() {
  return useContext(LangCtx);
}

export function useT() {
  const { lang } = useLanguage();
  return (key: string) => translations[lang][key] || key;
}
