import {
  BarChart3,
  BookOpen,
  FilePlus2,
  PlusCircle,
  Upload,
  Users,
  ClipboardCheck,
  DollarSign,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPageLoader from "../components/common/TeacherPageLoader";
import TeacherStatsCard from "../components/dashboard/TeacherStatsCard";
import TeacherLiveClassesCard from "../components/dashboard/TeacherLiveClassesCard";
import TeacherCoursesCard from "../components/dashboard/TeacherCoursesCard";
import TeacherAssignmentsCard from "../components/dashboard/TeacherAssignmentsCard";
import TeacherIncomeCard from "../components/dashboard/TeacherIncomeCard";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import useLiveDataRefresh from "../hooks/useLiveDataRefresh";
import {
  getTeacherPageCacheKey,
  readTeacherPageCache,
  writeTeacherPageCache,
} from "../utils/teacherPageCache";
import { fetchTeacherDashboard } from "../../services/teacherPortalService";
import { getAuthUser } from "../../services/portal";

const formatUsd = (value, language = "fa") => {
  const amount = Number(value || 0);
  const amountLabel = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${amountLabel} ${language === "fa" ? "دالر" : "USD"}`;
};
const DEFAULT_MONTHLY_GOAL_USD = 1500;
const DASHBOARD_CACHE_KEY = getTeacherPageCacheKey("dashboard");
const DEFAULT_DASHBOARD_DATA = {
  stats: {
    activeCourses: 0,
    activeStudents: 0,
    pendingAssignments: 0,
    monthIncome: 0,
  },
  contract: {
    startDate: null,
    validUntil: null,
  },
  liveClasses: [],
  courseProgress: [],
  reviewAssignments: [],
};
const formatDashboardDate = (value, language = "fa") => {
  if (!value) return language === "fa" ? "ثبت نشده" : "Not set";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return language === "fa" ? "ثبت نشده" : "Not set";
    }

    if (language === "fa") {
      return new Intl.DateTimeFormat("fa-AF-u-ca-persian", {
        year: "numeric",
        month: "long",
        day: "2-digit",
      }).format(date);
    }

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(date);
  } catch {
    return language === "fa" ? "ثبت نشده" : "Not set";
  }
};
const normalizeMonthlyGoal = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_MONTHLY_GOAL_USD;
  return Math.max(0, Math.min(1000000, Math.round(numeric)));
};

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const cachedDashboard = readTeacherPageCache(DASHBOARD_CACHE_KEY);
  const [dashboardData, setDashboardData] = useState(cachedDashboard || DEFAULT_DASHBOARD_DATA);
  const [loading, setLoading] = useState(!cachedDashboard);
  const [error, setError] = useState("");
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [monthlyGoal, setMonthlyGoal] = useState(DEFAULT_MONTHLY_GOAL_USD);

  const teacher = useMemo(() => {
    const user = getAuthUser();
    return user || { name: "Teacher", email: "teacher@edutech.study", role: "teacher" };
  }, []);
  const monthlyGoalStorageKey = useMemo(() => {
    const teacherIdentity =
      teacher?._id ||
      teacher?.id ||
      teacher?.email ||
      teacher?.name ||
      "teacher";
    return `edutech_teacher_monthly_goal:${teacherIdentity}`;
  }, [teacher]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setTimeout(() => {
      const saved = (() => {
        try {
          return window.localStorage.getItem(monthlyGoalStorageKey);
        } catch {
          return null;
        }
      })();
      if (!saved) return;
      setMonthlyGoal(normalizeMonthlyGoal(saved));
    }, 0);
    return () => clearTimeout(timer);
  }, [monthlyGoalStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        monthlyGoalStorageKey,
        String(normalizeMonthlyGoal(monthlyGoal)),
      );
    } catch {
      // ignore storage failures
    }
  }, [monthlyGoal, monthlyGoalStorageKey]);

  useLiveDataRefresh(() => setRefreshSeed((prev) => prev + 1), {
    intervalMs: 0,
    refreshOnFocus: false,
    refreshOnVisible: false,
  });

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      const cached = readTeacherPageCache(DASHBOARD_CACHE_KEY);
      if (cached) {
        setDashboardData(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        setError("");
        const data = await fetchTeacherDashboard();

        if (!isMounted) return;

        const nextDashboard = {
          stats: {
            activeCourses: Number(data?.stats?.activeCourses || 0),
            activeStudents: Number(data?.stats?.activeStudents || 0),
            pendingAssignments: Number(data?.stats?.pendingAssignments || 0),
            monthIncome: Number(data?.stats?.monthIncome || 0),
          },
          contract: {
            startDate: data?.contract?.startDate || null,
            validUntil: data?.contract?.validUntil || null,
          },
          liveClasses: Array.isArray(data?.liveClasses) ? data.liveClasses : [],
          courseProgress: Array.isArray(data?.courseProgress) ? data.courseProgress : [],
          reviewAssignments: Array.isArray(data?.reviewAssignments) ? data.reviewAssignments : [],
        };

        setDashboardData(nextDashboard);
        writeTeacherPageCache(DASHBOARD_CACHE_KEY, nextDashboard);
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load dashboard data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [refreshSeed]);

  const displayName =
    teacher?.name || (language === "fa" ? teacher?.nameFa : teacher?.nameEn) || "Teacher";
  const contractSummary = [
    {
      id: "contract-start",
      label: language === "fa" ? "تاریخ قرارداد" : "Contract Date",
      value: formatDashboardDate(dashboardData.contract?.startDate, language),
    },
    {
      id: "contract-valid-until",
      label: language === "fa" ? "اعتبار حساب" : "Account Valid Until",
      value: formatDashboardDate(dashboardData.contract?.validUntil, language),
    },
  ];

  const stats = [
    {
      id: "active-courses",
      title: language === "fa" ? "کورس‌های فعال" : "Active Courses",
      value: String(dashboardData.stats.activeCourses),
      icon: BookOpen,
      tone: "blue",
    },
    {
      id: "active-students",
      title: language === "fa" ? "شاگردان فعال" : "Active Students",
      value: String(dashboardData.stats.activeStudents),
      icon: Users,
      tone: "teal",
    },
    {
      id: "pending-assignments",
      title:
        language === "fa" ? "تمرین‌های نیازمند بررسی" : "Pending Assignments",
      value: String(dashboardData.stats.pendingAssignments),
      icon: ClipboardCheck,
      tone: "orange",
    },
    {
      id: "month-income",
      title: language === "fa" ? "درآمد خالص" : "Net Earnings",
      value: formatUsd(dashboardData.stats.monthIncome, language),
      icon: DollarSign,
      tone: "purple",
    },
  ];

  const welcomeActions = [
    {
      key: "live",
      labelFa: "ایجاد صنف زنده",
      labelEn: "Create Live Class",
      icon: PlusCircle,
      tone: "bg-[#0B4FD8]/10 text-[#0B4FD8]",
    },
    {
      key: "assignment",
      labelFa: "افزودن تمرین",
      labelEn: "Add Assignment",
      icon: FilePlus2,
      tone: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
    },
    {
      key: "resource",
      labelFa: "آپلود منبع",
      labelEn: "Upload Resource",
      icon: Upload,
      tone: "bg-[#00B8A9]/10 text-[#00B8A9]",
    },
    {
      key: "reports",
      labelFa: "مشاهده گزارش‌ها",
      labelEn: "View Reports",
      icon: BarChart3,
      tone: "bg-[#0EA5E9]/10 text-[#0EA5E9]",
    },
  ];

  return (
    <TeacherLayout
      teacher={teacher}
      language={language}
      onLanguageChange={setLanguage}
    >
      <div className={isRTL ? "text-right" : "text-left"}>
        <section className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-7">
          <h1 className="text-2xl font-black text-[#0F172A] sm:text-3xl">
            {language === "fa" ? `خوش آمدید، ${displayName}` : `Welcome, ${displayName}`}
          </h1>
          <p className="mt-3 max-w-4xl text-sm font-medium leading-7 text-slate-600">
            {language === "fa"
              ? "از اینجا می‌توانید کورس‌ها، شاگردان، صنف‌های زنده، تمرین‌ها و گزارش‌های آموزشی خود را مدیریت کنید."
              : "From here, you can manage your courses, students, live classes, assignments, and teaching reports."}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {welcomeActions.map((action) => (
              <button
                type="button"
                key={action.key}
                onClick={() => {
                  if (action.key === "live") navigate("/teacher/live-classes");
                  if (action.key === "assignment") navigate("/teacher/assignments");
                  if (action.key === "resource") navigate("/teacher/resources");
                  if (action.key === "reports") navigate("/teacher/reports");
                }}
                className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3 text-sm font-bold text-slate-700 transition hover:border-[#0B4FD8]/30 hover:bg-white"
              >
                <span className={`rounded-lg p-2 ${action.tone}`}>
                  <action.icon size={15} />
                </span>
                {language === "fa" ? action.labelFa : action.labelEn}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {contractSummary.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[#D7E3F4] bg-[#F8FBFF] px-4 py-4"
              >
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0B4FD8]">
                  {item.label}
                </p>
                <p className="mt-2 text-base font-black text-[#0F172A]">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {error ? (
          <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <TeacherPageLoader
            label={language === "fa" ? "در حال بارگذاری داشبورد" : "Loading dashboard"}
            className="mt-5"
          />
        ) : (
        <section className="mt-5 space-y-4">
          <div className="grid gap-4 lg:grid-cols-4">
            {stats.map((stat) => (
              <TeacherStatsCard
                key={stat.id}
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                tone={stat.tone}
              />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <TeacherLiveClassesCard classes={dashboardData.liveClasses} language={language} />
              <TeacherAssignmentsCard
                items={dashboardData.reviewAssignments}
                language={language}
              />
            </div>

            <div className="space-y-4">
              <TeacherCoursesCard courses={dashboardData.courseProgress} language={language} />
              <TeacherIncomeCard
                language={language}
                monthIncome={dashboardData.stats.monthIncome}
                monthlyGoal={monthlyGoal}
                onMonthlyGoalChange={(nextGoal) =>
                  setMonthlyGoal(normalizeMonthlyGoal(nextGoal))
                }
              />
            </div>
          </div>
        </section>
        )}
      </div>
    </TeacherLayout>
  );
}
