import { useEffect, useState } from "react";
import TeacherSidebar from "../components/common/TeacherSidebar";
import TeacherTopbar from "../components/common/TeacherTopbar";
import TeacherSupportContactButton from "../components/common/TeacherSupportContactButton";
import { PORTAL_CONFIG, clearAuth } from "../../services/portal.js";

export default function TeacherLayout({ teacher, language, onLanguageChange, children }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isRTL = language === "fa";

  const handleLogout = () => {
    clearAuth({ notify: false });
    window.location.replace(PORTAL_CONFIG.loginPath);
  };

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileSidebarOpen]);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="h-[100dvh] overflow-hidden bg-[#F8FAFC]">
      <div className="relative mx-auto flex h-full max-w-[1700px]">
        <aside
          className={`hidden h-full w-[260px] shrink-0 border-[#E2E8F0] bg-white xl:block ${
            isRTL ? "border-l" : "border-r"
          }`}
        >
          <div className="h-full overflow-hidden [direction:ltr]">
            <div dir={isRTL ? "rtl" : "ltr"} className="h-full">
              <TeacherSidebar
                teacher={teacher}
                language={language}
                isRTL={isRTL}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TeacherTopbar
            teacher={teacher}
            language={language}
            isRTL={isRTL}
            onLanguageChange={onLanguageChange}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          />

          <div className="min-h-0 flex-1 overflow-y-auto [direction:ltr]">
            <div dir={isRTL ? "rtl" : "ltr"}>
              <main className="p-4 sm:p-6">{children}</main>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-0 right-0 top-[var(--teacher-shell-header-height)] z-20 h-px bg-slate-200" />

      <div
        className={`fixed inset-0 z-40 bg-[#0F172A]/45 transition ${
          mobileSidebarOpen ? "opacity-100 xl:hidden" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden="true"
      />

      <div
        className={`fixed bottom-0 top-0 z-50 h-[100dvh] w-[62%] max-w-[200px] bg-white shadow-2xl transition-transform duration-300 xl:hidden ${
          isRTL ? "right-0" : "left-0"
        } ${
          mobileSidebarOpen
            ? "translate-x-0"
            : isRTL
              ? "translate-x-full"
            : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal={mobileSidebarOpen ? "true" : undefined}
        aria-hidden={!mobileSidebarOpen}
      >
        <div className="h-full overflow-hidden [direction:ltr]">
          <div dir={isRTL ? "rtl" : "ltr"} className="h-full">
            <TeacherSidebar
              teacher={teacher}
              language={language}
              isRTL={isRTL}
              onLogout={handleLogout}
              onCloseMobile={() => setMobileSidebarOpen(false)}
              mobile
            />
          </div>
        </div>
      </div>
      <TeacherSupportContactButton language={language} />
    </div>
  );
}
