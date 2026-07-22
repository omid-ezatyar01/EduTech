import { useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { resolveAvatarUrl } from "../utils/avatar";
import { clearAuth, getAuthUser } from "../../services/portal";
import {
  Home,
  BookOpen,
  Video,
  Calendar,
  ClipboardList,
  FolderOpen,
  CreditCard,
  Award,
  User,
  Settings,
  LogOut,
  X,
  UserCheck,
  MessageSquareHeart,
} from "lucide-react";

const menuItems = {
  fa: [
    { path: "/student/dashboard", name: "داشبورد", icon: Home },
    { path: "/student/courses", name: "کورس‌های من", icon: BookOpen },
    { path: "/student/live", name: "صنف آنلاین", icon: Video },
    { path: "/student/attendance", name: "حضور و غیاب", icon: UserCheck },
    { path: "/student/schedule", name: "تقسیم اوقات", icon: Calendar },
    { path: "/student/assignments", name: "تمرین‌ها", icon: ClipboardList },
    { path: "/student/resources", name: "منابع درسی", icon: FolderOpen },
    { path: "/student/payments", name: "پرداخت‌ها", icon: CreditCard },
    { path: "/student/certificates", name: "سرتیفیکیت‌ها", icon: Award },
    { path: "/student/feedback", name: "بازخورد ایجوتک", icon: MessageSquareHeart },
    { path: "/student/profile", name: "پروفایل", icon: User },
    { path: "/student/settings", name: "تنظیمات", icon: Settings },
  ],
  en: [
    { path: "/student/dashboard", name: "Dashboard", icon: Home },
    { path: "/student/courses", name: "My Courses", icon: BookOpen },
    { path: "/student/live", name: "Live Class", icon: Video },
    { path: "/student/attendance", name: "Attendance", icon: UserCheck },
    { path: "/student/schedule", name: "Schedule", icon: Calendar },
    { path: "/student/assignments", name: "Assignments", icon: ClipboardList },
    { path: "/student/resources", name: "Resources", icon: FolderOpen },
    { path: "/student/payments", name: "Payments", icon: CreditCard },
    { path: "/student/certificates", name: "Certificates", icon: Award },
    { path: "/student/feedback", name: "EduTech Feedback", icon: MessageSquareHeart },
    { path: "/student/profile", name: "Profile", icon: User },
    { path: "/student/settings", name: "Settings", icon: Settings },
  ],
};

export default function StudentSidebar({ language = "fa", onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const navScrollRef = useRef(null);
  const activeItemRef = useRef(null);
  const user = getAuthUser() || {};
  const userAvatar = resolveAvatarUrl(user?.avatar || "");
  const preferredName =
    language === "fa"
      ? user?.firstNameFa || user?.nameFa || user?.name || user?.username
      : user?.firstName || user?.name || user?.nameFa || user?.firstNameFa || user?.username;
  const userInitial =
    ((user?.avatarInitial || preferredName || "S").trim()[0] ||
      "S"
    ).toUpperCase();
  const userName = preferredName || "Student";
  const userStudentId = user?.studentId || "";
  const isFa = language === "fa";
  const sidebarItems = menuItems[language] || menuItems.fa;

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  useEffect(() => {
    if (!navScrollRef.current || !activeItemRef.current) return;
    activeItemRef.current.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  }, [currentPath]);

  return (
    <div
      className={`relative flex h-full flex-col bg-white ${
        isFa ? "border-l" : "border-r"
      } border-slate-200`}
      dir={isFa ? "rtl" : "ltr"}
    >
      <button
        onClick={onClose}
        className="absolute end-4 top-4 z-10 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 lg:hidden"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="h-12 w-12 rounded-full border-2 border-slate-100 object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
                const fallback = event.currentTarget.nextElementSibling;
                if (fallback) fallback.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="hidden h-12 w-12 items-center justify-center rounded-full border-2 border-slate-100 bg-slate-200 text-sm font-black text-slate-700"
            style={{ display: userAvatar ? "none" : "flex" }}
          >
            {userInitial}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="block w-full truncate font-bold text-slate-900" title={userName}>
              {userName}
            </span>
            {userStudentId ? (
              <span className="block w-full truncate text-[11px] font-bold text-slate-500" dir="ltr">
                {userStudentId}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div ref={navScrollRef} className="flex-1 overflow-y-auto py-4 px-3" dir="ltr">
        <ul className="space-y-1" dir={isFa ? "rtl" : "ltr"}>
          {sidebarItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <li key={item.name}>
                <NavLink
                  ref={isActive ? activeItemRef : null}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive
                      ? `bg-primary-50 text-primary-600 ${
                          isFa
                            ? "border-r-4 border-primary-600"
                            : "border-l-4 border-primary-600"
                        }`
                      : `text-slate-600 hover:bg-slate-50 hover:text-slate-900 ${
                          isFa
                            ? "border-r-4 border-transparent"
                            : "border-l-4 border-transparent"
                        }`
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon
                      className={`h-5 w-5 ${isActive ? "text-primary-600" : "text-slate-400"}`}
                    />
                    {item.name}
                  </div>
                  {item.badge && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-600">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-4 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut className="h-5 w-5" />
          {isFa ? "خروج" : "Logout"}
        </button>
      </div>
    </div>
  );
}
