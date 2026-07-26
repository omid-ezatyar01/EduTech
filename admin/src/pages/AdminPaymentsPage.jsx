import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import useLatestRequest from "../hooks/useLatestRequest.js";
import {
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";
import { formatDisplayCurrencyAmount } from "../utils/currencyDisplay.js";

const ADMIN_PAYMENTS_CACHE_TTL_MS = 5 * 60 * 1000;
const PAGE_SIZE = 20;

const PAGE_TEXT = {
  "Payment operations": "عملیات پرداخت‌ها",
  "Track payment health, transaction outcomes, and total collected revenue from one clear workspace.":
    "وضعیت پرداخت‌ها، نتیجه تراکنش‌ها و مجموع درآمد جمع‌آوری‌شده را از یک فضای کاری روشن دنبال کنید.",
  "Total payments": "مجموع پرداخت‌ها",
  "Successful payments": "پرداخت‌های موفق",
  "Pending payments": "پرداخت‌های در انتظار",
  "Total revenue": "مجموع درآمد",
  "Payment directory": "فهرست پرداخت‌ها",
  "Search by reference, transaction ID, or student email and review every payment from one table.":
    "با مرجع پرداخت، شناسه تراکنش یا ایمیل شاگرد جستجو کنید و همه پرداخت‌ها را از یک جدول بررسی نمایید.",
  "Search reference, transaction ID, or email": "جستجوی مرجع، شناسه تراکنش یا ایمیل",
  "All statuses": "همه وضعیت‌ها",
  "Payment records matching the current filters.": "رکوردهای پرداخت مطابق با فیلترهای فعلی.",
  "Visible in current filter": "نمایش داده‌شده در فیلتر فعلی",
  "Payments with successful status": "پرداخت‌هایی با وضعیت موفق",
  "Payments awaiting completion": "پرداخت‌هایی که هنوز تکمیل نشده‌اند",
  "Revenue from paid payments only": "درآمد فقط از پرداخت‌های موفق",
  "Failed to load payments": "بارگذاری پرداخت‌ها ناموفق بود",
  "Loading payments": "در حال بارگذاری پرداخت‌ها",
  "No payments matched the current filters.": "هیچ پرداختی با فیلترهای فعلی پیدا نشد.",
  Student: "شاگرد",
  Course: "کورس",
  Amount: "مبلغ",
  Status: "وضعیت",
  Provider: "ارائه‌دهنده",
  Reference: "مرجع",
  "Transaction ID": "شناسه تراکنش",
  "Paid at": "زمان پرداخت",
  Refresh: "تازه‌سازی",
  Showing: "نمایش",
  to: "تا",
  of: "از",
  Previous: "قبلی",
  Next: "بعدی",
  Successful: "موفق",
  Pending: "در انتظار",
};

const translateText = (text, language) => {
  if (language !== "fa") return text;
  return PAGE_TEXT[text] || text;
};

const statusLabelMap = {
  pending: "Pending",
  paid: "Successful",
};

const statusClass = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const normalizePaymentStatus = (status = "") => {
  return status === "paid" ? "paid" : "pending";
};

const getAdminPaymentsCacheKey = ({ page, search, status }) =>
  getAdminPageCacheKey("payments", { page, search, status });

const formatAmount = (amount, language = "fa") => {
  const normalizedAmount = Number(amount || 0);
  const fractionDigits = Number.isInteger(normalizedAmount) ? 0 : 2;

  return new Intl.NumberFormat(language === "fa" ? "fa-AF" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(normalizedAmount);
};

const formatNumber = (value, language = "en") =>
  new Intl.NumberFormat(language === "fa" ? "fa-AF" : "en-US").format(Number(value || 0));

const formatDateTime = (value, language = "en") => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(language === "fa" ? "fa-AF" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getPaginationItems = (currentPage, totalPages) => {
  if (totalPages <= 1) return [1];
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 3) return [1, 2, 3, "...", totalPages];
  if (currentPage >= totalPages - 2) return [1, "...", totalPages - 2, totalPages - 1, totalPages];
  return [1, "...", currentPage, "...", totalPages];
};

export default function AdminPaymentsPage() {
  const { language, t, isRTL } = useAdminI18n();
  const pageTr = useMemo(
    () => (text) => translateText(t(text), language),
    [language, t],
  );
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    paidPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
    totalPayments: 0,
  });
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 1,
    totalPayments: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const paymentsRequest = useLatestRequest();

  useEffect(() => {
    const cacheKey = getAdminPaymentsCacheKey({
      page,
      search: debouncedSearch,
      status,
    });
    const cached = readAdminPageCache(cacheKey, { maxAgeMs: ADMIN_PAYMENTS_CACHE_TTL_MS });

    if (cached) {
      setPayments(Array.isArray(cached.payments) ? cached.payments : []);
      setSummary(cached.summary || {});
      setPagination(cached.pagination || { page: 1, limit: PAGE_SIZE, totalPages: 1, totalPayments: 0 });
      setLoading(false);
      setError("");
    } else {
      setLoading(true);
      setError("");
    }

    const run = async () => {
      await paymentsRequest.runLatest(async () => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (status) params.set("status", status);
        if (debouncedSearch) params.set("search", debouncedSearch);

        const response = await fetch(`${getApiBase()}/admin/payments?${params.toString()}`, {
          headers: buildAuthHeaders(),
        });

        const data = await parseJsonResponse(response);
        if (data?.success === false) {
          throw new Error(data?.message || pageTr("Failed to load payments"));
        }
        return data;
      }, {
        onSuccess: (data) => {
          const nextPayments = Array.isArray(data?.data?.payments) ? data.data.payments : [];
          const nextSummary = data?.data?.summary || {};
          const nextMeta = data?.meta || {};
          const nextPagination = {
            page: Number(nextMeta.page) || page,
            limit: Number(nextMeta.limit) || PAGE_SIZE,
            totalPages: Number(nextMeta.totalPages) || 1,
            totalPayments: Number(nextMeta.totalPayments || nextMeta.total || nextSummary.totalPayments || 0),
          };

          setPayments(nextPayments);
          setSummary(nextSummary);
          setPagination(nextPagination);
          writeAdminPageCache(cacheKey, {
            payments: nextPayments,
            summary: nextSummary,
            pagination: nextPagination,
          });
        },
        onError: (err) => {
          setError(err.message || pageTr("Failed to load payments"));
        },
        onFinally: () => {
          setLoading(false);
        },
      });
    };

    run();
  }, [debouncedSearch, page, pageTr, paymentsRequest, status]);

  const refreshPayments = async () => {
    setLoading(true);
    setError("");

    await paymentsRequest.runLatest(async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (status) params.set("status", status);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const response = await fetch(`${getApiBase()}/admin/payments?${params.toString()}`, {
        headers: buildAuthHeaders(),
      });

      const data = await parseJsonResponse(response);
      if (data?.success === false) {
        throw new Error(data?.message || pageTr("Failed to load payments"));
      }
      return data;
    }, {
      onSuccess: (data) => {
        const nextPayments = Array.isArray(data?.data?.payments) ? data.data.payments : [];
        const nextSummary = data?.data?.summary || {};
        const nextMeta = data?.meta || {};
        const nextPagination = {
          page: Number(nextMeta.page) || page,
          limit: Number(nextMeta.limit) || PAGE_SIZE,
          totalPages: Number(nextMeta.totalPages) || 1,
          totalPayments: Number(nextMeta.totalPayments || nextMeta.total || nextSummary.totalPayments || 0),
        };
        const cacheKey = getAdminPaymentsCacheKey({
          page,
          search: debouncedSearch,
          status,
        });

        setPayments(nextPayments);
        setSummary(nextSummary);
        setPagination(nextPagination);
        writeAdminPageCache(cacheKey, {
          payments: nextPayments,
          summary: nextSummary,
          pagination: nextPagination,
        });
      },
      onError: (err) => {
        setError(err.message || pageTr("Failed to load payments"));
      },
      onFinally: () => {
        setLoading(false);
      },
    });
  };

  const statsCards = [
    {
      title: pageTr("Total payments"),
      value: formatNumber(summary.totalPayments || 0, language),
      note: pageTr("Visible in current filter"),
      icon: CreditCard,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      title: pageTr("Successful payments"),
      value: formatNumber(summary.paidPayments || 0, language),
      note: pageTr("Payments with successful status"),
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      title: pageTr("Pending payments"),
      value: formatNumber(summary.pendingPayments || 0, language),
      note: pageTr("Payments awaiting completion"),
      icon: Clock3,
      tone: "bg-amber-50 text-amber-700",
    },
  ];

  const paginationItems = getPaginationItems(pagination.page, pagination.totalPages);
  const startItem = pagination.totalPayments === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.totalPayments || 0);

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={`w-full max-w-full overflow-x-hidden space-y-6 ${isRTL ? "text-right" : "text-left"}`}
    >
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-600">{pageTr("Payment operations")}</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-800">{t("pages.payments.title")}</h1>
            <p className="mt-2 max-w-3xl text-sm font-normal leading-7 text-slate-600">
              {pageTr("Track payment health, transaction outcomes, and total collected revenue from one clear workspace.")}
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
            <h2 className="text-lg font-extrabold text-slate-800">{pageTr("Payment directory")}</h2>
            <p className="mt-1 text-sm font-normal text-slate-600">
              {pageTr("Search by reference, transaction ID, or student email and review every payment from one table.")}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{pageTr("Total revenue")}</p>
            <p className="mt-2 text-xl font-extrabold text-slate-800">
              {formatAmount(summary.totalRevenue || 0, language)}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">{pageTr("Revenue from paid payments only")}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px_160px]">
          <label className="relative block">
            <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-slate-400">
              <Search size={18} />
            </span>
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder={pageTr("Search reference, transaction ID, or email")}
              className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-11 pe-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
            />
          </label>

          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
          >
            <option value="">{pageTr("All statuses")}</option>
            <option value="paid">{pageTr("Successful")}</option>
            <option value="pending">{pageTr("Pending")}</option>
          </select>

          <button
            type="button"
            onClick={refreshPayments}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 transition hover:bg-white"
          >
            <RefreshCw size={16} />
            {pageTr("Refresh")}
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-700">
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Student")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Course")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Amount")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Status")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Provider")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Reference")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Transaction ID")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Paid at")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-6">
                    <AdminPageLoader
                      label={pageTr("Loading payments")}
                      minHeight="min-h-[160px]"
                      className="border-0 bg-transparent p-0"
                    />
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center font-bold text-slate-900">
                    {pageTr("No payments matched the current filters.")}
                  </td>
                </tr>
              ) : (
                payments.map((payment) => {
                  const normalizedStatus = normalizePaymentStatus(payment.status);
                  const statusLabel = pageTr(statusLabelMap[normalizedStatus] || normalizedStatus || "-");
                  const badgeClass = statusClass[normalizedStatus] || "border-slate-200 bg-slate-100 text-slate-700";

                  return (
                    <tr key={payment._id} className="align-middle transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="min-h-[44px]">
                          <p className="truncate font-bold text-slate-800">{payment.studentId?.name || "-"}</p>
                          <p className="mt-1 truncate text-xs font-semibold text-slate-500" dir="ltr">
                            {payment.studentId?.email || payment.customerEmail || "-"}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="line-clamp-2 font-bold text-slate-800">{payment.courseId?.title || "-"}</p>
                      </td>
                      <td className="px-5 py-4 font-extrabold text-slate-800" dir="ltr">
                        {formatDisplayCurrencyAmount(
                          payment.gatewayAmount || payment.amount,
                          payment.gatewayCurrency || payment.currency || "USD",
                          language,
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-black ${badgeClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {payment.provider || "-"}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-bold text-slate-700" dir="ltr">
                        {payment.paymentReference || "-"}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-bold text-slate-700" dir="ltr">
                        {payment.transactionId || "-"}
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-600">
                        {formatDateTime(payment.paidAt, language)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-700">
            {pageTr("Showing")} <span className="text-slate-950">{formatNumber(startItem, language)}</span> {pageTr("to")}{" "}
            <span className="text-slate-950">{formatNumber(endItem, language)}</span> {pageTr("of")}{" "}
            <span className="text-slate-950">{formatNumber(pagination.totalPayments || 0, language)}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pageTr("Previous")}
            </button>
            {paginationItems.map((pageItem, index) =>
              pageItem === "..." ? (
                <span key={`dots-${index}`} className="px-2 text-sm font-bold text-slate-400">...</span>
              ) : (
                <button
                  key={`page-${pageItem}`}
                  type="button"
                  onClick={() => setPage(Number(pageItem))}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black transition ${
                    Number(pageItem) === pagination.page
                      ? "bg-primary-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {formatNumber(pageItem, language)}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={pagination.page >= (pagination.totalPages || 1)}
              onClick={() => setPage((prev) => Math.min(pagination.totalPages || 1, prev + 1))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pageTr("Next")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
