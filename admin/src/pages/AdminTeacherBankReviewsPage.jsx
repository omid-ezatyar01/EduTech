import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Landmark,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";

const PAGE_SIZE = 20;
const STATUS_STYLES = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
};

const formatDate = (value, isFa) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(isFa ? "fa-AF" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const Detail = ({ label, value, ltr = false }) => (
  <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
    <p className="text-[11px] font-bold text-slate-500">{label}</p>
    <p
      dir={ltr ? "ltr" : undefined}
      className={`mt-1 break-words text-sm font-black text-slate-900 ${ltr ? "text-left" : ""}`}
    >
      {value || "—"}
    </p>
  </div>
);

export default function AdminTeacherBankReviewsPage() {
  const { language, isRTL } = useAdminI18n();
  const isFa = language === "fa";
  const apiUrl = getApiBase();
  const [teachers, setTeachers] = useState([]);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const requestIdRef = useRef(0);

  const text = useMemo(
    () => ({
      title: isFa ? "بررسی اطلاعات بانکی مدرسان" : "Teacher payment-detail reviews",
      subtitle: isFa
        ? "اطلاعات کارت و حساب فقط پس از تأیید شما برای پرداخت فعال می‌شود."
        : "Card and bank details become active for payments only after your approval.",
      pending: isFa ? "در انتظار" : "Pending",
      approved: isFa ? "تأییدشده" : "Approved",
      rejected: isFa ? "ردشده" : "Rejected",
      search: isFa ? "جستجوی نام، ایمیل یا صاحب حساب" : "Search teacher, email, or holder",
      submitted: isFa ? "ارسال‌شده" : "Submitted",
      review: isFa ? "بررسی جزئیات" : "Review details",
      noData: isFa ? "درخواستی در این وضعیت وجود ندارد." : "No submissions in this status.",
      loadFailed: isFa ? "دریافت درخواست‌ها ناموفق بود." : "Unable to load submissions.",
      holder: isFa ? "نام صاحب حساب" : "Account holder",
      country: isFa ? "کشور" : "Country",
      bank: isFa ? "نام بانک" : "Bank",
      account: isFa ? "شماره حساب" : "Account number",
      card: isFa ? "شماره کارت" : "Card number",
      iban: isFa ? "شماره شبا" : "IBAN / Shaba",
      swift: "SWIFT",
      currency: isFa ? "واحد پول" : "Currency",
      paymentNote: isFa ? "یادداشت پرداخت" : "Payment note",
      current: isFa ? "اطلاعات فعال فعلی" : "Currently active details",
      proposed: isFa ? "اطلاعات جدید پیشنهادی" : "Submitted replacement",
      adminNote: isFa ? "یادداشت مدیر / دلیل رد" : "Admin note / rejection reason",
      approve: isFa ? "تأیید و فعال‌سازی" : "Approve and activate",
      reject: isFa ? "رد و درخواست اصلاح" : "Reject and request changes",
      close: isFa ? "بستن" : "Close",
      rejectRequired: isFa ? "برای رد، دلیل اصلاح را بنویسید." : "Add a reason before rejecting.",
      done: isFa ? "وضعیت اطلاعات بانکی به‌روزرسانی شد." : "Payment-detail status updated.",
    }),
    [isFa],
  );

  const loadRows = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        status,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const response = await fetch(`${apiUrl}/admin/teacher-bank-reviews?${params}`, {
        headers: buildAuthHeaders(),
      });
      const data = await parseJsonResponse(response);
      if (requestId !== requestIdRef.current) return;
      setTeachers(Array.isArray(data?.teachers) ? data.teachers : []);
      setCounts(data?.counts || {});
      setPagination({
        total: Number(data?.pagination?.total || 0),
        totalPages: Number(data?.pagination?.totalPages || 1),
      });
    } catch (requestError) {
      if (requestId === requestIdRef.current) {
        setError(requestError.message || text.loadFailed);
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [apiUrl, debouncedSearch, page, status, text.loadFailed]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadRows(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRows]);

  const openReview = (teacher) => {
    setSelected(teacher);
    setNote("");
    setError("");
  };

  const submitReview = async (nextDecision) => {
    if (!selected) return;
    if (nextDecision === "rejected" && !note.trim()) {
      setError(text.rejectRequired);
      return;
    }
    try {
      setSaving(true);
      setError("");
      const response = await fetch(
        `${apiUrl}/admin/teachers/${selected._id}/bank-payment-review`,
        {
          method: "PATCH",
          headers: buildAuthHeaders(),
          body: JSON.stringify({ decision: nextDecision, note: note.trim() }),
        },
      );
      await parseJsonResponse(response);
      setSelected(null);
      setNotice(text.done);
      await loadRows();
    } catch (requestError) {
      setError(requestError.message || text.loadFailed);
    } finally {
      setSaving(false);
    }
  };

  const tabs = ["pending", "approved", "rejected"];
  const selectedPending = selected?.bankPaymentReview?.pendingInfo || {};
  const selectedCurrent = selected?.bankPaymentInfo || {};
  const renderDetails = (info) => (
    <div className="grid gap-2 sm:grid-cols-2">
      <Detail label={text.country} value={info.country === "AF" ? (isFa ? "افغانستان" : "Afghanistan") : info.country === "IR" ? (isFa ? "ایران" : "Iran") : info.country} />
      <Detail label={text.holder} value={info.accountHolderName} />
      <Detail label={text.bank} value={info.bankName} />
      <Detail label={text.currency} value={info.currency === "IRR" ? "TOMAN" : info.currency} ltr />
      <Detail label={text.account} value={info.accountNumber} ltr />
      <Detail label={text.card} value={info.cardNumber} ltr />
      <Detail label={text.iban} value={info.iban} ltr />
      <Detail label={text.swift} value={info.swiftCode} ltr />
      <div className="sm:col-span-2">
        <Detail label={text.paymentNote} value={info.paymentNote || info.note} />
      </div>
    </div>
  );

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className={isRTL ? "text-right" : "text-left"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-950">{text.title}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">{text.subtitle}</p>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-700">
          <Landmark size={23} />
        </span>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setStatus(item);
                  setPage(1);
                }}
                className={`rounded-xl border px-4 py-2 text-xs font-black transition ${
                  status === item ? STATUS_STYLES[item] : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {text[item]} ({Number(counts[item] || 0)})
              </button>
            ))}
          </div>
          <label className="relative min-w-0 flex-1 lg:ms-auto lg:max-w-md">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={text.search}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 ps-10 pe-3 text-sm font-semibold outline-none focus:border-blue-400 focus:bg-white"
            />
          </label>
        </div>
      </div>

      {notice ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div> : null}
      {error && !selected ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}

      {loading ? (
        <AdminPageLoader label={isFa ? "در حال دریافت درخواست‌ها" : "Loading submissions"} />
      ) : teachers.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-bold text-slate-500">{text.noData}</div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {teachers.map((teacher) => {
            const review = teacher.bankPaymentReview || {};
            return (
              <article key={teacher._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-black text-slate-950">{teacher.name}</h2>
                    <p dir="ltr" className={`mt-1 truncate text-xs font-semibold text-slate-500 ${isRTL ? "text-right" : "text-left"}`}>{teacher.email}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${STATUS_STYLES[review.status] || STATUS_STYLES.pending}`}>{text[review.status] || review.status}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Detail label={text.holder} value={review.pendingInfo?.accountHolderName} />
                  <Detail label={text.bank} value={review.pendingInfo?.bankName} />
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  {text.submitted}: {formatDate(review.submittedAt, isFa)}
                </p>
                <button type="button" onClick={() => openReview(teacher)} className="mt-4 h-11 w-full rounded-xl bg-blue-600 text-sm font-black text-white transition hover:bg-blue-700">
                  {text.review}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {pagination.totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-40">‹</button>
          <span className="text-sm font-black text-slate-700">{page} / {pagination.totalPages}</span>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-40">›</button>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-3 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && !saving && setSelected(null)}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">{selected.name}</h2>
                <p dir="ltr" className={`mt-1 text-sm font-semibold text-slate-500 ${isRTL ? "text-right" : "text-left"}`}>{selected.email}</p>
              </div>
              <button disabled={saving} onClick={() => setSelected(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><XCircle /></button>
            </div>
            <h3 className="mb-3 mt-6 text-sm font-black text-blue-800">{text.proposed}</h3>
            {renderDetails(selectedPending)}
            {Object.values(selectedCurrent).some(Boolean) ? (
              <details className="mt-4 rounded-2xl border border-slate-200 p-4">
                <summary className="cursor-pointer text-sm font-black text-slate-700">{text.current}</summary>
                <div className="mt-4">{renderDetails(selectedCurrent)}</div>
              </details>
            ) : null}
            {selected.bankPaymentReview?.status === "pending" ? (
              <>
                <label className="mt-5 block">
                  <span className="text-xs font-black text-slate-700">{text.adminNote}</span>
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none focus:border-blue-400" />
                </label>
                {error ? <p className="mt-2 text-sm font-bold text-rose-600">{error}</p> : null}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button disabled={saving} onClick={() => submitReview("rejected")} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-black text-rose-700 disabled:opacity-50">
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <AlertCircle size={18} />}
                    {text.reject}
                  </button>
                  <button disabled={saving} onClick={() => submitReview("approved")} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white disabled:opacity-50">
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    {text.approve}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                {selected.bankPaymentReview?.reviewNote || text[selected.bankPaymentReview?.status]}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
