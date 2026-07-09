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

function StatCard({ icon: Icon, title, value, note, tone }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
        <Icon size={20} />
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-800">{value}</p>
      <p className="mt-2 text-sm font-normal text-slate-600">{note}</p>
    </article>
  );
}

export default function AdminReportsPage() {
  const { t } = useAdminI18n();
  const [period, setPeriod] = useState("90d");
  const summary = reportPeriods[period] || reportPeriods["90d"];

  const highestChannel = useMemo(() => {
    return [...channelMix].sort((left, right) => right.value - left.value)[0] || null;
  }, []);

  return (
    <section className="space-y-6" dir="ltr">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 via-[#2459c7] to-[#38bdf8] p-6 text-slate-50 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-slate-100/85">Admin Reports</p>
            <h1 className="mt-3 text-3xl font-extrabold text-white">{t("pages.reports.title")}</h1>
            <p className="mt-2 max-w-2xl text-sm font-normal leading-7 text-slate-100/85">
              A clearer high-level report for revenue, enrollments, payment channels, and market mix.
            </p>
          </div>

          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="h-12 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-slate-50 outline-none"
          >
            <option value="30d" className="text-slate-900">Last 30 days</option>
            <option value="90d" className="text-slate-900">Last 90 days</option>
            <option value="180d" className="text-slate-900">Last 180 days</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Wallet} title="Revenue" value={`$${summary.revenue.toLocaleString("en-US")}`} note="Base USD turnover" tone="bg-blue-50 text-blue-700" />
        <StatCard icon={GraduationCap} title="Enrollments" value={summary.students} note="Paid student enrollments" tone="bg-emerald-50 text-emerald-700" />
        <StatCard icon={BookOpen} title="Courses" value={summary.courses} note="Courses contributing to revenue" tone="bg-violet-50 text-violet-700" />
        <StatCard icon={Users} title="Teachers" value={summary.teachers} note="Teachers with active sales" tone="bg-amber-50 text-amber-700" />
        <StatCard icon={TrendingUp} title="Conversion" value={summary.conversion} note="Estimated checkout conversion" tone="bg-rose-50 text-rose-700" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <BarChart3 size={18} />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Revenue trend</h2>
              <p className="text-sm font-normal text-slate-500">Monthly revenue and enrollment movement.</p>
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
                  <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#reportRevenue)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
                No revenue report data yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Activity size={18} />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Payment channel mix</h2>
              <p className="text-sm font-normal text-slate-500">Share of successful payments by method.</p>
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
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
                No payment channel data yet.
              </div>
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
                No payment channel records yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <BookOpen size={18} />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Top earning courses</h2>
              <p className="text-sm font-normal text-slate-500">Courses contributing the most revenue in the selected period.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {topCourses.length ? (
              topCourses.map((course, index) => (
                <div key={course.title} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {index + 1}. {course.title}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500">{course.students} paid students</p>
                    </div>
                    <p className="text-sm font-extrabold text-slate-800">${course.revenue.toLocaleString("en-US")}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-medium text-slate-500">
                No course revenue data yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Globe2 size={18} />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Market breakdown</h2>
              <p className="text-sm font-normal text-slate-500">Where paying users are coming from.</p>
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
                No country breakdown data yet.
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
            <p className="text-sm font-bold text-blue-900">Best performing payment channel</p>
            <p className="mt-1 text-lg font-extrabold text-blue-950">{highestChannel?.name || "No data yet"}</p>
            <p className="mt-1 text-sm font-normal text-blue-700">
              {highestChannel
                ? `${highestChannel.value}% of successful payments in this report snapshot.`
                : "This card will update automatically when real payment-channel data is available."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
