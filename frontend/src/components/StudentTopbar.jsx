import {
  Menu,
  Search,
  ChevronDown,
  Home,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";

export default function StudentTopbar({ onMenuClick, language = "fa" }) {
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langRef = useRef(null);
  const isFa = language === "fa";
  const t = {
    search: isFa
      ? "جستجو در کورس‌ها، صنف‌ها، تمرین‌ها ..."
      : "Search courses, classes, assignments ...",
    home: isFa ? "صفحه اصلی" : "Home",
    langLabel: isFa ? "فارسی" : "English",
    otherLangLabel: isFa ? "English" : "فارسی",
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langRef.current && !langRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageToggle = () => {
    const nextLanguage = isFa ? "en" : "fa";
    localStorage.setItem("edutech-language", nextLanguage);
    window.dispatchEvent(
      new CustomEvent("edutech_language_change", {
        detail: { language: nextLanguage },
      }),
    );
    setIsLangOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-primary-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-100 lg:w-96">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder={t.search}
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Link
          to="/"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 shadow-sm transition hover:border-primary-200 hover:text-primary-700 sm:px-4"
        >
          <Home size={16} />
          <span>{t.home}</span>
        </Link>

        <div className="relative z-50 w-auto" ref={langRef}>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 shadow-sm transition hover:border-primary-200 hover:text-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-100 sm:px-4"
            type="button"
            aria-expanded={isLangOpen}
            onClick={() => setIsLangOpen((current) => !current)}
          >
            <span>{t.langLabel}</span>
            <ChevronDown size={15} />
          </button>
          {isLangOpen ? (
            <div className="absolute end-0 top-full z-50 mt-2 w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
              <button
                className="w-full rounded-xl px-3 py-2 text-start text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                type="button"
                onClick={() => setIsLangOpen(false)}
              >
                {t.langLabel}
              </button>
              <button
                className="w-full rounded-xl px-3 py-2 text-start text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                type="button"
                onClick={handleLanguageToggle}
              >
                {t.otherLangLabel}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
