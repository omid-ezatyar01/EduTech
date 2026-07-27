import {
  ChevronDown,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { clearAuth } from "../../services/portal";

function LanguageSwitcher({ language, onLanguageChange, t }) {
  const [open, setOpen] = useState(false);
  const nextLanguage = language === "fa" ? "en" : "fa";
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative z-50 w-full sm:w-auto" ref={dropdownRef}>
      <button
        className="inline-flex h-11 w-full sm:w-auto items-center justify-between sm:justify-start gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 shadow-sm transition hover:border-primary-200 hover:text-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-100"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {t.meta.languageName}
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="absolute bottom-full end-0 z-50 mb-2 w-full sm:bottom-auto sm:top-full sm:mb-0 sm:mt-2 sm:w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
          <button
            className="w-full rounded-xl px-3 py-2 text-start text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            type="button"
            onClick={() => {
              onLanguageChange(language);
              setOpen(false);
            }}
          >
            {t.meta.languageName}
          </button>
          <button
            className="w-full rounded-xl px-3 py-2 text-start text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            type="button"
            onClick={() => {
              onLanguageChange(nextLanguage);
              setOpen(false);
            }}
          >
            {t.meta.otherLanguageName}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function Header({
  activeHref = "/",
  language,
  onLanguageChange,
  t,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileLangOpen, setMobileLangOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("edutech_auth") === "true",
  );
  const headerRef = useRef(null);
  const navigate = useNavigate();
  const logoSrc = "/logo.png";

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(localStorage.getItem("edutech_auth") === "true");
    };
    window.addEventListener("auth_change", handleAuthChange);
    window.addEventListener("hashchange", handleAuthChange);

    const handleClickOutside = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setMobileOpen(false);
        setMobileLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("auth_change", handleAuthChange);
      window.removeEventListener("hashchange", handleAuthChange);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [mobileOpen]);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
    setMobileOpen(false);
  };

  const userT = {
    fa: {
      home: "صفحه اصلی",
      dashboard: "داشبورد",
      courses: "کورس‌های من",
      schedule: "تقسیم اوقات",
      payments: "پرداخت‌ها",
      profile: "پروفایل",
      logout: "خروج",
    },
    en: {
      home: "Home Page",
      dashboard: "Dashboard",
      courses: "My Courses",
      schedule: "Schedule",
      payments: "Payments",
      profile: "Profile",
      logout: "Logout",
    },
  };
  const uT = userT[language] || userT.fa;
  const nextLanguage = language === "fa" ? "en" : "fa";
  const isRtl = language === "fa" || t.meta.dir === "rtl";
  const controlsOrderClass = "order-1 md:order-none";
  const mobileMenuOrderClass = "order-1";
  const mobileActionsOrderClass = "order-2";

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-40 border-b border-slate-100 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
        ref={headerRef}
      >
        <div className="mx-auto flex h-[76px] max-w-[1536px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="order-2 hidden items-center md:flex md:order-none">
            <img
              className="h-9 w-auto object-contain sm:h-10 lg:h-11"
              src={logoSrc}
              alt="EduTech"
            />
          </Link>

          <nav
            className="hidden items-center gap-5 md:flex"
            aria-label="Main navigation"
          >
            {t.header.nav
              .filter(
                (item) =>
                  item.href !== "/#how-it-works" && item.href !== "/#pricing",
              )
              .map((item) => {
                const isActive = item.href === activeHref;
                return (
                  <Link
                    className={`relative px-1 py-2 text-sm font-bold transition hover:text-primary-600 ${
                      isActive ? "text-primary-600" : "text-slate-900"
                    }`}
                    to={item.href}
                    key={item.href}
                  >
                    {item.label}
                    {isActive ? (
                      <span className="absolute inset-x-1 -bottom-1 h-0.5 rounded-full bg-primary-600" />
                    ) : null}
                  </Link>
                );
              })}
          </nav>

          <div
            className={`${controlsOrderClass} flex w-full items-center justify-between gap-2 sm:gap-3 md:w-auto md:justify-start`}
          >
            <div className="hidden items-center gap-3 md:flex">
              <LanguageSwitcher
                language={language}
                onLanguageChange={onLanguageChange}
                t={t}
              />
              {isAuthenticated && (
                <Link
                  to="/student/dashboard"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 px-5 text-sm font-bold text-primary-700 shadow-sm transition hover:border-primary-300 hover:bg-primary-100"
                >
                  {uT.dashboard}
                </Link>
              )}
              {!isAuthenticated && (
                <Link
                  to="/login"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-7 text-sm font-bold text-slate-900 shadow-sm transition hover:border-primary-200 hover:text-primary-700"
                >
                  {t.header.login}
                </Link>
              )}
            </div>
            {!isAuthenticated && (
              <div className={`${mobileActionsOrderClass} flex items-center gap-2 md:hidden md:order-none`}>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileLangOpen((prev) => !prev);
                    }}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 shadow-sm transition hover:border-primary-200 hover:text-primary-700"
                  >
                    {t.meta.languageName}
                    <ChevronDown size={14} />
                  </button>
                  {mobileLangOpen ? (
                    <div className={`absolute top-full z-50 mt-2 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-card ${
                      isRtl ? "end-0" : "start-0"
                    }`}>
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-start text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        onClick={() => {
                          onLanguageChange(language);
                          setMobileLangOpen(false);
                        }}
                      >
                        {t.meta.languageName}
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-start text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        onClick={() => {
                          onLanguageChange(nextLanguage);
                          setMobileLangOpen(false);
                        }}
                      >
                        {t.meta.otherLanguageName}
                      </button>
                    </div>
                  ) : null}
                </div>
                <Link
                  to="/login"
                  onClick={() => setMobileLangOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 shadow-sm transition hover:border-primary-200 hover:text-primary-700"
                >
                  {t.header.login}
                </Link>
              </div>
            )}

            {isAuthenticated && (
              <div className={`${mobileActionsOrderClass} flex items-center gap-2 md:order-none`}>
                <Link
                  to="/student/dashboard"
                  onClick={() => {
                    setMobileOpen(false);
                    setMobileLangOpen(false);
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 px-4 text-sm font-bold text-primary-700 shadow-sm transition hover:border-primary-300 hover:bg-primary-100 md:hidden"
                >
                  {uT.dashboard}
                </Link>
                <div className="relative md:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileLangOpen((prev) => !prev);
                    }}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 shadow-sm transition hover:border-primary-200 hover:text-primary-700"
                  >
                    {t.meta.languageName}
                    <ChevronDown size={14} />
                  </button>
                  {mobileLangOpen ? (
                    <div
                      className={`absolute top-full z-50 mt-2 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-card ${
                        isRtl ? "end-0" : "start-0"
                      }`}
                    >
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-start text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        onClick={() => {
                          onLanguageChange(language);
                          setMobileLangOpen(false);
                        }}
                      >
                        {t.meta.languageName}
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-start text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        onClick={() => {
                          onLanguageChange(nextLanguage);
                          setMobileLangOpen(false);
                        }}
                      >
                        {t.meta.otherLanguageName}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <button
              className={`grid h-11 w-11 place-items-center rounded-lg border border-slate-200 text-slate-800 md:hidden ${
                mobileOpen ? "invisible pointer-events-none" : ""
              } ${mobileMenuOrderClass}`}
              type="button"
              aria-label={t.header.menu}
              onClick={() => {
                setMobileOpen(true);
                setMobileLangOpen(false);
              }}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label={t.header.closeMenu}
              className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]"
              onClick={() => setMobileOpen(false)}
            />
            <aside
              className={`absolute top-0 flex h-full w-64 flex-col overflow-y-auto border-slate-200 bg-white p-4 shadow-2xl ${
                t.meta.dir === "rtl"
                  ? "right-0 border-l"
                  : "left-0 border-r"
              }`}
            >
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <p className="text-sm font-black text-slate-900">
                  {t.header.menuTitle || t.header.menu}
                </p>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-700"
                  onClick={() => setMobileOpen(false)}
                  aria-label={t.header.closeMenu}
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
                {t.header.nav
                  .filter(
                    (item) =>
                      item.href !== "/#how-it-works" &&
                      item.href !== "/#pricing",
                  )
                  .map((item) => (
                    <Link
                      className="rounded-xl px-3 py-3 text-start text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-primary-700"
                      to={item.href}
                      key={item.href}
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
              </nav>

              {isAuthenticated ? (
                <div className="mt-auto border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-bold text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut size={16} />
                    {uT.logout}
                  </button>
                </div>
              ) : null}

            </aside>
          </div>
        ) : null}
      </header>
      <div className="h-[76px]" aria-hidden="true" />
    </>
  );
}
