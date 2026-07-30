import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  Copy,
  Pencil,
  Percent,
  Plus,
  Search,
  Tag,
  Ticket,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useSearchParams } from "react-router";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useDebouncedValue from "../hooks/useDebouncedValue.js";

const EMPTY_FORM = {
  code: "",
  title: "",
  description: "",
  type: "percent",
  discountValue: "10",
  minimumPurchaseUsd: "0",
  usageLimit: "",
  perUserLimit: "1",
  startsAt: "",
  expiresAt: "",
  status: "active",
  courseIds: [],
};

const copy = {
  en: {
    title: "Coupons",
    subtitle: "Create controlled discounts and track successful redemptions.",
    add: "Add coupon",
    search: "Search code or campaign",
    allStatuses: "All statuses",
    allTypes: "All types",
    active: "Active",
    inactive: "Inactive",
    scheduled: "Scheduled",
    expired: "Expired",
    used_up: "Used up",
    percent: "Percent",
    fixed: "Fixed USD",
    total: "Coupons",
    activeNow: "Active now",
    percentCampaigns: "Percent campaigns",
    redemptions: "Successful redemptions",
    code: "Code",
    campaign: "Campaign",
    discount: "Discount",
    usage: "Usage",
    validity: "Validity",
    status: "Status",
    actions: "Actions",
    noRows: "No coupons match these filters.",
    loading: "Loading coupons",
    create: "Create coupon",
    edit: "Edit coupon",
    description: "Description",
    minimum: "Minimum purchase (USD)",
    limit: "Global usage limit",
    unlimited: "Leave blank for unlimited",
    perUser: "Uses per student",
    starts: "Starts at",
    expires: "Expires at",
    courses: "Eligible courses",
    allCourses: "No selection means all courses.",
    save: "Save coupon",
    saving: "Saving…",
    cancel: "Cancel",
    copied: "Copied",
    deactivate: "Deactivate",
    reactivate: "Reactivate",
    deactivateConfirm: "Deactivate this coupon? Existing paid redemptions remain unchanged.",
    failed: "Unable to load coupons.",
  },
  fa: {
    title: "کوپن‌ها",
    subtitle: "تخفیف‌های کنترل‌شده بسازید و استفاده‌های موفق را دنبال کنید.",
    add: "افزودن کوپن",
    search: "جستجوی کد یا کمپاین",
    allStatuses: "همه وضعیت‌ها",
    allTypes: "همه نوع‌ها",
    active: "فعال",
    inactive: "غیرفعال",
    scheduled: "زمان‌بندی‌شده",
    expired: "منقضی",
    used_up: "مصرف‌شده",
    percent: "درصدی",
    fixed: "مبلغ ثابت دالر",
    total: "کوپن‌ها",
    activeNow: "فعال فعلی",
    percentCampaigns: "کمپاین درصدی",
    redemptions: "استفاده‌های موفق",
    code: "کد",
    campaign: "کمپاین",
    discount: "تخفیف",
    usage: "مصرف",
    validity: "اعتبار",
    status: "وضعیت",
    actions: "اقدام‌ها",
    noRows: "کوپنی مطابق این فیلترها نیست.",
    loading: "در حال بارگذاری کوپن‌ها",
    create: "ایجاد کوپن",
    edit: "ویرایش کوپن",
    description: "توضیحات",
    minimum: "حداقل خرید (دالر)",
    limit: "حد استفاده عمومی",
    unlimited: "برای نامحدود خالی بگذارید",
    perUser: "استفاده برای هر شاگرد",
    starts: "زمان شروع",
    expires: "زمان انقضا",
    courses: "کورس‌های مجاز",
    allCourses: "بدون انتخاب یعنی همه کورس‌ها.",
    save: "ذخیره کوپن",
    saving: "در حال ذخیره…",
    cancel: "لغو",
    copied: "کاپی شد",
    deactivate: "غیرفعال‌سازی",
    reactivate: "فعال‌سازی",
    deactivateConfirm: "این کوپن غیرفعال شود؟ استفاده‌های پرداخت‌شده تغییر نمی‌کند.",
    failed: "دریافت کوپن‌ها ناموفق بود.",
  },
};

const statusStyle = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border-slate-200 bg-slate-100 text-slate-700",
  scheduled: "border-blue-200 bg-blue-50 text-blue-700",
  expired: "border-rose-200 bg-rose-50 text-rose-700",
  used_up: "border-amber-200 bg-amber-50 text-amber-700",
};

const toInputDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const toIsoOrNull = (value) => (value ? new Date(value).toISOString() : null);

