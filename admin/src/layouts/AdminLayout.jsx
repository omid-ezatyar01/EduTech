import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import AdminSidebar from "../components/AdminSidebar";
import AdminHeader from "../components/AdminHeader";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import { getAuthUser } from "../../services/portal.js";

export default function AdminLayout({ children, onLogout }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const { isRTL } = useAdminI18n();
  const admin = useMemo(() => {
    const user = getAuthUser();
    return user || { name: "System Admin", email: "admin@edutech.com", role: "admin" };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setMobileSidebarOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileSidebarOpen]);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="h-[100dvh] overflow-hidden bg-[#F8FAFC] font-sans">
      <div className="relative mx-auto flex h-full max-w-[1700px]">
        <aside
          className={`hidden h-full w-[260px] shrink-0 border-[#E2E8F0] bg-white xl:block ${
            isRTL ? "border-l" : "border-r"
          }`}
        >
          <div className="h-full overflow-hidden [direction:ltr]">
            <div dir={isRTL ? "rtl" : "ltr"} className="h-full">
              <AdminSidebar
                onLogout={onLogout}
              />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AdminHeader
            admin={admin}
            onMenuClick={() => setMobileSidebarOpen(true)}
          />

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [direction:ltr]">
            <div dir={isRTL ? "rtl" : "ltr"}>
              <main className="p-4 sm:p-6">{children}</main>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-[#0F172A]/45 transition ${
          mobileSidebarOpen ? "opacity-100 xl:hidden" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileSidebarOpen(false)}
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
      >
        <div className="h-full overflow-hidden [direction:ltr]">
          <div dir={isRTL ? "rtl" : "ltr"} className="h-full">
            <AdminSidebar
              onLogout={onLogout}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
