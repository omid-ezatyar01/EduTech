import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  GraduationCap,
  UserCheck,
  UserX,
  ShieldCheck,
  CalendarDays,
  MoreHorizontal,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";
import useLatestRequest from "../hooks/useLatestRequest.js";
import {
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";

const INITIAL_STATS = {
  totalUsers: 0,
  totalStudents: 0,
  totalTeachers: 0,
  totalAdmins: 0,
  activeStudents: 0,
  pendingStudents: 0,
  pendingUsers: 0,
  verifiedUsers: 0,
  unverifiedUsers: 0,
  blockedUsers: 0,
  commissionRate: 0,
};

const buildEmptyIncomeSeries = () => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
    return {
      monthKey: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      platformIncome: 0,
    };
  });
};

const DASHBOARD_TEXT = {
  "Welcome back, Admin": "خوش آمدید، ادمین",
  "Manage the EduTech platform, monitor user growth, and review system health from one place.":
    "پلتفرم EduTech را مدیریت کنید، رشد کاربران را ببینید و وضعیت کلی سیستم را از یکجا بررسی کنید.",
  Today: "امروز",
  "Total users": "مجموع کاربران",
  "Active students": "شاگردان فعال",
  Teachers: "مدرسان",
  Admins: "ادمین‌ها",
  "Blocked users": "کاربران مسدود",
  "Platform growth": "رشد پلتفرم",
  Distribution: "ترکیب کاربران",
  "Latest paid payments": "آخرین پرداخت‌های موفق",
  "Platform income": "درآمد سیستم",
  "Monthly platform commission from paid enrollments.": "کمیسیون ماهانه سیستم از ثبت‌نام‌های پرداخت‌شده.",
  "Latest successful enrollments with payment method, market, and platform share.":
    "آخرین ثبت‌نام‌های موفق را با روش پرداخت، بازار و سهم سیستم نشان می‌دهد.",
  Students: "شاگردان",
  Other: "سایر",
  Student: "شاگرد",
  Teacher: "مدرس",
  Admin: "ادمین",
  "vs last snapshot": "نسبت به آخرین وضعیت",
  "System overview": "نمای کلی سیستم",
  "No data available.": "داده‌ای موجود نیست.",
  Course: "کورس",
  Market: "بازار",
  Revenue: "درآمد",
  "Platform share": "سهم سیستم",
  "Paid at": "تاریخ پرداخت",
  Afghanistan: "افغانستان",
  Iran: "ایران",
  International: "بین‌المللی",
  Bank: "بانک",
  "Visa / MasterCard": "ویزا / مسترکارت",
  "Crypto Gateway": "درگاه کریپتو",
  USDT: "USDT",
};

const translateDashboardText = (text, language) => {
  if (language !== "fa") return text;
  return DASHBOARD_TEXT[text] || text;
};

const formatNumberByLanguage = (value, language = "en") =>
  new Intl.NumberFormat(language === "fa" ? "fa-AF" : "en-US").format(value || 0);

