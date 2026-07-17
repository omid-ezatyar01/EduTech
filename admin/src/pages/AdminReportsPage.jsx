import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Globe2,
  GraduationCap,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const monthlyRevenue = [];
const channelMix = [];
const countryMix = [];
const topCourses = [];

const reportPeriods = {
  "30d": {
    revenue: 0,
    students: 0,
    courses: 0,
    teachers: 0,
    conversion: "0%",
  },
  "90d": {
    revenue: 0,
    students: 0,
    courses: 0,
    teachers: 0,
    conversion: "0%",
  },
  "180d": {
    revenue: 0,
    students: 0,
    courses: 0,
    teachers: 0,
    conversion: "0%",
  },
};

const PAGE_TEXT = {
  "Reports overview": "نمای کلی گزارش‌ها",
  "Review revenue signals, payment behavior, course performance, and market distribution from one analytics workspace.":
    "سیگنال‌های درآمد، رفتار پرداخت، عملکرد کورس‌ها و توزیع بازار را از یک فضای کاری تحلیلی واحد بررسی کنید.",
  "Last 30 days": "۳۰ روز گذشته",
  "Last 90 days": "۹۰ روز گذشته",
  "Last 180 days": "۱۸۰ روز گذشته",
  Revenue: "درآمد",
  Enrollments: "ثبت‌نام‌ها",
  Courses: "کورس‌ها",
  Teachers: "مدرسان",
  Conversion: "تبدیل",
  "Base USD turnover": "گردش مالی پایه به دلار",
  "Paid student enrollments": "ثبت‌نام‌های پرداخت‌شده شاگردان",
  "Courses contributing to revenue": "کورس‌های موثر در درآمد",
  "Teachers with active sales": "مدرسان دارای فروش فعال",
  "Estimated checkout conversion": "نرخ تقریبی تبدیل در پرداخت",
  "Revenue trend": "روند درآمد",
  "Monthly revenue and enrollment movement.": "روند ماهانه درآمد و حرکت ثبت‌نام‌ها.",
  "No revenue report data yet.": "هنوز داده‌ای برای گزارش درآمد وجود ندارد.",
  "Payment channel mix": "ترکیب کانال‌های پرداخت",
  "Share of successful payments by method.": "سهم پرداخت‌های موفق بر اساس روش پرداخت.",
  "No payment channel data yet.": "هنوز داده‌ای برای کانال‌های پرداخت وجود ندارد.",
  "No payment channel records yet.": "هنوز رکوردی برای کانال‌های پرداخت وجود ندارد.",
  "Top earning courses": "کورس‌های با بیشترین درآمد",
  "Courses contributing the most revenue in the selected period.":
    "کورس‌هایی که در بازه انتخاب‌شده بیشترین سهم درآمد را داشته‌اند.",
  "paid students": "شاگرد پرداخت‌کننده",
  "No course revenue data yet.": "هنوز داده‌ای برای درآمد کورس‌ها وجود ندارد.",
  "Market breakdown": "تفکیک بازار",
  "Where paying users are coming from.": "کاربران پرداخت‌کننده از چه بازارهایی می‌آیند.",
  "No country breakdown data yet.": "هنوز داده‌ای برای تفکیک کشورها وجود ندارد.",
  "Best performing payment channel": "بهترین کانال پرداخت",
  "No data yet": "هنوز داده‌ای موجود نیست",
  "of successful payments in this report snapshot.": "از پرداخت‌های موفق در این نمای گزارش.",
  "This card will update automatically when real payment-channel data is available.":
    "این کارت زمانی که داده واقعی کانال‌های پرداخت در دسترس باشد، خودکار به‌روزرسانی می‌شود.",
};

const translateText = (text, language) => {
  if (language !== "fa") return text;
  return PAGE_TEXT[text] || text;
};

const formatNumber = (value, language = "en") =>
  new Intl.NumberFormat(language === "fa" ? "fa-AF" : "en-US").format(Number(value || 0));

function StatCard({ icon: Icon, title, value, note, tone }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
        <Icon size={22} />
      </div>
      <p className="mt-4 text-sm font-bold text-slate-700">{title}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-800">{value}</p>
      <p className="mt-2 text-sm font-normal text-slate-600">{note}</p>
    </article>
  );
}

function EmptyState({ label }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm font-medium text-slate-500">
      {label}
    </div>
  );
}

