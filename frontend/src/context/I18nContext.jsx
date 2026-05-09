import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import en from "../i18n/en.json";
import ar from "../i18n/ar.json";
import fr from "../i18n/fr.json";

const DICTS = { en, ar, fr };
const RTL_LANGS = new Set(["ar"]);
const STORAGE_KEY = "aar.lang";
const SUPPORTED = ["en", "ar", "fr"];

const I18nContext = createContext(null);

function detectInitial() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch {}
  // Browser language fallback
  const browser = (navigator?.language || "en").slice(0, 2).toLowerCase();
  return SUPPORTED.includes(browser) ? browser : "en";
}

/** Resolve "a.b.c" against dict, falling back to English, then to the key itself. */
function resolve(dict, path) {
  const parts = path.split(".");
  let cur = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else return null;
  }
  return typeof cur === "string" ? cur : null;
}

/** Replace {{var}} placeholders. */
function format(template, params) {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in params ? String(params[k]) : `{{${k}}}`));
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectInitial);

  // Apply lang + dir to <html> on every change
  useEffect(() => {
    const dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!SUPPORTED.includes(next)) return;
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    setLangState(next);
  }, []);

  const t = useCallback((key, params) => {
    const primary = DICTS[lang] || DICTS.en;
    const found = resolve(primary, key) ?? resolve(DICTS.en, key);
    if (!found) {
      // Friendly fallback: surface the last segment of the key, prettified
      const last = key.split(".").pop() || key;
      return last.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    }
    return format(found, params);
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
      isRTL: RTL_LANGS.has(lang),
      supported: SUPPORTED,
    }),
    [lang, setLang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English",    short: "EN" },
  { value: "ar", label: "العربية",    short: "AR" },
  { value: "fr", label: "Français",   short: "FR" },
];