const formatDashboardDate = (date = new Date(), language = "en") => {
  try {
    if (language === "fa") {
      const formatter = new Intl.DateTimeFormat("fa-AF-u-ca-persian", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const parts = formatter.formatToParts(date);
      const lookup = (type) => parts.find((part) => part.type === type)?.value || "";
      const year = lookup("year");
      const month = lookup("month");
      const day = lookup("day");
      const weekday = lookup("weekday");
      return `${year} ${month} ${day}, ${weekday}`.trim();
    }
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return "";
  }
};

const ADMIN_DASHBOARD_CACHE_KEY = getAdminPageCacheKey("dashboard");
const ADMIN_DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

export default function AdminDashboardPage() {
  const { t, tr, language, isRTL } = useAdminI18n();
  const pageTr = useCallback(
    (text) => translateDashboardText(tr(text), language),
    [language, tr],
  );
  const [stats, setStats] = useState(INITIAL_STATS);
  const [monthlyIncome, setMonthlyIncome] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const dashboardRequest = useLatestRequest();
  const lastDashboardRequestKeyRef = useRef("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      const cached = readAdminPageCache(ADMIN_DASHBOARD_CACHE_KEY, {
        maxAgeMs: ADMIN_DASHBOARD_CACHE_TTL_MS,
      });
      if (cached) {
        setStats(cached.stats || INITIAL_STATS);
        setMonthlyIncome(Array.isArray(cached.monthlyIncome) ? cached.monthlyIncome : []);
        setRecentPayments(Array.isArray(cached.recentPayments) ? cached.recentPayments : []);
        setIsLoading(false);
        setErrorMessage("");
        return;
      } else {
        setIsLoading(true);
        setErrorMessage("");
      }

      const requestKey = `admin-dashboard:${language}`;
      if (lastDashboardRequestKeyRef.current === requestKey) {
        return;
      }
      lastDashboardRequestKeyRef.current = requestKey;

      await dashboardRequest.runLatest(async () => {
        const apiUrl = getApiBase();
        const response = await fetch(`${apiUrl}/admin/dashboard`, {
          headers: buildAuthHeaders(),
        });

        return parseJsonResponse(response);
      }, {
        onSuccess: (data) => {
          if (!data) return;
          const nextStats = {
            totalUsers: Number(data?.stats?.totalUsers) || 0,
            totalStudents: Number(data?.stats?.totalStudents) || 0,
            totalTeachers: Number(data?.stats?.totalTeachers) || 0,
            totalAdmins: Number(data?.stats?.totalAdmins) || 0,
            activeStudents: Number(data?.stats?.activeStudents) || 0,
            pendingStudents: Number(data?.stats?.pendingStudents) || 0,
            pendingUsers: Number(data?.stats?.pendingUsers) || 0,
            verifiedUsers: Number(data?.stats?.verifiedUsers) || 0,
            unverifiedUsers: Number(data?.stats?.unverifiedUsers) || 0,
            blockedUsers: Number(data?.stats?.blockedUsers) || 0,
            commissionRate: Number(data?.stats?.commissionRate) || 0,
          };
          const nextMonthlyIncome = Array.isArray(data?.monthlyIncome) ? data.monthlyIncome : [];
          const nextRecentPayments = Array.isArray(data?.recentPayments) ? data.recentPayments : [];
          setStats(nextStats);
          setMonthlyIncome(nextMonthlyIncome);
          setRecentPayments(nextRecentPayments);
          writeAdminPageCache(ADMIN_DASHBOARD_CACHE_KEY, {
            stats: nextStats,
            monthlyIncome: nextMonthlyIncome,
            recentPayments: nextRecentPayments,
          });
        },
        onError: (error) => {
          console.error("Error fetching admin dashboard data:", error);
          setErrorMessage(error.message || pageTr("No data available."));
        },
        onFinally: () => {
          setIsLoading(false);
        },
      });
    };

    fetchDashboardData();
  }, [dashboardRequest, language, pageTr]);

  const lineData = useMemo(
    () => [
      { name: pageTr("Active students"), users: stats.activeStudents },
      { name: pageTr("Teachers"), users: stats.totalTeachers },
    ],
    [stats, pageTr],
  );

  const donutData = useMemo(() => {
    const safeTotalUsers = Math.max(1, Number(stats.totalStudents || 0) + Number(stats.totalTeachers || 0));

    return [
      {
        name: pageTr("Students"),
        value: Math.round((stats.totalStudents / safeTotalUsers) * 100),
        color: "#3b82f6",
      },
      {
        name: pageTr("Teachers"),
        value: Math.round((stats.totalTeachers / safeTotalUsers) * 100),
        color: "#8b5cf6",
      },
    ];
  }, [stats, pageTr]);

  const platformIncomeData = useMemo(
    () =>
      (monthlyIncome.length ? monthlyIncome : buildEmptyIncomeSeries()).map((item) => ({
        name: item?.label || item?.monthKey || "-",
        income: Number(item?.platformIncome || 0),
      })),
    [monthlyIncome],
  );

  const kpis = useMemo(
    () => [
      {
        title: pageTr("Total users"),
        value: formatNumberByLanguage(stats.totalUsers, language),
        icon: Users,
        color: "text-blue-600",
        bg: "bg-blue-50",
      },
      {
        title: pageTr("Active students"),
        value: formatNumberByLanguage(stats.activeStudents, language),
        icon: GraduationCap,
        color: "text-violet-600",
        bg: "bg-violet-50",
      },
      {
        title: pageTr("Teachers"),
        value: formatNumberByLanguage(stats.totalTeachers, language),
        icon: UserCheck,
        color: "text-cyan-600",
        bg: "bg-cyan-50",
      },
      {
        title: pageTr("Admins"),
        value: formatNumberByLanguage(stats.totalAdmins, language),
        icon: ShieldCheck,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
      },
      {
        title: pageTr("Blocked users"),
        value: formatNumberByLanguage(stats.blockedUsers, language),
        icon: UserX,
        color: "text-rose-600",
        bg: "bg-rose-50",
      },
    ],
    [stats, pageTr, language],
  );

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className={`space-y-6 ${isRTL ? "text-right" : "text-left"}`}>
      {/* Welcome Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">
            {pageTr("Welcome back, Admin")}
          </h1>
          <p className="mt-2 text-sm font-normal text-slate-500">
            {pageTr("Manage the EduTech platform, monitor user growth, and review system health from one place.")}
          </p>
        </div>
        <div className="inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-3 shadow-sm border border-slate-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <CalendarDays size={20} />
          </div>
          <span className="text-sm font-bold text-slate-800">{formatDashboardDate(new Date(), language)}</span>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
          {errorMessage}
        </div>
      ) : null}

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${kpi.bg} ${kpi.color}`}
            >
              <kpi.icon size={24} />
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-bold text-slate-500">{kpi.title}</h3>
              <p className="mt-1 text-2xl font-extrabold text-slate-800">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Line Chart */}
        <div className="lg:col-span-2 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-slate-800">{pageTr("Platform growth")}</h3>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreHorizontal size={20} />
            </button>
          </div>
          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                    fontWeight: "bold",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#8b5cf6"
                  strokeWidth={4}
                  dot={{
                    r: 4,
                    fill: "#8b5cf6",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart */}
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-6 text-lg font-extrabold text-slate-800">{pageTr("Distribution")}</h3>
          <div className="h-56 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                    fontWeight: "bold",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {donutData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs font-bold text-slate-600">
                  {item.name} ({formatNumberByLanguage(item.value, language)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800">{pageTr("Platform income")}</h3>
            <p className="mt-1 text-sm font-normal text-slate-500">
              {pageTr("Monthly platform commission from paid enrollments.")}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            {formatNumberByLanguage(stats.commissionRate, language)}%
          </div>
        </div>
        <div className="h-72 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={platformIncomeData}>
              <defs>
                <linearGradient id="platformIncomeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                dx={-10}
              />
              <Tooltip
                formatter={(value) => formatNumberByLanguage(value, language)}
                contentStyle={{
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  fontWeight: "bold",
                }}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#platformIncomeFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="text-lg font-extrabold text-slate-800">{pageTr("Latest paid payments")}</h3>
          <p className="mt-1 text-sm font-normal text-slate-500">
            {pageTr("Latest successful enrollments with payment method, market, and platform share.")}
          </p>
        </div>
        <div className="space-y-4">
          {isLoading ? (
            <AdminPageLoader
              label={t("common.loading")}
              minHeight="min-h-[160px]"
              className="border-0 bg-transparent p-0"
            />
          ) : recentPayments.length === 0 ? (
            <p className="text-sm font-medium text-slate-500">{t("common.noData")}</p>
          ) : (
            recentPayments.map((payment, idx) => (
              <div
                key={payment.id || idx}
                className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <p className="text-base font-extrabold text-slate-800">{payment.courseTitle || "-"}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                        {pageTr(payment.paymentMethod || "USDT")}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {pageTr(payment.market || "International")}
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                        {pageTr("Student")}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-700">{payment.studentName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                        {pageTr("Revenue")}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-700">
                        {formatNumberByLanguage(payment.baseRevenue, language)} {language === "fa" ? "دالر" : "USD"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                        {pageTr("Platform share")}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-700">
                        {formatNumberByLanguage(payment.platformIncome, language)} {language === "fa" ? "دالر" : "USD"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                        {pageTr("Paid at")}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-700">
                        {formatDashboardDate(payment.paidAt ? new Date(payment.paidAt) : new Date(), language)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
