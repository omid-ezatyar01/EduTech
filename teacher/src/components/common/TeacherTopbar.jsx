import {
  Check,
  ChevronDown,
  Menu,
  Search,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export default function TeacherTopbar({
  language,
  isRTL,
  onLanguageChange,
  onOpenMobileSidebar,
}) {
  const location = useLocation();
  const [openLangs, setOpenLangs] = useState(false);
  const langRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langRef.current && !langRef.current.contains(event.target)) {
        setOpenLangs(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const languages = [
    { value: "fa", label: "فارسی" },
    { value: "en", label: "English" },
  ];
  const currentLabel = languages.find((item) => item.value === language)?.label || "فارسی";
  const currentMobileLabel = language === "fa" ? "FA" : "EN";
  const isStudentsPage = location.pathname.startsWith("/teacher/students");
  const isLiveClassesPage = location.pathname.startsWith("/teacher/live-classes");
  const isAttendancePage = location.pathname.startsWith("/teacher/attendance");
  const isAssignmentsPage = location.pathname.startsWith("/teacher/assignments");
  const isMessagesPage = location.pathname.startsWith("/teacher/messages");
  const searchPlaceholder = isLiveClassesPage
    ? language === "fa"
      ? "جستجو در صنف‌ها..."
      : "Search live classes..."
    : isAttendancePage
      ? language === "fa"
        ? "جستجو در حضور و غیاب..."
        : "Search attendance..."
      : isAssignmentsPage
      ? language === "fa"
        ? "جستجو در تمرین‌ها..."
        : "Search assignments..."
      : isStudentsPage
        ? language === "fa"
          ? "جستجو در شاگردان..."
          : "Search students..."
        : isMessagesPage
          ? language === "fa"
            ? "جستجو در پیام‌ها..."
            : "Search messages..."
          : language === "fa"
            ? "جستجو در کورس‌ها، شاگردان، صنف‌ها ..."
            : "Search courses, students, classes ...";

  return (
    <header className="sticky top-0 z-30 flex h-[var(--teacher-shell-header-height)] items-center justify-between bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 xl:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-[#0B4FD8] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0B4FD8]/10 lg:w-96">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className={`w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400 ${
              isRTL ? "text-right" : "text-left"
            }`}
            dir={isRTL ? "rtl" : "ltr"}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative" ref={langRef}>
          <button
            type="button"
            onClick={() => setOpenLangs((prev) => !prev)}
            className="inline-flex min-w-[64px] items-center justify-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs font-black text-[#1D4ED8] shadow-sm transition hover:bg-[#DBEAFE] sm:min-w-[88px]"
            aria-label={language === "fa" ? "تغییر زبان" : "Change language"}
          >
            <span className="sm:hidden">{currentMobileLabel}</span>
            <span className="hidden sm:inline">{currentLabel}</span>
            <ChevronDown
              size={13}
              className={`text-slate-500 transition ${openLangs ? "rotate-180" : ""}`}
            />
          </button>

          {openLangs ? (
            <div
              className={`absolute top-full z-50 mt-2 min-w-[130px] rounded-xl border border-slate-200 bg-white p-1 shadow-xl ${
                isRTL ? "left-0" : "right-0"
              }`}
            >
              {languages.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    onLanguageChange(item.value);
                    setOpenLangs(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
                    item.value === language
                      ? "bg-[#0B4FD8]/10 text-[#0B4FD8]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.value === language ? <Check size={12} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
