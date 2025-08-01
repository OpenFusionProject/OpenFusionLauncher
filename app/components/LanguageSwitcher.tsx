"use client";
import { availableLanguages, useLanguage, type Language } from "@/app/i18n";

const languageNames: Record<Language, string> = {
  en: "English",
  ru: "Русский",
};

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  return (
    <div id="language-button-div">
      <select
        className="form-select form-select-sm"
        value={lang}
        onChange={(e) => setLang(e.target.value as Language)}
      >
        {availableLanguages.map((code) => (
          <option key={code} value={code}>
            {languageNames[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
