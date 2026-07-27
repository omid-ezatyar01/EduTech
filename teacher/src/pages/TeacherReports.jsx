import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  DollarSign,
  GraduationCap,
  MessageCircleMore,
  Users,
} from "lucide-react";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPageLoader from "../components/common/TeacherPageLoader";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import useLiveDataRefresh from "../hooks/useLiveDataRefresh";
import {
  getTeacherPageCacheKey,
  readTeacherPageCache,
  writeTeacherPageCache,
} from "../utils/teacherPageCache";
import { fetchTeacherCourses } from "../../services/courseService";
import {
  fetchTeacherDashboard,
  fetchTeacherEarningsSummary,
  fetchTeacherStudents,
} from "../../services/teacherPortalService";
import { fetchTeacherMessageConversations } from "../../services/messageService";
import { getAuthUser } from "../../services/portal";
import { formatUsdToLocalCalculation } from "../utils/currencyDisplay";

const formatUsd = (value, language = "fa") => {
  const amount = Number(value || 0);
  const amountLabel = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${amountLabel} ${language === "fa" ? "دالر" : "USD"}`;
};

const formatDateTime = (value, language = "fa") => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(language === "fa" ? "fa-AF" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const REPORT_CACHE_KEY = getTeacherPageCacheKey("reports");

const DEFAULT_REPORT = {
  dashboard: {
    stats: {
      activeCourses: 0,
      activeStudents: 0,
      pendingAssignments: 0,
      monthIncome: 0,
    },
  },
  students: {
    stats: {
      totalStudents: 0,
      activeStudents: 0,
      followupStudents: 0,
      averageAttendance: 0,
    },
  },
  courses: [],
  coursesMeta: { total: 0 },
  messages: {
    stats: {
      totalConversations: 0,
      unreadConversations: 0,
      totalUnreadMessages: 0,
    },
  },
  earnings: {
    commissionRate: 15,
    totalRevenue: 0,
    platformCommission: 0,
    teacherEarnings: 0,
    paymentsCount: 0,
    courseWise: [],
    recentPayments: [],
  },
  updatedAt: null,
};

export default function TeacherReports() {
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const cachedReport = readTeacherPageCache(REPORT_CACHE_KEY);
  const [loading, setLoading] = useState(!cachedReport);
  const [error, setError] = useState("");
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [report, setReport] = useState(cachedReport || DEFAULT_REPORT);

  const teacher = useMemo(() => {
    const user = getAuthUser();
    return user || { name: "Teacher", email: "teacher@edutech.study", role: "teacher" };
  }, []);

  useLiveDataRefresh(() => setRefreshSeed((prev) => prev + 1), {
    intervalMs: 0,
    refreshOnFocus: false,
    refreshOnVisible: false,
  });

  useEffect(() => {
    let isMounted = true;

    const loadReports = async () => {
      const cached = readTeacherPageCache(REPORT_CACHE_KEY);
      if (cached) {
        setReport(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        setError("");

        const [dashboard, students, coursesPayload, messagePayload, earningsPayload] = await Promise.all([
          fetchTeacherDashboard(),
          fetchTeacherStudents({ page: 1, limit: 200 }),
          fetchTeacherCourses({ page: 1, limit: 100 }),
          // Messaging can be disabled platform-wide. Reports must still load the
          // independent course, student, and earnings data in that case.
          fetchTeacherMessageConversations({ page: 1, limit: 5 }).catch(() => DEFAULT_REPORT.messages),
          fetchTeacherEarningsSummary(),
        ]);

        if (!isMounted) return;

        const nextReport = {
          dashboard: dashboard || {},
          students: students || {},
          courses: Array.isArray(coursesPayload?.courses) ? coursesPayload.courses : [],
          coursesMeta: coursesPayload?.meta || { total: 0 },
          messages: messagePayload || {},
          earnings: {
            commissionRate: Number(earningsPayload?.commissionRate || 15),
            totalRevenue: Number(earningsPayload?.totalRevenue || 0),
            platformCommission: Number(earningsPayload?.platformCommission || 0),
            teacherEarnings: Number(earningsPayload?.teacherEarnings || 0),
            paymentsCount: Number(earningsPayload?.paymentsCount || 0),
            courseWise: Array.isArray(earningsPayload?.courseWise) ? earningsPayload.courseWise : [],
            recentPayments: Array.isArray(earningsPayload?.recentPayments)
              ? earningsPayload.recentPayments
              : [],
          },
          updatedAt: new Date().toISOString(),
        };

        setReport(nextReport);
        writeTeacherPageCache(REPORT_CACHE_KEY, nextReport);
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load reports.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadReports();

    return () => {
      isMounted = false;
    };
  }, [refreshSeed]);

  const courseRows = useMemo(() => {
    return [...report.courses]
      .sort((a, b) => Number(b.enrolledStudentsCount || 0) - Number(a.enrolledStudentsCount || 0))
      .slice(0, 8)
      .map((course) => {
        const studentsCount = Number(course.enrolledStudentsCount || 0);
        const maxStudents = Number(course.maxStudents || 0);
        const occupancy = maxStudents > 0 ? Math.round((studentsCount / maxStudents) * 100) : 0;
        return {
          id: String(course._id || course.id || ""),
          title: String(course.title || ""),
          studentsCount,
          maxStudents,
          occupancy: Math.max(0, Math.min(100, occupancy)),
          status: String(course.status || "draft"),
        };
      });
  }, [report.courses]);

  const courseStatusStats = useMemo(() => {
    const summary = {
      published: 0,
      pending: 0,
      draft: 0,
      rejected: 0,
    };

    report.courses.forEach((course) => {
      const status = String(course.status || "").toLowerCase();
      if (status === "published" || status === "approved") summary.published += 1;
      else if (status === "pending") summary.pending += 1;
      else if (status === "rejected") summary.rejected += 1;
      else summary.draft += 1;
    });

    return summary;
  }, [report.courses]);

  const cards = [
    {
      key: "courses",
      icon: BookOpen,
      labelFa: "مجموع کورس‌ها",
      labelEn: "Total Courses",
      value: Number(report.coursesMeta?.total || report.courses.length),
      tone: "text-[#0B4FD8] bg-[#0B4FD8]/10",
    },
    {
      key: "students",
      icon: Users,
      labelFa: "شاگردان فعال",
      labelEn: "Active Students",
      value: Number(report.students?.stats?.activeStudents || 0),
      tone: "text-[#00B8A9] bg-[#00B8A9]/10",
    },
    {
      key: "income",
      icon: DollarSign,
      labelFa: "درآمد خالص",
      labelEn: "Net Earnings",
      value: formatUsd(report.earnings.teacherEarnings, language),
      tone: "text-[#0F766E] bg-[#0F766E]/10",
    },
    {
      key: "unread",
      icon: MessageCircleMore,
      labelFa: "پیام‌های خوانده‌نشده",
      labelEn: "Unread Messages",
      value: Number(report.messages?.stats?.totalUnreadMessages || 0),
      tone: "text-[#7C3AED] bg-[#7C3AED]/10",
    },
  ];

  return (
    <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
      <section className={`space-y-5 ${isRTL ? "text-right" : "text-left"}`}>
        <header className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 size={22} className="text-[#0B4FD8]" />
            <h1 className="text-2xl font-black text-slate-900">
              {language === "fa" ? "گزارش‌های مدرس" : "Teacher Reports"}
            </h1>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {language === "fa"
              ? "نمای کلی عملکرد کورس‌ها، شاگردان، پیام‌ها و درآمد شما در یک صفحه."
              : "A single-page summary of your courses, students, messages, and earnings."}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {language === "fa" ? "آخرین بروزرسانی:" : "Last updated:"}{" "}
            {formatDateTime(report.updatedAt, language)}
          </p>
        </header>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <TeacherPageLoader label={language === "fa" ? "درحال دریافت گزارش" : "Loading reports"} />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cards.map((item) => (
                <article key={item.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}>
                    <item.icon size={18} />
                  </div>
                  <p className="text-xs font-semibold text-slate-500">
                    {language === "fa" ? item.labelFa : item.labelEn}
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-900">{item.value}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-black text-slate-900">
                  {language === "fa" ? "عملکرد کورس‌ها (بر اساس ثبت‌نام)" : "Course Performance (by enrollment)"}
                </h2>
                <div className="mt-4 space-y-3">
                  {courseRows.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      {language === "fa" ? "هنوز کورسی برای گزارش موجود نیست." : "No courses available yet."}
                    </p>
                  ) : (
                    courseRows.map((course) => (
                      <div key={course.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="line-clamp-1 text-sm font-bold text-slate-900">{course.title}</p>
                          <p className="text-xs font-semibold text-slate-500">
                            {course.studentsCount}
                            {course.maxStudents > 0 ? ` / ${course.maxStudents}` : ""}
                          </p>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#0B4FD8] to-[#00B8A9]"
                            style={{ width: `${course.occupancy}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">
                          {language === "fa" ? "درصد تکمیل ظرفیت:" : "Seat occupancy:"} {course.occupancy}%
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-black text-slate-900">
                  {language === "fa" ? "وضعیت صنف و شاگرد" : "Class & Student Health"}
                </h2>
                <div className="mt-4 space-y-3">
                  <QuickMetric
                    icon={GraduationCap}
                    label={language === "fa" ? "کورس‌های منتشر شده" : "Published Courses"}
                    value={courseStatusStats.published}
                  />
                  <QuickMetric
                    icon={AlertCircle}
                    label={language === "fa" ? "شاگرد نیازمند پیگیری" : "Students Need Follow-up"}
                    value={Number(report.students?.stats?.followupStudents || 0)}
                  />
                  <QuickMetric
                    icon={Users}
                    label={language === "fa" ? "میانگین حضور شاگردان" : "Average Attendance"}
                    value={`${Number(report.students?.stats?.averageAttendance || 0)}%`}
                  />
                  <QuickMetric
                    icon={MessageCircleMore}
                    label={language === "fa" ? "گفتگوهای خوانده‌نشده" : "Unread Conversations"}
                    value={Number(report.messages?.stats?.unreadConversations || 0)}
                  />
                </div>
              </article>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-black text-slate-900">
                  {language === "fa" ? "خلاصه درآمد" : "Earnings Summary"}
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SummaryItem
                    label={language === "fa" ? "کل فروش" : "Total Revenue"}
                    value={formatUsd(report.earnings.totalRevenue, language)}
                  />
                  <SummaryItem
                    label={
                      language === "fa"
                        ? `سهم سیستم (${report.earnings.commissionRate}%)`
                        : `Platform Cut (${report.earnings.commissionRate}%)`
                    }
                    value={formatUsd(report.earnings.platformCommission, language)}
                  />
                  <SummaryItem
                    label={language === "fa" ? "سهم شما" : "Your Earnings"}
                    value={formatUsd(report.earnings.teacherEarnings, language)}
                  />
                  <SummaryItem
                    label={language === "fa" ? "پرداخت موفق" : "Successful Payments"}
                    value={String(report.earnings.paymentsCount)}
                  />
                </div>
                {Array.isArray(report.earnings.recentPayments) &&
                report.earnings.recentPayments.length > 0 ? (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                      {language === "fa"
                        ? "محاسبات دقیق قیمت منطقه‌ای"
                        : "Exact regional price calculations"}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      {language === "fa"
                        ? "بر اساس نرخ ذخیره‌شده در روز هر پرداخت"
                        : "Using the rate saved on each payment day"}
                    </p>
                    <div className="mt-3 space-y-2">
                      {report.earnings.recentPayments.slice(0, 5).map((payment) => (
                        <div
                          key={payment.paymentId || `${payment.courseTitle}-${payment.paidAt}`}
                          className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-1 text-xs font-bold text-slate-700">
                              {payment.courseTitle || "-"}
                            </p>
                            <span className="shrink-0 text-[10px] font-bold text-slate-400">
                              {payment.regionLabel || ""}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] font-black text-[#0B4FD8]" dir="ltr">
                            {formatUsdToLocalCalculation(payment, "en") ||
                              formatUsd(payment.baseRevenue, "en")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-black text-slate-900">
                  {language === "fa" ? "وضعیت کورس‌ها" : "Course Status Breakdown"}
                </h2>
                <div className="mt-4 space-y-3">
                  <StatusRow
                    label={language === "fa" ? "منتشر شده" : "Published"}
                    count={courseStatusStats.published}
                    color="bg-emerald-500"
                    total={Math.max(1, report.courses.length)}
                  />
                  <StatusRow
                    label={language === "fa" ? "در انتظار" : "Pending"}
                    count={courseStatusStats.pending}
                    color="bg-amber-500"
                    total={Math.max(1, report.courses.length)}
                  />
                  <StatusRow
                    label={language === "fa" ? "پیش‌نویس" : "Draft"}
                    count={courseStatusStats.draft}
                    color="bg-slate-500"
                    total={Math.max(1, report.courses.length)}
                  />
                  <StatusRow
                    label={language === "fa" ? "رد شده" : "Rejected"}
                    count={courseStatusStats.rejected}
                    color="bg-rose-500"
                    total={Math.max(1, report.courses.length)}
                  />
                </div>
              </article>
            </section>
          </>
        )}
      </section>
    </TeacherLayout>
  );
}

function QuickMetric({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#0B4FD8]">
        <Icon size={16} />
      </span>
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="text-sm font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function StatusRow({ label, count, total, color }) {
  const percent = Math.max(0, Math.min(100, Math.round((Number(count || 0) / Number(total || 1)) * 100)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span>
          {count} ({percent}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
