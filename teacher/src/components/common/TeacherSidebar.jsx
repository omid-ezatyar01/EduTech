import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Home,
  FolderOpen,
  LogOut,
  Settings,
  User,
  Users,
  Video,
  DollarSign,
  UserCheck,
  Newspaper,
  MessageSquareHeart,
  Headphones,
} from "lucide-react";
import { NavLink } from "react-router";

const menuItems = [
  { key: "dashboard", labelFa: "داشبورد", labelEn: "Dashboard", path: "/teacher/dashboard", icon: Home },
  { key: "courses", labelFa: "کورس‌های من", labelEn: "My Courses", path: "/teacher/courses", icon: BookOpen },
  { key: "live", labelFa: "صنف‌های زنده", labelEn: "Live Classes", path: "/teacher/live-classes", icon: Video },
  { key: "attendance", labelFa: "حضور و غیاب", labelEn: "Attendance", path: "/teacher/attendance", icon: UserCheck },
  { key: "students", labelFa: "شاگردان", labelEn: "Students", path: "/teacher/students", icon: Users },
  { key: "assignments", labelFa: "تمرین‌ها", labelEn: "Assignments", path: "/teacher/assignments", icon: ClipboardList },
  { key: "resources", labelFa: "منابع درسی", labelEn: "Resources", path: "/teacher/resources", icon: FolderOpen },
  { key: "videos", labelFa: "ویدیوهای من", labelEn: "My Videos", path: "/teacher/videos", icon: Video },
  { key: "articles", labelFa: "مقاله‌های من", labelEn: "My Articles", path: "/teacher/articles", icon: Newspaper },
  { key: "reports", labelFa: "گزارش‌ها", labelEn: "Reports", path: "/teacher/reports", icon: BarChart3 },
  { key: "feedback", labelFa: "بازخورد شاگردان", labelEn: "Student Feedback", path: "/teacher/feedback", icon: MessageSquareHeart },
  { key: "support", labelFa: "کمک و پشتیبانی", labelEn: "Help & Support", path: "/teacher/support", icon: Headphones },
  { key: "income", labelFa: "درآمد", labelEn: "Income", path: "/teacher/income", icon: DollarSign },
  { key: "profile", labelFa: "پروفایل", labelEn: "Profile", path: "/teacher/profile", icon: User },
  { key: "settings", labelFa: "تنظیمات", labelEn: "Settings", path: "/teacher/settings", icon: Settings },
];

export default function TeacherSidebar({
  language,
  isRTL,
  onLogout,
  onCloseMobile,
  mobile = false,
}) {
  return (
    <aside className="flex h-full w-full flex-col bg-white">
      <div
        className={`flex h-[var(--teacher-shell-header-height)] items-center px-4 ${
          mobile ? "border-b border-slate-200" : ""
        } ${
          isRTL ? "text-right" : "text-left"
        }`}
      >
        <div className={`flex items-center gap-2 ${isRTL ? "" : "flex-row-reverse justify-end"}`}>
          <img
            src="/logo.png"
            alt="EduTech"
            className="h-9 w-auto object-contain"
            onError={(event) => {
              event.currentTarget.src = "/icons/favicon-96x96.png";
              event.currentTarget.className = "h-8 w-8 rounded-lg object-contain";
            }}
          />
        </div>
      </div>

      <nav className="edutech-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-4 [direction:ltr] [scrollbar-gutter:stable] sm:pt-6">
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
              <span className="flex-1">{language === "fa" ? item.labelFa : item.labelEn}</span>
              {item.badge ? (
                <span className="rounded-full bg-[#8B5CF6]/10 px-2 py-0.5 text-[11px] font-black text-[#8B5CF6]">
                  {item.badge}
                </span>
              ) : null}
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
          {language === "fa" ? "خروج" : "Logout"}
        </button>
      </div>
    </aside>
  );
}
