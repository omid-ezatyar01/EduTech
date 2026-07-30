import { useEffect, useMemo, useState } from "react";
import { User } from "lucide-react";
import { Link, useNavigate } from "react-router";
import StudentLayout from "./StudentLayout.jsx";
import ProfileForm from "./ProfileForm.jsx";
import LearningStatsCard from "./LearningStatsCard.jsx";
import { clearAuth, getAuthUser, setAuthNotice } from "../../services/portal";
import {
  getLocalizedRequestErrorMessage,
  isUnauthorizedError,
} from "../../services/http";
import { fetchStudentLearningStats } from "../../services/courseService";

const mockProfileData = {
  id: "",
  studentId: "",
  username: "",
  firstNameFa: "",
  lastNameFa: "",
  nameFa: "",
  email: "",
  phone: "",
  avatar: "",
  birthDate: "",
  gender: "",
  country: "",
  city: "",
  address: "",
  postalCode: "",
  gradeLevel: "",
  schoolName: "",
  preferredLanguage: "",
  timezone: "",
  parentName: "",
  parentPhone: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  bio: "",
  socialLinks: {
    linkedin: "",
    twitter: "",
    github: "",
  },
  notifications: {
    course: false,
    assignments: false,
    payments: false,
    news: false,
    important: false,
  },
  security: {
    twoFactor: false,
    activeDevices: [],
    lastUpdatedAt: "",
  },
  stats: {
    enrolledCourses: 0,
    completedAssignments: 0,
    learningHours: 0,
    averageProgress: 0,
  },
};

const emptyProfileData = {
  ...mockProfileData,
  id: "",
  studentId: "",
  username: "",
  firstNameFa: "",
  lastNameFa: "",
  nameFa: "",
  email: "",
  phone: "",
  avatar: "",
  birthDate: "",
  gender: "",
  country: "",
  city: "",
  address: "",
  postalCode: "",
  gradeLevel: "",
  schoolName: "",
  preferredLanguage: "",
  timezone: "",
  parentName: "",
  parentPhone: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  bio: "",
  socialLinks: {
    linkedin: "",
    twitter: "",
    github: "",
  },
  security: {
    twoFactor: false,
    activeDevices: [],
    lastUpdatedAt: "",
  },
  stats: {
    enrolledCourses: 0,
    completedAssignments: 0,
    learningHours: 0,
    averageProgress: 0,
  },
};

export default function Profile({ language = "fa" }) {
  const isFa = language === "fa";
  const t = {
    dashboard: isFa ? "داشبورد" : "Dashboard",
    profile: isFa ? "پروفایل" : "Profile",
    myProfile: isFa ? "پروفایل من" : "My Profile",
    subtitle: isFa
      ? "اطلاعات شخصی خود را مدیریت و تنظیمات حساب کاربری را به‌روزرسانی کنید."
      : "Manage your personal information and update your account settings.",
  };
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(getAuthUser() || emptyProfileData);
  const fullUser = useMemo(
    () => ({ ...emptyProfileData, ...(profileUser || {}) }),
    [profileUser],
  );
  const [learningStats, setLearningStats] = useState(emptyProfileData.stats);
  const [statsError, setStatsError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);

  const handleProfileUpdated = (updatedUser) => {
    const merged = { ...fullUser, ...updatedUser };
    setProfileUser(merged);
    localStorage.setItem("edutech_user", JSON.stringify(merged));
    window.dispatchEvent(new Event("auth_change"));
  };

  useEffect(() => {
    let mounted = true;

    const loadLearningStats = async () => {
      try {
        setStatsError("");
        const stats = await fetchStudentLearningStats();
        if (!mounted) return;
        setLearningStats(stats);
      } catch (error) {
        if (!mounted) return;
        if (isUnauthorizedError(error)) {
          setAuthNotice("Not authorized for this resource");
          clearAuth();
          setIsRedirecting(true);
          navigate("/login", { replace: true });
          return;
        }
        setStatsError(
          getLocalizedRequestErrorMessage(
            error,
            language,
            "بارگذاری آمار یادگیری انجام نشد.",
            "Unable to load learning statistics.",
          ),
        );
      }
    };

    loadLearningStats();
    return () => {
      mounted = false;
    };
  }, [language, navigate, refreshSeed]);

  useEffect(() => {
    const triggerRefresh = () => setRefreshSeed((value) => value + 1);
    window.addEventListener("auth_change", triggerRefresh);
    window.addEventListener("edutech_data_changed", triggerRefresh);
    return () => {
      window.removeEventListener("auth_change", triggerRefresh);
      window.removeEventListener("edutech_data_changed", triggerRefresh);
    };
  }, []);

  if (isRedirecting) return null;

  return (
    <StudentLayout language={language} user={fullUser}>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
        <Link
          className="transition hover:text-primary-700"
          to="/student/dashboard"
        >
          {t.dashboard}
        </Link>
        <span>/</span>
        <span className="text-slate-900">{t.profile}</span>
      </div>

      <div className="mb-8 flex items-end gap-4">
        <div className="hidden h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-glow sm:flex">
          <User size={32} />
        </div>
        <div className="pb-1">
          <h1 className="text-3xl font-black text-slate-950">{t.myProfile}</h1>
          <p className="mt-1 text-lg font-medium text-slate-600">
            {t.subtitle}
          </p>
        </div>
      </div>

      <div>
        <ProfileForm
          user={fullUser}
          onProfileUpdated={handleProfileUpdated}
          language={language}
        />
      </div>

      <div className="mt-6">
        {statsError ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            <p>{statsError}</p>
            <button
              type="button"
              onClick={() => setRefreshSeed((value) => value + 1)}
              className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white"
            >
              {isFa ? "تلاش دوباره" : "Try again"}
            </button>
          </div>
        ) : null}
        <LearningStatsCard stats={learningStats} language={language} />
      </div>
      <div className="h-8" aria-hidden="true" />

    </StudentLayout>
  );
}
