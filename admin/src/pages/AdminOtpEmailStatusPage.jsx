import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, MailCheck, RefreshCw, Search } from "lucide-react";
import { fetchOtpEmailStatuses } from "../../services/otpService.js";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import useLatestRequest from "../hooks/useLatestRequest.js";
import {
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";

const STATUS_OPTIONS = ["all", "pending", "sent", "delivered", "bounced", "failed", "suppressed", "complained"];
const getAdminOtpStatusCacheKey = ({ search, status, page }) =>
  getAdminPageCacheKey("otp-email-status", { search, status, page });
const ADMIN_OTP_STATUS_CACHE_TTL_MS = 5 * 60 * 1000;

const statusClasses = {
  pending: "bg-amber-50 text-amber-700 border-amber-100",
  sent: "bg-blue-50 text-blue-700 border-blue-100",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-100",
  bounced: "bg-rose-50 text-rose-700 border-rose-100",
  failed: "bg-red-50 text-red-700 border-red-100",
  suppressed: "bg-purple-50 text-purple-700 border-purple-100",
  complained: "bg-orange-50 text-orange-700 border-orange-100",
};

const formatDate = (value, language) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(language === "fa" ? "fa-AF" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function AdminOtpEmailStatusPage() {
  const { t, language, isRTL } = useAdminI18n();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rowsRequest = useLatestRequest();
  const pageTitle = t("pages.otpEmailStatus.title");
  const pageSubtitle = t("pages.otpEmailStatus.subtitle");

  const loadRows = useCallback(async () => {
    const cacheKey = getAdminOtpStatusCacheKey({
      search: debouncedSearch,
      status,
      page,
    });
    const cached = readAdminPageCache(cacheKey, {
      maxAgeMs: ADMIN_OTP_STATUS_CACHE_TTL_MS,
    });

    if (cached) {
      setRows(Array.isArray(cached.rows) ? cached.rows : []);
      setMeta(cached.meta || { page: 1, totalPages: 1, total: 0 });
      setLoading(false);
      setError("");
    } else {
      setLoading(true);
      setError("");
    }

    await rowsRequest.runLatest(
      async () => fetchOtpEmailStatuses({ search: debouncedSearch, status, page, limit: 20 }),
      {
        onSuccess: (result) => {
          setRows(result.rows);
          setMeta(result.meta);
          writeAdminPageCache(cacheKey, {
            rows: result.rows,
            meta: result.meta,
          });
        },
        onError: (err) => {
          setError(err.message || "Failed to load OTP email statuses.");
        },
        onFinally: () => {
          setLoading(false);
        },
      },
    );
  }, [debouncedSearch, page, rowsRequest, status]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const totalPages = Math.max(1, Number(meta.totalPages || 1));

  const statusCounts = useMemo(
    () =>
      rows.reduce((acc, row) => {
        const key = row.status || "pending";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    [rows],
  );

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">
            <MailCheck size={18} />
            OTP Email Delivery
          </div>
          <h1 className="mt-3 text-2xl font-black text-slate-950">{pageTitle}</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">{pageSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={loadRows}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {["sent", "delivered", "failed", "suppressed"].map((item) => (
          <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">{item}</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{statusCounts[item] || 0}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Search email or message ID..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-10 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-700 outline-none"
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All statuses" : item}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-bold text-rose-700">
            <AlertTriangle size={18} />
            {error}
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="rounded-s-xl px-4 py-3">Email</th>
                <th className="px-4 py-3">Last OTP request</th>
                <th className="px-4 py-3">Provider message ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="rounded-e-xl px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    Loading OTP email statuses
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-900">{row.email}</p>
                      {row.emailBlocked ? (
                        <p className="mt-1 text-xs font-bold text-purple-700">
                          Blocked: {row.emailBlockReason || "suppressed"}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">{formatDate(row.lastOtpRequestAt, language)}</td>
                    <td className="px-4 py-4 font-mono text-xs">{row.messageId || row.resendEmailId || "-"}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClasses[row.status] || statusClasses.pending}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="max-w-[360px] px-4 py-4 text-slate-600">
                      {row.reason || "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No OTP email records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs font-bold text-slate-500">
            Total: {Number(meta.total || rows.length)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs font-black text-slate-500">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
