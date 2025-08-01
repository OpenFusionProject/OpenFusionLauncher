"use client";
import { createContext, useContext, useState, useEffect } from "react";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

export const translations = { en, ru } as const;
export type Language = keyof typeof translations;
export const availableLanguages = Object.keys(translations) as Language[];

interface LangContextType {
  lang: Language;
  setLang: (lang: Language) => void;
}

const LangCtx = createContext<LangContextType>({ lang: "en", setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("lang") as Language | null;
    if (stored) {
      setLang(stored);
    }
  }, []);

  useEffect(() => {
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
