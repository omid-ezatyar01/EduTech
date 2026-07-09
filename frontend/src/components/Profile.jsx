import { useEffect, useMemo, useState } from "react";
import { User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import StudentLayout from "./StudentLayout.jsx";
import ProfileForm from "./ProfileForm.jsx";
import AccountInfoCard from "./AccountInfoCard.jsx";
import LearningStatsCard from "./LearningStatsCard.jsx";
import AccountSecurityModal from "./AccountSecurityModal.jsx";
import { clearAuth, getAuthUser, setAuthNotice } from "../../services/portal";
import { isUnauthorizedError } from "../../services/http";
import { fetchStudentLearningStats } from "../../services/courseService";

const mockProfileData = {
  id: 1,
  studentId: "EDU-2026-00017",
  username: "omid.ezatyar",
  firstNameFa: "امید",
  lastNameFa: "عزتیار",
  nameFa: "امید عزتیار",
  email: "student@edutech.com",
  phone: "+93 70 123 4567",
  avatar: "",
  birthDate: "1378/08/15",
  gender: "مرد",
  country: "افغانستان",
  city: "کابل",
  address: "سرک دارالامان، ناحیه پنجم",
  postalCode: "1001",
  gradeLevel: "محصل لیسانس",
  schoolName: "دانشگاه کابل",
  preferredLanguage: "فارسی",
  timezone: "Asia/Kabul",
  parentName: "محمدعلی عزتیار",
  parentPhone: "+93 79 555 1122",
  emergencyContactName: "احمد حبیبی",
  emergencyContactPhone: "+93 78 234 7788",
  bio: "علاقه‌مند به یادگیری برنامه‌نویسی و طراحی رابط کاربری. هدفم توسعه مهارت‌های خود در حوزه تکنالوژی است.",
  socialLinks: {
    linkedin: "linkedin.com/in/omid-aztiyar",
    twitter: "twitter.com/omid_aztiyar",
    github: "github.com/omid-aztiyar",
  },
  notifications: {
    course: true,
    assignments: true,
    payments: true,
    news: false,
    important: true,
  },
  security: {
    twoFactor: true,
    activeDevices: ["Chrome on Linux", "Android Phone"],
    lastUpdatedAt: "",
  },
  stats: {
    enrolledCourses: 7,
    completedAssignments: 24,
    learningHours: 120,
    averageProgress: 72,
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
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [securitySuccessMsg, setSecuritySuccessMsg] = useState("");
  const [refreshSeed, setRefreshSeed] = useState(0);

  const [isSecurityModalOpen, setSecurityModalOpen] = useState(false);

  const handleProfileUpdated = (updatedUser) => {
    const merged = { ...fullUser, ...updatedUser };
    setProfileUser(merged);
    localStorage.setItem("edutech_user", JSON.stringify(merged));
    window.dispatchEvent(new Event("auth_change"));
  };

  const handleSecurityUpdated = (securityUpdate) => {
    handleProfileUpdated({
      security: {
        ...(fullUser.security || {}),
        ...(securityUpdate || {}),
      },
    });
  };

  useEffect(() => {
    let mounted = true;

    const loadLearningStats = async () => {
      try {
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
        }
      }
    };

    loadLearningStats();
    return () => {
      mounted = false;
    };
  }, [navigate, refreshSeed]);

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
        <AccountInfoCard
          user={fullUser}
          onSecuritySettings={() => setSecurityModalOpen(true)}
          language={language}
        />
      </div>

      {securitySuccessMsg ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {securitySuccessMsg}
        </div>
      ) : null}

      <div className="mt-6">
        <LearningStatsCard stats={learningStats} language={language} />
      </div>
      <div className="h-8" aria-hidden="true" />

      <AccountSecurityModal
        key={`security-${isSecurityModalOpen}-${fullUser.security?.lastUpdatedAt || ""}`}
        isOpen={isSecurityModalOpen}
        onClose={() => setSecurityModalOpen(false)}
        onSave={handleSecurityUpdated}
        onSuccess={(message) => {
          setSecuritySuccessMsg(message);
          setTimeout(() => setSecuritySuccessMsg(""), 4000);
        }}
        language={language}
      />
    </StudentLayout>
  );
}