export default function AdminCouponsPage() {
  const { language, isRTL } = useAdminI18n();
  const [searchParams] = useSearchParams();
  const requestedSearch = searchParams.get("q") || "";
  const text = copy[language === "fa" ? "fa" : "en"];
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, percent: 0, usage: 0 });
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1, total: 0 });
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState(requestedSearch);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    const response = await fetch(`${getApiBase()}/admin/coupons?${params}`, {
      headers: buildAuthHeaders(),
      cache: "no-store",
    });
    const payload = await parseJsonResponse(response);
    setRows(Array.isArray(payload?.data?.coupons) ? payload.data.coupons : []);
    setSummary(payload?.data?.summary || { total: 0, active: 0, percent: 0, usage: 0 });
    const totalPages = Number(payload?.meta?.totalPages || 1);
    setMeta({
      totalPages,
      total: Number(payload?.meta?.total || 0),
    });
    if (page > totalPages) setPage(totalPages);
  }, [debouncedSearch, page, status, type]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        await load();
        if (active) setError("");
      } catch (requestError) {
        if (active) setError(requestError.message || text.failed);
      } finally {
        if (active) setLoading(false);
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [load, text.failed]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${getApiBase()}/admin/coupons/course-options`, {
          headers: buildAuthHeaders(),
        });
        const payload = await parseJsonResponse(response);
        if (active) {
          setCourses(Array.isArray(payload?.data?.courses) ? payload.data.courses : []);
        }
      } catch {
        if (active) setCourses([]);
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [debouncedSearch, status, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(requestedSearch);
      setPage(1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [requestedSearch]);

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingId("");
    setForm(EMPTY_FORM);
    setError("");
  };

  const openCreate = () => {
    setEditingId("");
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (coupon) => {
    setEditingId(coupon._id);
    setForm({
      code: coupon.code || "",
      title: coupon.title || "",
      description: coupon.description || "",
      type: coupon.type || "percent",
      discountValue: String(coupon.discountValue ?? ""),
      minimumPurchaseUsd: String(coupon.minimumPurchaseUsd ?? 0),
      usageLimit: coupon.usageLimit == null ? "" : String(coupon.usageLimit),
      perUserLimit: String(coupon.perUserLimit || 1),
      startsAt: toInputDate(coupon.startsAt),
      expiresAt: toInputDate(coupon.expiresAt),
      status: ["active", "inactive"].includes(coupon.status) ? coupon.status : "active",
      courseIds: (coupon.courseIds || []).map((course) => String(course?._id || course)),
    });
    setError("");
    setModalOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = {
        ...form,
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        description: form.description.trim(),
        discountValue: Number(form.discountValue),
        minimumPurchaseUsd: Number(form.minimumPurchaseUsd || 0),
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        perUserLimit: Number(form.perUserLimit || 1),
        startsAt: toIsoOrNull(form.startsAt),
        expiresAt: toIsoOrNull(form.expiresAt),
      };
      const response = await fetch(
        `${getApiBase()}/admin/coupons${editingId ? `/${editingId}` : ""}`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: buildAuthHeaders(),
          body: JSON.stringify(body),
        },
      );
      await parseJsonResponse(response);
      setModalOpen(false);
      setEditingId("");
      setForm(EMPTY_FORM);
      setNotice(language === "fa" ? "کوپن ذخیره شد." : "Coupon saved.");
      await load();
    } catch (requestError) {
      setError(requestError.message || text.failed);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (coupon) => {
    const activate = coupon.status === "inactive";
    if (!activate && !window.confirm(text.deactivateConfirm)) return;
    setBusyId(coupon._id);
    setError("");
    try {
      const response = await fetch(`${getApiBase()}/admin/coupons/${coupon._id}`, {
        method: activate ? "PATCH" : "DELETE",
        headers: buildAuthHeaders(),
        body: activate ? JSON.stringify({ status: "active" }) : undefined,
      });
      await parseJsonResponse(response);
      await load();
    } catch (requestError) {
      setError(requestError.message || text.failed);
    } finally {
      setBusyId("");
    }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
    }
  };

  const statCards = [
    [text.total, summary.total, Ticket, "bg-blue-50 text-blue-700"],
    [text.activeNow, summary.active, BadgeCheck, "bg-emerald-50 text-emerald-700"],
    [text.percentCampaigns, summary.percent, Percent, "bg-violet-50 text-violet-700"],
    [text.redemptions, summary.usage, Wallet, "bg-amber-50 text-amber-700"],
  ];

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className={isRTL ? "text-right" : "text-left"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950">{text.title}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">{text.subtitle}</p>
        </div>
        <button onClick={openCreate} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700">
          <Plus size={18} /> {text.add}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(([label, value, Icon, tone]) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={19} /></span>
            <p className="mt-3 text-xs font-bold text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_210px_210px]">
        <label className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.search} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 ps-10 pe-3 text-sm font-semibold outline-none focus:border-blue-400" />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold">
          <option value="">{text.allStatuses}</option>
          {["active", "scheduled", "inactive", "expired", "used_up"].map((value) => <option key={value} value={value}>{text[value]}</option>)}
        </select>
        <select value={type} onChange={(event) => setType(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold">
          <option value="">{text.allTypes}</option>
          <option value="percent">{text.percent}</option>
          <option value="fixed">{text.fixed}</option>
        </select>
      </div>

      {notice ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div> : null}
      {error && !modalOpen ? <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}

      {loading ? (
        <AdminPageLoader label={text.loading} />
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="border-b bg-slate-50 text-slate-600">
              <tr>{[text.code, text.campaign, text.discount, text.usage, text.validity, text.status, text.actions].map((label) => <th key={label} className="px-4 py-3 text-start font-black">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? <tr><td colSpan={7} className="p-12 text-center font-bold text-slate-500">{text.noRows}</td></tr> : rows.map((coupon) => (
                <tr key={coupon._id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2"><Tag size={16} className="text-emerald-600" /><span dir="ltr" className="font-black">{coupon.code}</span><button onClick={() => copyCode(coupon.code)} className="rounded p-1 text-slate-400 hover:text-blue-600"><Copy size={14} /></button></div>
                    {copied === coupon.code ? <span className="text-[11px] font-bold text-emerald-600">{text.copied}</span> : null}
                  </td>
                  <td className="max-w-[220px] px-4 py-4"><p className="truncate font-black text-slate-900">{coupon.title}</p><p className="mt-1 truncate text-xs text-slate-500">{coupon.description}</p></td>
                  <td className="px-4 py-4 font-black">{coupon.type === "percent" ? `${coupon.discountValue}%` : `$${coupon.discountValue}`}</td>
                  <td className="px-4 py-4 font-bold">{coupon.usage || 0} / {coupon.limit ?? "∞"}</td>
                  <td className="px-4 py-4 text-xs font-semibold text-slate-600"><div className="flex items-center gap-1"><CalendarClock size={14} />{coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString(language === "fa" ? "fa-AF" : "en-US") : "∞"}</div></td>
                  <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusStyle[coupon.status] || statusStyle.inactive}`}>{text[coupon.status] || coupon.status}</span></td>
                  <td className="px-4 py-4"><div className="flex gap-2"><button onClick={() => openEdit(coupon)} className="rounded-lg bg-blue-50 p-2 text-blue-700"><Pencil size={15} /></button><button disabled={busyId === coupon._id} onClick={() => changeStatus(coupon)} title={coupon.status === "inactive" ? text.reactivate : text.deactivate} className={`rounded-lg p-2 ${coupon.status === "inactive" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{coupon.status === "inactive" ? <BadgeCheck size={15} /> : <Trash2 size={15} />}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {meta.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-xs font-bold text-slate-500">{meta.total} {text.total}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-1.5 text-sm font-black disabled:opacity-40">‹</button>
                <span className="text-sm font-black">{page} / {meta.totalPages}</span>
                <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 text-sm font-black disabled:opacity-40">›</button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-3 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}>
          <form onSubmit={submit} className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between"><h2 className="text-xl font-black">{editingId ? text.edit : text.create}</h2><button type="button" onClick={closeModal} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div>
            {error ? <div role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">{text.code}<input required dir="ltr" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") }))} minLength={3} maxLength={32} className="mt-2 h-11 w-full rounded-xl border px-3 text-left uppercase" /></label>
              <label className="text-sm font-bold">{text.campaign}<input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={120} className="mt-2 h-11 w-full rounded-xl border px-3" /></label>
              <label className="sm:col-span-2 text-sm font-bold">{text.description}<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={500} rows={2} className="mt-2 w-full rounded-xl border p-3" /></label>
              <label className="text-sm font-bold">{text.discount}<div className="mt-2 flex"><select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} className="h-11 rounded-s-xl border px-3"><option value="percent">{text.percent}</option><option value="fixed">{text.fixed}</option></select><input required type="number" min="0.01" max={form.type === "percent" ? 90 : undefined} step="0.01" value={form.discountValue} onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))} className="h-11 min-w-0 flex-1 rounded-e-xl border px-3" /></div></label>
              <label className="text-sm font-bold">{text.minimum}<input type="number" min="0" step="0.01" value={form.minimumPurchaseUsd} onChange={(event) => setForm((current) => ({ ...current, minimumPurchaseUsd: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border px-3" /></label>
              <label className="text-sm font-bold">{text.limit}<input type="number" min="1" placeholder={text.unlimited} value={form.usageLimit} onChange={(event) => setForm((current) => ({ ...current, usageLimit: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border px-3" /></label>
              <label className="text-sm font-bold">{text.perUser}<input required type="number" min="1" max="100" value={form.perUserLimit} onChange={(event) => setForm((current) => ({ ...current, perUserLimit: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border px-3" /></label>
              <label className="text-sm font-bold">{text.starts}<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border px-3" /></label>
              <label className="text-sm font-bold">{text.expires}<input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border px-3" /></label>
              <label className="text-sm font-bold">{text.status}<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border px-3"><option value="active">{text.active}</option><option value="inactive">{text.inactive}</option></select></label>
              <div className="sm:col-span-2"><p className="text-sm font-bold">{text.courses}</p><p className="mt-1 text-xs text-slate-500">{text.allCourses}</p><div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">{courses.map((course) => { const id = String(course._id); return <label key={id} className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.courseIds.includes(id)} onChange={() => setForm((current) => ({ ...current, courseIds: current.courseIds.includes(id) ? current.courseIds.filter((value) => value !== id) : [...current.courseIds, id] }))} /> <span className="truncate">{course.title}</span></label>; })}</div></div>
            </div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeModal} className="h-11 rounded-xl border px-5 text-sm font-black">{text.cancel}</button><button disabled={saving} className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60">{saving ? text.saving : text.save}</button></div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
