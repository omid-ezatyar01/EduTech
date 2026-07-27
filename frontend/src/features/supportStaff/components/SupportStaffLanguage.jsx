import { useEffect, useMemo, useState } from "react";
import { Languages } from "lucide-react";
import {
  SupportStaffLanguageContext,
  useSupportStaffLanguage,
} from "../services/supportStaffLanguageContext.js";

const STORAGE_KEY = "edutech_support_staff_language";

const initialLanguage = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "fa" ? "fa" : "en";
  } catch {
    return "en";
  }
};

export function SupportStaffLanguageProvider({ children }) {
  const [language, setLanguageState] = useState(initialLanguage);

  useEffect(() => {
    const previousDirection = document.documentElement.dir;
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";

    return () => {
      document.documentElement.dir = previousDirection;
    };
  }, [language]);

  const value = useMemo(() => {
    const setLanguage = (nextLanguage) => {
      const normalized = nextLanguage === "fa" ? "fa" : "en";
      setLanguageState(normalized);
      try {
        localStorage.setItem(STORAGE_KEY, normalized);
      } catch {
        // The language still works for this session when storage is unavailable.
      }
    };
    return {
      language,
      isFa: language === "fa",
      setLanguage,
    };
  }, [language]);

  return (
    <SupportStaffLanguageContext.Provider value={value}>
      {children}
    </SupportStaffLanguageContext.Provider>
  );
}

export function SupportStaffLanguageToggle({ compact = false }) {
  const { language, setLanguage } = useSupportStaffLanguage();
  return (
    <div
      className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
      dir="ltr"
      aria-label="Language"
    >
      {!compact ? (
        <Languages className="mx-2 text-slate-400" size={16} />
      ) : null}
      {[
        ["en", "EN"],
        ["fa", "فا"],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setLanguage(value)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition ${
            language === value
              ? "bg-[#0B4FD8] text-white"
              : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
