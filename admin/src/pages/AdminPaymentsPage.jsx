import { useEffect, useMemo, useState } from "react";
import { Search, CreditCard, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { getToken } from "../../services/portal.js";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import useLatestRequest from "../hooks/useLatestRequest.js";
import {
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";

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

const statusLabel = {
  pending: "Pending",
  paid: "Successful",
  failed: "Failed",
  cancelled: "Cancelled",
  expired: "Expired",
  refunded: "Refunded",
};

const statusClass = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
  expired: "bg-slate-100 text-slate-700 border-slate-200",
  refunded: "bg-blue-50 text-blue-700 border-blue-200",
};
const ADMIN_PAYMENTS_CACHE_TTL_MS = 5 * 60 * 1000;
const getAdminPaymentsCacheKey = ({ page, search, status }) =>
  getAdminPageCacheKey("payments", { page, search, status });

export default function AdminPaymentsPage() {
  const { language, t, tr } = useAdminI18n();
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
  const [pagination, setPagination] = useState({ totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = useMemo(() => getToken(), []);
  const paymentsRequest = useLatestRequest();

  useEffect(() => {
    if (!token) return;

    const run = async () => {
      const cacheKey = getAdminPaymentsCacheKey({
        page,
        search: debouncedSearch,
        status,
      });
      const cached = readAdminPageCache(cacheKey, { maxAgeMs: ADMIN_PAYMENTS_CACHE_TTL_MS });
      if (cached) {
        setPayments(Array.isArray(cached.payments) ? cached.payments : []);
        setSummary(cached.summary || {});
        setPagination(cached.pagination || { totalPages: 1 });
        setLoading(false);
        setError("");
      } else {
        setLoading(true);
        setError("");
      }
      await paymentsRequest.runLatest(async () => {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
        });
        if (status) params.set("status", status);
        if (debouncedSearch) params.set("search", debouncedSearch);

        const response = await fetch(
          `${getApiBase()}/admin/payments?${params.toString()}`,
          {
            headers: buildAuthHeaders(),
          },
        );

        const data = await parseJsonResponse(response);
        if (data?.success === false) {
          throw new Error(data?.message || "Failed to load payments");
        }
        return data;
      }, {
        onSuccess: (data) => {
          const nextPayments = data?.data?.payments || [];
          const nextSummary = data?.data?.summary || {};
          const nextPagination = data?.meta || { totalPages: 1 };
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
          setError(err.message || "Failed to load payments");
        },
        onFinally: () => {
          setLoading(false);
        },
      });
    };

    run();
  }, [debouncedSearch, page, paymentsRequest, status, token]);

  return (
    <section className="space-y-6 text-right" dir="ltr">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">{t("pages.payments.title")}</h1>
        <p className="mt-1 text-sm font-normal text-slate-500">
          {t("pages.payments.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={CreditCard}
          title={tr("Total Payments")}
          value={summary.totalPayments || 0}
        />
        <SummaryCard
          icon={CheckCircle2}
          title={tr("Payment Successful")}
          value={summary.paidPayments || 0}
        />
        <SummaryCard
          icon={Clock3}
          title={t("common.pending")}
          value={summary.pendingPayments || 0}
        />
        <SummaryCard
          icon={XCircle}
          title={t("common.failed")}
          value={summary.failedPayments || 0}
          danger
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-slate-500">{tr("Total revenue")}</p>
        <p className="text-2xl font-extrabold text-slate-800">
          {formatAmount(summary.totalRevenue || 0, language)}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_200px]">
          <label className="relative">
            <Search
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder={tr("Search   ref,   Email")}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-3 text-sm font-medium outline-none focus:border-primary-500 focus:bg-white"
            />
          </label>
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none focus:border-primary-500 focus:bg-white"
          >
            <option value="">{t("common.allStatuses")}</option>
            <option value="paid">{t("common.success")}</option>
            <option value="pending">{t("common.pending")}</option>
            <option value="failed">{t("common.failed")}</option>
            <option value="cancelled">{t("common.cancelled")}</option>
            <option value="refunded">{t("common.refunded")}</option>
          </select>
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-right text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">{tr("Student")}</th>
                <th className="px-4 py-3 font-bold">{tr("Course")}</th>
                <th className="px-4 py-3 font-bold">{tr("Amount")}</th>
                <th className="px-4 py-3 font-bold">{tr("Status")}</th>
                <th className="px-4 py-3 font-bold">Provider</th>
                <th className="px-4 py-3 font-bold">Reference</th>
                <th className="px-4 py-3 font-bold">Transaction ID</th>
                <th className="px-4 py-3 font-bold">Paid At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    {tr("Payment  .")}
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">
                        {payment.studentId?.name || "-"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {payment.studentId?.email || payment.customerEmail || "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800">
                      {payment.courseId?.title || "-"}
                    </td>
                    <td className="px-4 py-3 font-extrabold text-slate-800" dir="ltr">
                      {formatAmount(payment.amount, language)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                          statusClass[payment.status] ||
                          "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {statusLabel[payment.status] || payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {payment.provider || "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">
                      {payment.paymentReference || "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">
                      {payment.transactionId || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600">
                      {payment.paidAt
                        ? new Date(payment.paidAt).toLocaleString(
                            language === "fa" ? "fa-AF" : "en-US",
                          )
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
          >
            {tr("Previous")}
          </button>
          <span className="text-xs font-bold text-slate-500">
            {tr("Page")} {page} {tr("of")} {pagination.totalPages || 1}
          </span>
          <button
            disabled={page >= (pagination.totalPages || 1)}
            onClick={() =>
              setPage((prev) => Math.min(pagination.totalPages || 1, prev + 1))
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
          >
            {tr("Next")}
          </button>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ icon: Icon, title, value, danger = false }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-700">
        <Icon size={20} className={danger ? "text-rose-600" : ""} />
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-800">{value}</p>
    </article>
  );
}
