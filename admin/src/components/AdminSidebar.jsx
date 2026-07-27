import {
  LayoutDashboard,
  GraduationCap,
  UserCheck,
  Award,
  BookOpen,
  Layers,
  CreditCard,
  Wallet,
  Ticket,
  Mail,
  BarChart3,
  Settings,
  LogOut,
  Clapperboard,
  Newspaper,
  MessageSquareHeart,
  Landmark,
  Headphones,
  UsersRound,
} from "lucide-react";
import { NavLink } from "react-router";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";

const menuItems = [
  { key: "dashboard", icon: LayoutDashboard, path: "/" },
  { key: "students", icon: GraduationCap, path: "/students" },
  { key: "teachers", icon: UserCheck, path: "/teachers" },
  { key: "certificates", icon: Award, path: "/certificates" },
  { key: "courses", icon: BookOpen, path: "/courses" },
  { key: "categories", icon: Layers, path: "/categories" },
  { key: "videos", icon: Clapperboard, path: "/videos" },
  { key: "articles", icon: Newspaper, path: "/articles" },
  { key: "payments", icon: CreditCard, path: "/payments" },
  { key: "teacherIncome", icon: Wallet, path: "/teacher-income" },
  { key: "bankReviews", icon: Landmark, path: "/teacher-bank-reviews" },
  { key: "coupons", icon: Ticket, path: "/coupons" },
  { key: "messages", icon: Mail, path: "/messages" },
  { key: "support", icon: Headphones, path: "/support" },
  { key: "supportStaff", icon: UsersRound, path: "/support-staff" },
  { key: "reports", icon: BarChart3, path: "/reports" },
  { key: "feedback", icon: MessageSquareHeart, path: "/feedback" },
  { key: "settings", icon: Settings, path: "/settings" },
];

export default function AdminSidebar({ onLogout, onCloseMobile }) {
  const { t, isRTL } = useAdminI18n();

  return (
    <aside className="flex h-full w-full flex-col bg-white">
      <div
        className={`flex h-[var(--admin-shell-header-height)] shrink-0 items-center border-b border-slate-200 px-4 ${
          isRTL ? "text-right" : "text-left"
        }`}
      >
        <div
          className={`flex items-center gap-2 ${isRTL ? "" : "flex-row-reverse justify-end"}`}
        >
          <img
            src="/logo.png"
            alt="EduTech"
            className="h-9 w-auto object-contain"
            onError={(event) => {
              event.currentTarget.src = "/icons/favicon-96x96.png";
              event.currentTarget.className =
                "h-8 w-8 rounded-lg object-contain";
            }}
          />
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-4 [direction:ltr] sm:pt-6">
        <div className="space-y-1.5" dir={isRTL ? "rtl" : "ltr"}>
          {menuItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                  isRTL ? "text-right" : "text-left"
                } ${
                  isActive
                    ? `bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9] text-white shadow-[0_12px_30px_rgba(11,79,216,0.24)] ${isRTL ? "border-r-[3px] border-[#0B4FD8]" : "border-l-[3px] border-[#0B4FD8]"}`
                    : "text-slate-600 hover:bg-slate-50 hover:text-[#0B4FD8]"
                }`
              }
            >
              <item.icon size={17} />
              <span className="flex-1">{t(`sidebar.menu.${item.key}`)}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="shrink-0 border-t border-[#E2E8F0] p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-xl bg-[#EF4444]/10 px-3 py-2.5 text-sm font-bold text-[#EF4444] transition hover:bg-[#EF4444]/15"
        >
          <LogOut size={17} />
          {t("header.logout")}
        </button>
      </div>
    </aside>
  );
}