export default function AdminReportsPage() {
  const { t, language, isRTL } = useAdminI18n();
  const pageTr = (text) => translateText(t(text), language);
  const [period, setPeriod] = useState("90d");
  const summary = reportPeriods[period] || reportPeriods["90d"];

  const highestChannel = useMemo(
    () => [...channelMix].sort((left, right) => right.value - left.value)[0] || null,
    [],
  );

  const statsCards = [
    {
      title: pageTr("Revenue"),
      value: `$${formatNumber(summary.revenue, "en")}`,
      note: pageTr("Base USD turnover"),
      icon: Wallet,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      title: pageTr("Enrollments"),
      value: formatNumber(summary.students, language),
      note: pageTr("Paid student enrollments"),
      icon: GraduationCap,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      title: pageTr("Courses"),
      value: formatNumber(summary.courses, language),
      note: pageTr("Courses contributing to revenue"),
      icon: BookOpen,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      title: pageTr("Teachers"),
      value: formatNumber(summary.teachers, language),
      note: pageTr("Teachers with active sales"),
      icon: Users,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      title: pageTr("Conversion"),
      value: summary.conversion,
      note: pageTr("Estimated checkout conversion"),
      icon: TrendingUp,
      tone: "bg-rose-50 text-rose-700",
    },
  ];

  return (
    <section
      dir={isRTL ? "rtl" : "ltr"}
      className={`w-full max-w-full overflow-x-hidden space-y-6 ${isRTL ? "text-right" : "text-left"}`}
    >
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-600">
              {pageTr("Reports overview")}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-800">{t("pages.reports.title")}</h1>
            <p className="mt-2 max-w-3xl text-sm font-normal leading-7 text-slate-600">
              {pageTr("Review revenue signals, payment behavior, course performance, and market distribution from one analytics workspace.")}
            </p>
          </div>

          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
          >
            <option value="30d">{pageTr("Last 30 days")}</option>
            <option value="90d">{pageTr("Last 90 days")}</option>
            <option value="180d">{pageTr("Last 180 days")}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statsCards.map((card) => (
          <StatCard
            key={card.title}
            icon={card.icon}
            title={card.title}
            value={card.value}
            note={card.note}
            tone={card.tone}
          />
        ))}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <BarChart3 size={18} />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">{pageTr("Revenue trend")}</h2>
              <p className="text-sm font-normal text-slate-500">
                {pageTr("Monthly revenue and enrollment movement.")}
              </p>
            </div>
          </div>

          <div className="mt-5 h-[320px]">
            {monthlyRevenue.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyRevenue}>
                  <defs>
                    <linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2563eb"
                    fill="url(#reportRevenue)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label={pageTr("No revenue report data yet.")} />
            )}
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Activity size={18} />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">{pageTr("Payment channel mix")}</h2>
              <p className="text-sm font-normal text-slate-500">
                {pageTr("Share of successful payments by method.")}
              </p>
            </div>
          </div>

          <div className="mt-5 h-[240px]">
            {channelMix.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={channelMix} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={4}>
                    {channelMix.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label={pageTr("No payment channel data yet.")} />
            )}
          </div>

          <div className="space-y-3">
            {channelMix.length ? (
              channelMix.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-bold text-slate-800">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-500">{item.value}%</span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-500">
                {pageTr("No payment channel records yet.")}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <BookOpen size={18} />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">{pageTr("Top earning courses")}</h2>
              <p className="text-sm font-normal text-slate-500">
                {pageTr("Courses contributing the most revenue in the selected period.")}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {topCourses.length ? (
              topCourses.map((course, index) => (
                <div key={course.title} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">
                        {formatNumber(index + 1, language)}. {course.title}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {formatNumber(course.students, language)} {pageTr("paid students")}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-extrabold text-slate-800">
                      ${formatNumber(course.revenue, "en")}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-medium text-slate-500">
                {pageTr("No course revenue data yet.")}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Globe2 size={18} />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">{pageTr("Market breakdown")}</h2>
              <p className="text-sm font-normal text-slate-500">
                {pageTr("Where paying users are coming from.")}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {countryMix.length ? (
              countryMix.map((item) => (
                <div key={item.name}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">{item.name}</p>
                    <p className="text-sm font-bold text-slate-500">{item.value}%</p>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-medium text-slate-500">
                {pageTr("No country breakdown data yet.")}
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
            <p className="text-sm font-bold text-blue-900">{pageTr("Best performing payment channel")}</p>
            <p className="mt-1 text-lg font-extrabold text-blue-950">
              {highestChannel?.name || pageTr("No data yet")}
            </p>
            <p className="mt-1 text-sm font-normal text-blue-700">
              {highestChannel
                ? `${highestChannel.value}% ${pageTr("of successful payments in this report snapshot.")}`
                : pageTr("This card will update automatically when real payment-channel data is available.")}
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
