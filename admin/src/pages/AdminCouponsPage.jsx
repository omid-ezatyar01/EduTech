import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  Copy,
  Percent,
  Search,
  Tag,
  Ticket,
  Wallet,
} from "lucide-react";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";

const COUPON_ROWS = [];

const statusMeta = {
  active: { label: "Active", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  inactive: { label: "Inactive", className: "border-slate-200 bg-slate-100 text-slate-700" },
  used_up: { label: "Used up", className: "border-amber-200 bg-amber-50 text-amber-700" },
  expired: { label: "Expired", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const formatDiscount = (coupon) =>
  coupon.type === "percent" ? `${coupon.discountValue}%` : `$${coupon.discountValue}`;

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

export default function AdminCouponsPage() {
  const { t } = useAdminI18n();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [copiedCode, setCopiedCode] = useState("");

  const filteredCoupons = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return COUPON_ROWS.filter((coupon) => {
      const matchesQuery =
        !normalizedQuery ||
        [coupon.code, coupon.title].some((value) =>
          String(value || "").toLowerCase().includes(normalizedQuery),
        );
      const matchesStatus = statusFilter === "all" || coupon.status === statusFilter;
      const matchesType = typeFilter === "all" || coupon.type === typeFilter;
      return matchesQuery && matchesStatus && matchesType;
    });
  }, [query, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    return filteredCoupons.reduce(
      (acc, coupon) => {
        acc.total += 1;
        acc.totalUsage += Number(coupon.usage || 0);
        if (coupon.status === "active") acc.active += 1;
        if (coupon.status === "used_up") acc.usedUp += 1;
        if (coupon.type === "percent") acc.percent += 1;
        return acc;
      },
      { total: 0, active: 0, usedUp: 0, percent: 0, totalUsage: 0 },
    );
  }, [filteredCoupons]);

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(""), 1800);
    } catch {
      setCopiedCode("");
    }
  };

  return (
    <section className="space-y-6" dir="ltr">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 via-[#2459c7] to-[#38bdf8] p-6 text-slate-50 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-slate-100/85">Admin Coupons</p>
        <h1 className="mt-3 text-3xl font-extrabold text-white">{t("pages.coupons.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm font-normal leading-7 text-slate-100/85">
          Review coupon inventory, usage pressure, and active discount campaigns in one place.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Ticket} title="Coupons" value={stats.total} note="Visible in current filter" tone="bg-blue-50 text-blue-700" />
        <StatCard icon={BadgeCheck} title="Active" value={stats.active} note="Ready to use now" tone="bg-emerald-50 text-emerald-700" />
        <StatCard icon={Percent} title="Percent-based" value={stats.percent} note="Percentage discount campaigns" tone="bg-violet-50 text-violet-700" />
        <StatCard icon={Wallet} title="Redemptions" value={stats.totalUsage} note="Total recorded coupon uses" tone="bg-amber-50 text-amber-700" />
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_220px_220px]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search code or campaign title..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 focus:bg-white"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="used_up">Used up</option>
            <option value="expired">Expired</option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="all">All types</option>
            <option value="percent">Percent</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-extrabold text-slate-800">Coupon campaigns</h2>
          <p className="mt-1 text-sm font-normal text-slate-500">Real coupon data will appear here when coupon APIs are connected.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Coupon</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Type</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Discount</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Usage</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Expires</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No coupons matched the selected filters.
                  </td>
                </tr>
              ) : (
                filteredCoupons.map((coupon) => {
                  const usagePercent = Math.min((coupon.usage / coupon.limit) * 100, 100);
                  const meta = statusMeta[coupon.status] || statusMeta.inactive;
                  return (
                    <tr key={coupon.code} className="hover:bg-slate-50/70">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                            <Tag size={18} />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-extrabold text-slate-800">{coupon.code}</p>
                              <button
                                type="button"
                                onClick={() => handleCopy(coupon.code)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-emerald-200 hover:text-emerald-700"
                              >
                                <Copy size={14} />
                              </button>
                              {copiedCode === coupon.code ? (
                                <span className="text-xs font-bold text-emerald-700">Copied</span>
                              ) : null}
                            </div>
                            <p className="text-xs font-medium text-slate-500">{coupon.title}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-700">
                        {coupon.type === "percent" ? "Percent" : "Fixed amount"}
                      </td>
                      <td className="px-4 py-4 font-extrabold text-slate-800">{formatDiscount(coupon)}</td>
                      <td className="px-4 py-4">
                        <p className="font-extrabold text-slate-800">
                          {coupon.usage} / {coupon.limit}
                        </p>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${usagePercent >= 100 ? "bg-rose-500" : "bg-emerald-500"}`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <CalendarClock size={14} />
                          <span className="font-medium">{formatDate(coupon.expiresAt)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
