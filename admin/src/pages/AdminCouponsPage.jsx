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

const PAGE_TEXT = {
  "Coupon operations": "عملیات کوپن‌ها",
  "Review coupon inventory, usage pressure, and active discount campaigns in one clear workspace.":
    "موجودی کوپن‌ها، فشار مصرف و کمپاین‌های تخفیف فعال را از یک فضای کاری روشن بررسی کنید.",
  Coupons: "کوپن‌ها",
  Active: "فعال",
  "Percent based": "درصدی",
  Redemptions: "استفاده‌ها",
  "Visible in current filter": "نمایش داده‌شده در فیلتر فعلی",
  "Ready to use now": "همین حالا قابل استفاده",
  "Percentage discount campaigns": "کمپاین‌های تخفیف درصدی",
  "Total recorded coupon uses": "مجموع استفاده‌های ثبت‌شده از کوپن",
  "Coupon directory": "فهرست کوپن‌ها",
  "Search by code or campaign title and review every coupon from one table.":
    "با کد کوپن یا عنوان کمپاین جستجو کنید و همه کوپن‌ها را از یک جدول بررسی نمایید.",
  "Search code or campaign title": "جستجوی کد کوپن یا عنوان کمپاین",
  "All statuses": "همه وضعیت‌ها",
  "All types": "همه نوع‌ها",
  Inactive: "غیرفعال",
  "Used up": "مصرف‌شده",
  Expired: "منقضی",
  Percent: "درصدی",
  "Fixed amount": "مبلغ ثابت",
  "Coupon campaigns": "کمپاین‌های کوپن",
  "Real coupon data will appear here when coupon APIs are connected.":
    "داده‌های واقعی کوپن پس از اتصال APIهای کوپن در اینجا نمایش داده می‌شود.",
  "No coupons matched the selected filters.": "هیچ کوپنی با فیلترهای انتخاب‌شده پیدا نشد.",
  Coupon: "کوپن",
  Type: "نوع",
  Discount: "تخفیف",
  Usage: "مصرف",
  Expires: "انقضا",
  Status: "وضعیت",
  Copied: "کاپی شد",
};

const translateText = (text, language) => {
  if (language !== "fa") return text;
  return PAGE_TEXT[text] || text;
};

const statusMeta = {
  active: { label: "Active", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  inactive: { label: "Inactive", className: "border-slate-200 bg-slate-100 text-slate-700" },
  used_up: { label: "Used up", className: "border-amber-200 bg-amber-50 text-amber-700" },
  expired: { label: "Expired", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const formatDate = (value, language = "en") => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(language === "fa" ? "fa-AF" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

const formatDiscount = (coupon) =>
  coupon.type === "percent" ? `${coupon.discountValue}%` : `$${coupon.discountValue}`;

export default function AdminCouponsPage() {
  const { t, language, isRTL } = useAdminI18n();
  const pageTr = useMemo(
    () => (text) => translateText(t(text), language),
    [language, t],
  );
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
        if (coupon.type === "percent") acc.percent += 1;
        return acc;
      },
      { total: 0, active: 0, percent: 0, totalUsage: 0 },
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

  const statsCards = [
    {
      title: pageTr("Coupons"),
      value: stats.total,
      note: pageTr("Visible in current filter"),
      icon: Ticket,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      title: pageTr("Active"),
      value: stats.active,
      note: pageTr("Ready to use now"),
      icon: BadgeCheck,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      title: pageTr("Percent based"),
      value: stats.percent,
      note: pageTr("Percentage discount campaigns"),
      icon: Percent,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      title: pageTr("Redemptions"),
      value: stats.totalUsage,
      note: pageTr("Total recorded coupon uses"),
      icon: Wallet,
      tone: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={`w-full max-w-full overflow-x-hidden space-y-6 ${isRTL ? "text-right" : "text-left"}`}
    >
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-600">{pageTr("Coupon operations")}</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-800">{t("pages.coupons.title")}</h1>
            <p className="mt-2 max-w-3xl text-sm font-normal leading-7 text-slate-600">
              {pageTr("Review coupon inventory, usage pressure, and active discount campaigns in one clear workspace.")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-nowrap gap-4">
        {statsCards.map((card) => (
          <article key={card.title} className="min-w-0 flex-1 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
              <card.icon size={22} />
            </div>
            <p className="mt-4 text-sm font-bold text-slate-700">{card.title}</p>
            <p className="mt-2 text-2xl font-extrabold text-slate-800">{card.value}</p>
            <p className="mt-2 text-sm font-normal text-slate-600">{card.note}</p>
          </article>
        ))}
      </div>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">{pageTr("Coupon directory")}</h2>
            <p className="mt-1 text-sm font-normal text-slate-600">
              {pageTr("Search by code or campaign title and review every coupon from one table.")}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px_220px]">
          <label className="relative block">
            <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-slate-400">
              <Search size={18} />
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={pageTr("Search code or campaign title")}
              className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-11 pe-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
          >
            <option value="all">{pageTr("All statuses")}</option>
            <option value="active">{pageTr("Active")}</option>
            <option value="inactive">{pageTr("Inactive")}</option>
            <option value="used_up">{pageTr("Used up")}</option>
            <option value="expired">{pageTr("Expired")}</option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
          >
            <option value="all">{pageTr("All types")}</option>
            <option value="percent">{pageTr("Percent")}</option>
            <option value="fixed">{pageTr("Fixed amount")}</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-extrabold text-slate-800">{pageTr("Coupon campaigns")}</h2>
          <p className="mt-1 text-sm font-normal text-slate-500">
            {pageTr("Real coupon data will appear here when coupon APIs are connected.")}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-700">
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Coupon")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Type")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Discount")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Usage")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Expires")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center font-bold text-slate-900">
                    {pageTr("No coupons matched the selected filters.")}
                  </td>
                </tr>
              ) : (
                filteredCoupons.map((coupon) => {
                  const usagePercent = Math.min((coupon.usage / coupon.limit) * 100, 100);
                  const meta = statusMeta[coupon.status] || statusMeta.inactive;

                  return (
                    <tr key={coupon.code} className="align-middle transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                            <Tag size={18} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-extrabold text-slate-800">{coupon.code}</p>
                              <button
                                type="button"
                                onClick={() => handleCopy(coupon.code)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-emerald-200 hover:text-emerald-700"
                              >
                                <Copy size={14} />
                              </button>
                              {copiedCode === coupon.code ? (
                                <span className="text-xs font-bold text-emerald-700">{pageTr("Copied")}</span>
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-xs font-medium text-slate-500">{coupon.title}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {coupon.type === "percent" ? pageTr("Percent") : pageTr("Fixed amount")}
                      </td>
                      <td className="px-5 py-4 font-extrabold text-slate-800">{formatDiscount(coupon)}</td>
                      <td className="px-5 py-4">
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
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <CalendarClock size={14} />
                          <span className="font-medium">{formatDate(coupon.expiresAt, language)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                          {pageTr(meta.label)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
