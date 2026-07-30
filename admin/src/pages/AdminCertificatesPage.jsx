import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, Ban, CheckCircle2, Search } from "lucide-react";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";

const PAGE_SIZE = 20;

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

const getStatusBadge = (status = "") => {
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const getPaginationItems = (currentPage, totalPages) => {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 3) return [1, 2, 3, "...", totalPages];
  if (currentPage >= totalPages - 2) return [1, "...", totalPages - 2, totalPages - 1, totalPages];
  return [1, "...", currentPage, "...", totalPages];
};

export default function AdminCertificatesPage() {
  const { t, language, isRTL } = useAdminI18n();
  const isFa = language === "fa";
  const apiUrl = getApiBase();
  const [certificates, setCertificates] = useState([]);
  const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0 });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    totalCertificates: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submittingId, setSubmittingId] = useState("");

  const text = useMemo(
    () => ({
      title: t("pages.certificates.title"),
      subtitle: t("pages.certificates.subtitle"),
      searchLabel: isFa ? "جستجوی کد سرتیفیکیت" : "Search certificate ID",
      allStatuses: isFa ? "همه وضعیت‌ها" : "All statuses",
      approved: isFa ? "تایید شده" : "Approved",
      rejected: isFa ? "رد شده" : "Rejected",
      total: isFa ? "همه سرتیفیکیت‌ها" : "All certificates",
      approvedNote: isFa ? "قابل نمایش برای شاگرد" : "Visible to students",
      rejectedNote: isFa ? "از شاگرد پنهان شده" : "Hidden from students",
      student: isFa ? "شاگرد" : "Student",
      course: isFa ? "کورس" : "Course",
      teacher: isFa ? "مدرس" : "Teacher",
      issuedAt: isFa ? "تاریخ صدور" : "Issued at",
      reviewedAt: isFa ? "آخرین بررسی" : "Last review",
      status: isFa ? "وضعیت" : "Status",
      actions: isFa ? "اقدام‌ها" : "Actions",
      reject: isFa ? "رد کردن" : "Reject",
      approve: isFa ? "تایید دوباره" : "Approve again",
      noData: isFa ? "سرتیفیکیتی برای این فیلتر پیدا نشد." : "No certificates matched these filters.",
      loading: isFa ? "در حال بارگذاری سرتیفیکیت‌ها" : "Loading certificates",
      updatedRejected: isFa ? "سرتیفیکیت رد شد و دیگر برای شاگرد نمایش داده نمی‌شود." : "Certificate rejected and hidden from the student.",
      updatedApproved: isFa ? "سرتیفیکیت دوباره تایید شد." : "Certificate approved again.",
      fetchFailed: isFa ? "گرفتن فهرست سرتیفیکیت‌ها ناموفق بود." : "Failed to fetch certificates list.",
      reviewFailed: isFa ? "به‌روزرسانی وضعیت سرتیفیکیت ناموفق بود." : "Unable to update certificate status.",
      reasonLabel: isFa ? "دلیل رد" : "Rejection reason",
      byLabel: isFa ? "بررسی توسط" : "Reviewed by",
      pageSummary: isFa ? "رکوردهای این صفحه" : "Records on this page",
      certificateId: isFa ? "کد سرتیفیکیت" : "Certificate ID",
      reviewedByFallback: isFa ? "ادمین سیستم" : "System Admin",
      showing: isFa ? "نمایش" : "Showing",
      to: isFa ? "تا" : "to",
      of: isFa ? "از" : "of",
    }),
    [isFa, t],
  );

  useEffect(() => {
    let mounted = true;

    const loadCertificates = async () => {
      try {
        setLoading(true);
        setErrorMessage("");
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (statusFilter) params.set("status", statusFilter);
        if (debouncedSearch) params.set("search", debouncedSearch);

        const response = await fetch(`${apiUrl}/admin/certificates?${params.toString()}`, {
          headers: buildAuthHeaders(),
        });
        const data = await parseJsonResponse(response);
        if (!mounted) return;
        setCertificates(Array.isArray(data?.certificates) ? data.certificates : []);
        setStats(data?.stats || { total: 0, approved: 0, rejected: 0 });
        setPagination({
          page: Number(data?.pagination?.page) || 1,
          limit: Number(data?.pagination?.limit) || PAGE_SIZE,
          totalCertificates: Number(data?.pagination?.totalCertificates) || 0,
          totalPages: Number(data?.pagination?.totalPages) || 1,
        });
      } catch (error) {
        if (!mounted) return;
        setErrorMessage(error.message || text.fetchFailed);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadCertificates();
    return () => {
      mounted = false;
    };
  }, [apiUrl, debouncedSearch, page, statusFilter, text.fetchFailed]);

  const reviewCertificate = useCallback(
    async (certificate, decision) => {
      if (submittingId) return;
      let reason = "";
      if (decision === "rejected") {
        const enteredReason = window.prompt(
          isFa
            ? "دلیل رد سرتیفیکیت را وارد کنید:"
            : "Enter the reason for rejecting this certificate:",
          certificate.certificateRejectionReason || "",
        );
        if (enteredReason === null) return;
        reason = enteredReason.trim();
        if (reason.length < 3) {
          setErrorMessage(
            isFa
              ? "دلیل رد باید حداقل ۳ نویسه باشد."
              : "The rejection reason must be at least 3 characters.",
          );
          return;
        }
      } else if (
        !window.confirm(
          isFa
            ? "این سرتیفیکیت دوباره تایید شود؟"
            : "Approve this certificate again?",
        )
      ) {
        return;
      }
      try {
        setSubmittingId(certificate.id);
        setNotice("");
        setErrorMessage("");
        const response = await fetch(`${apiUrl}/admin/certificates/${certificate.id}/review`, {
          method: "PATCH",
          headers: buildAuthHeaders(),
          body: JSON.stringify({
            decision,
            reason,
          }),
        });
        await parseJsonResponse(response);
        setNotice(decision === "rejected" ? text.updatedRejected : text.updatedApproved);
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (statusFilter) params.set("status", statusFilter);
        if (debouncedSearch) params.set("search", debouncedSearch);
        const refreshResponse = await fetch(`${apiUrl}/admin/certificates?${params.toString()}`, {
          headers: buildAuthHeaders(),
        });
        const refreshed = await parseJsonResponse(refreshResponse);
        setCertificates(Array.isArray(refreshed?.certificates) ? refreshed.certificates : []);
        setStats(refreshed?.stats || { total: 0, approved: 0, rejected: 0 });
        setPagination({
          page: Number(refreshed?.pagination?.page) || 1,
          limit: Number(refreshed?.pagination?.limit) || PAGE_SIZE,
          totalCertificates: Number(refreshed?.pagination?.totalCertificates) || 0,
          totalPages: Number(refreshed?.pagination?.totalPages) || 1,
        });
      } catch (error) {
        setErrorMessage(error.message || text.reviewFailed);
      } finally {
        setSubmittingId("");
      }
    },
    [
      apiUrl,
      debouncedSearch,
      isFa,
      page,
      statusFilter,
      submittingId,
      text.reviewFailed,
      text.updatedApproved,
      text.updatedRejected,
    ],
  );

  const summaryCards = [
    { label: text.total, value: stats.total, note: text.pageSummary, icon: Award, tone: "bg-blue-50 text-blue-700" },
    { label: text.approved, value: stats.approved, note: text.approvedNote, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
    { label: text.rejected, value: stats.rejected, note: text.rejectedNote, icon: Ban, tone: "bg-rose-50 text-rose-700" },
  ];

  const paginationItems = getPaginationItems(pagination.page, pagination.totalPages);
  const startItem = pagination.totalCertificates ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.totalCertificates);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-7 text-slate-900 shadow-sm sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-600">
          {isFa ? "مدیریت سرتیفیکیت‌ها" : "Certificate operations"}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-800">{text.title}</h1>
        <p className="mt-2 max-w-3xl text-sm font-normal leading-7 text-slate-600">
          {text.subtitle}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((item) => (
          <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`inline-flex rounded-2xl p-3 ${item.tone}`}>
              <item.icon size={20} />
            </div>
            <p className="mt-4 text-sm font-bold text-slate-500">{item.label}</p>
            <p className="mt-1 text-3xl font-black text-slate-950">{formatNumber(item.value, language)}</p>
            <p className="mt-2 text-xs font-medium text-slate-500">{item.note}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">{text.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{text.subtitle}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative">
              <Search
                size={16}
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRTL ? "right-3" : "left-3"}`}
              />
              <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
                placeholder={text.searchLabel}
                className={`h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 outline-none transition focus:border-[#0B4FD8] focus:bg-white focus:ring-4 focus:ring-[#0B4FD8]/10 sm:w-72 ${isRTL ? "pr-9 pl-4 text-right" : "pl-9 pr-4 text-left"}`}
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0B4FD8] focus:bg-white focus:ring-4 focus:ring-[#0B4FD8]/10"
            >
              <option value="">{text.allStatuses}</option>
              <option value="approved">{text.approved}</option>
              <option value="rejected">{text.rejected}</option>
            </select>
          </div>
        </div>

        {notice ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {notice}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6">
            <AdminPageLoader label={text.loading} />
          </div>
        ) : certificates.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm font-semibold text-slate-500">
            {text.noData}
          </div>
        ) : (
          <>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">{text.student}</th>
                    <th className="px-3 py-3">{text.course}</th>
                    <th className="px-3 py-3">{text.teacher}</th>
                    <th className="px-3 py-3">{text.certificateId}</th>
                    <th className="px-3 py-3">{text.issuedAt}</th>
                    <th className="px-3 py-3">{text.status}</th>
                    <th className="px-3 py-3">{text.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {certificates.map((certificate) => {
                    const isRejected = certificate.certificateApprovalStatus === "rejected";
                    const isBusy = submittingId === certificate.id;
                    return (
                      <tr key={certificate.id} className="align-top">
                        <td className="px-3 py-4">
                          <p className="font-black text-slate-900">{certificate.studentName}</p>
                          <p className="mt-1 text-xs font-medium text-slate-500">{certificate.studentEmail || "-"}</p>
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-bold text-slate-800">{certificate.courseTitle}</p>
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-bold text-slate-800">{certificate.teacherName}</p>
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-mono text-sm font-bold text-slate-800">{certificate.certificateId}</p>
                        </td>
                        <td className="px-3 py-4">
                          <p className="text-sm font-semibold text-slate-700">{formatDateTime(certificate.issuedAt, language)}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {text.reviewedAt}: {formatDateTime(certificate.certificateReviewedAt, language)}
                          </p>
                          {certificate.certificateReviewedAt ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {text.byLabel}: {certificate.certificateReviewedByName || text.reviewedByFallback}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getStatusBadge(certificate.certificateApprovalStatus)}`}>
                            {certificate.certificateApprovalStatus === "rejected" ? text.rejected : text.approved}
                          </span>
                          {isRejected && certificate.certificateRejectionReason ? (
                            <p className="mt-2 max-w-xs text-xs font-medium text-rose-700">
                              {text.reasonLabel}: {certificate.certificateRejectionReason}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex flex-col gap-2">
                            {isRejected ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => reviewCertificate(certificate, "approved")}
                                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {text.approve}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => reviewCertificate(certificate, "rejected")}
                                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-black text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {text.reject}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>
                {text.showing} {formatNumber(startItem, language)} {text.to} {formatNumber(endItem, language)} {text.of}{" "}
                {formatNumber(pagination.totalCertificates, language)}
              </p>
              <div className="flex items-center gap-2">
                {paginationItems.map((item, index) =>
                  item === "..." ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-slate-400">
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      className={`min-w-[40px] rounded-xl px-3 py-2 text-sm font-bold transition ${
                        item === pagination.page
                          ? "bg-[#0B4FD8] text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
