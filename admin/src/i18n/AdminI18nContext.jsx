/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { adminTranslations } from "./adminTranslations.js";

const STORAGE_KEY = "edutech_admin_lang";
const DEFAULT_LANGUAGE = "fa";
const LANGUAGE_CHANGE_EVENT = "edutech_admin_language_change";

const AdminI18nContext = createContext(null);

const getByPath = (obj, path) => {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, key) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
      return acc[key];
    }
    return undefined;
  }, obj);
};

const normalizeLanguage = (value) => {
  if (typeof value !== "string") return DEFAULT_LANGUAGE;
  const cleaned = value.trim().replace(/^"(.*)"$/, "$1").toLowerCase();
  return cleaned === "en" ? "en" : "fa";
};

export const readStoredAdminLanguage = () => {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    return normalizeLanguage(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

let currentLanguage = readStoredAdminLanguage();

const applyLanguageToDocument = (language) => {
  if (typeof document === "undefined") return;
  const isRTL = language === "fa";
  document.documentElement.lang = isRTL ? "fa" : "en";
  document.documentElement.dir = isRTL ? "rtl" : "ltr";
  document.documentElement.setAttribute("data-admin-lang", language);
  document.documentElement.setAttribute("translate", "no");
  document.documentElement.classList.add("notranslate");
  if (document.body) {
    document.body.dir = isRTL ? "rtl" : "ltr";
    document.body.lang = isRTL ? "fa" : "en";
    document.body.setAttribute("translate", "no");
    document.body.classList.add("notranslate");
  }
};

const emitLanguageChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
};

const setAdminLanguage = (nextLanguage) => {
  const normalized = normalizeLanguage(nextLanguage);
  currentLanguage = normalized;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // Ignore storage failures.
    }
  }

  applyLanguageToDocument(normalized);
  emitLanguageChange();
};

const subscribeToLanguage = (callback) => {
  if (typeof window === "undefined") return () => {};

  const handleStorageChange = (event) => {
    if (event.key !== STORAGE_KEY) return;
    currentLanguage = normalizeLanguage(event.newValue);
    applyLanguageToDocument(currentLanguage);
    callback();
  };

  const handleLanguageChange = () => {
    currentLanguage = readStoredAdminLanguage();
    applyLanguageToDocument(currentLanguage);
    callback();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
  };
};

const getLanguageSnapshot = () => {
  currentLanguage = readStoredAdminLanguage();
  return currentLanguage;
};
const getLanguageServerSnapshot = () => DEFAULT_LANGUAGE;

applyLanguageToDocument(currentLanguage);

export const getInitialAdminLanguage = () => currentLanguage;

export function AdminI18nProvider({ children }) {
  const language = useSyncExternalStore(
    subscribeToLanguage,
    getLanguageSnapshot,
    getLanguageServerSnapshot,
  );

  const setLanguage = useCallback((nextLanguage) => {
    setAdminLanguage(nextLanguage);
  }, []);

  const value = useMemo(() => {
    const dict = adminTranslations[language] || adminTranslations.en || {};
    const fallbackDict = adminTranslations.en || {};

    const t = (key, fallback = "") => {
      const hit = getByPath(dict, key);
      if (typeof hit === "string") return hit;
      const fallbackHit = getByPath(fallbackDict, key);
      if (typeof fallbackHit === "string") return fallbackHit;
      return fallback || key;
    };

    const tr = (text) => {
      if (typeof text !== "string") return "";
      return text;
    };

    const toggleLanguage = () => {
      setAdminLanguage(language === "fa" ? "en" : "fa");
    };

    return {
      language,
      isRTL: language === "fa",
      t,
      tr,
      setLanguage,
      toggleLanguage,
    };
  }, [language, setLanguage]);

  return (
    <AdminI18nContext.Provider value={value}>
      {children}
    </AdminI18nContext.Provider>
  );
}

export const useAdminI18n = () => {
  const ctx = useContext(AdminI18nContext);
  if (!ctx) {
    throw new Error("useAdminI18n must be used within AdminI18nProvider");
  }
  return ctx;
};
