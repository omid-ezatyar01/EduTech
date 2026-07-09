import { useCallback, useSyncExternalStore } from "react";

const LANGUAGE_KEY = "edutech_teacher_language";
const DEFAULT_LANGUAGE = "fa";
const LANGUAGE_CHANGE_EVENT = "edutech_teacher_language_change";

export function normalizeTeacherLanguage(value) {
  return value === "en" ? "en" : "fa";
}

function readStoredTeacherLanguage() {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  try {
    return normalizeTeacherLanguage(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

let currentLanguage = readStoredTeacherLanguage();

function applyLanguageToDocument(language) {
  if (typeof document === "undefined") return;

  const isRTL = language === "fa";
  document.documentElement.lang = isRTL ? "fa" : "en";
  document.documentElement.dir = isRTL ? "rtl" : "ltr";
  if (document.body) {
    document.body.dir = isRTL ? "rtl" : "ltr";
  }
}

function emitLanguageChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
}

function setTeacherLanguage(nextLanguage) {
  const normalizedLanguage = normalizeTeacherLanguage(nextLanguage);
  currentLanguage = normalizedLanguage;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(LANGUAGE_KEY, normalizedLanguage);
    } catch {
      // ignore storage failures
    }
  }

  applyLanguageToDocument(normalizedLanguage);
  emitLanguageChange();
}

function subscribeToTeacherLanguage(callback) {
  if (typeof window === "undefined") return () => {};

  const handleStorageChange = (event) => {
    if (event.key !== LANGUAGE_KEY) return;
    currentLanguage = normalizeTeacherLanguage(event.newValue);
    applyLanguageToDocument(currentLanguage);
    callback();
  };

  const handleLanguageChange = () => {
    currentLanguage = readStoredTeacherLanguage();
    applyLanguageToDocument(currentLanguage);
    callback();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
  };
}

function getTeacherLanguageSnapshot() {
  return currentLanguage;
}

function getTeacherLanguageServerSnapshot() {
  return DEFAULT_LANGUAGE;
}

applyLanguageToDocument(currentLanguage);

export function getInitialTeacherLanguage() {
  return currentLanguage;
}

export default function useTeacherLanguage() {
  const language = useSyncExternalStore(
    subscribeToTeacherLanguage,
    getTeacherLanguageSnapshot,
    getTeacherLanguageServerSnapshot,
  );

  const setLanguage = useCallback((nextLanguage) => {
    setTeacherLanguage(nextLanguage);
  }, []);

  return {
    language,
    isRTL: language === "fa",
    setLanguage,
  };
}
