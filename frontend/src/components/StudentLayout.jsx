import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import StudentSidebar from "./StudentSidebar";
import StudentAiChatWidget from "./StudentAiChatWidget";
import StudentTopbar from "./StudentTopbar";

export default function StudentLayout({ children, language = "fa" }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mainRef = useRef(null);
  const { pathname } = useLocation();
  const dir = language === "fa" ? "rtl" : "ltr";
  const isRtl = dir === "rtl";

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <div
      className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900"
      dir={dir}
    >
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 z-50 w-64 transform bg-white transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:block lg:translate-x-0 ${
          isRtl
            ? `right-0 ${isMobileMenuOpen ? "translate-x-0" : "translate-x-full"}`
            : `left-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`
        }`}
      >
        <StudentSidebar
          language={language}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <StudentTopbar language={language} onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto" dir="ltr">
          <div className="h-full p-4 pb-10 sm:p-6 sm:pb-12 lg:p-8 lg:pb-14" dir={dir}>
            {children}
          </div>
        </main>
      </div>

      <StudentAiChatWidget language={language} />
    </div>
  );
}
