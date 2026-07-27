import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Headphones,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  TicketCheck,
  UserX,
  UsersRound,
} from "lucide-react";
import { useAdminI18n } from "../../../i18n/AdminI18nContext.jsx";
import {
  createSupportStaff,
  fetchSupportStaff,
  resetSupportStaffPassword,
  updateSupportStaff,
} from "../services/supportStaffAdminService.js";
import {
  SUPPORT_SPECIALIZATIONS,
  supportSpecializationLabel,
} from "../supportStaffRoles.js";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  specialization: "general",
};

export default function SupportStaffAccountsPage() {
  const { language } = useAdminI18n();
  const isFa = language === "fa";
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [specialization, setSpecialization] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const query = useMemo(
    () => ({ search, status, specialization }),
    [search, specialization, status],
  );
  const summary = useMemo(
    () => ({
      active: staff.filter((row) => row.status === "active").length,
      blocked: staff.filter((row) => row.status === "blocked").length,
      tickets: staff.reduce(
        (sum, row) => sum + Number(row.activeTickets || 0),
        0,
      ),
    }),
    [staff],
  );
  const load = useCallback(async () => {
    const data = await fetchSupportStaff(query);
    setStaff(Array.isArray(data.staff) ? data.staff : []);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch((err) => setError(err.message)).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError(isFa ? "رمزهای عبور یکسان نیستند." : "Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        specialization: form.specialization,
      };
      await createSupportStaff(payload);
      setForm(EMPTY_FORM);
      setNotice(isFa ? "حساب کارمند پشتیبانی ایجاد شد." : "Support account created.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (row) => {
    setBusy(true);
    setError("");
    try {
      await updateSupportStaff(row.id, {
        status: row.status === "active" ? "blocked" : "active",
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changeSpecialization = async (row, nextSpecialization) => {
    setBusy(true);
    setError("");
    try {
      await updateSupportStaff(row.id, {
        specialization: nextSpecialization,
      });
      await load();
      setNotice(
        isFa
          ? "نقش تخصصی کارمند به‌روزرسانی شد."
          : "Staff specialization updated.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (!resetTarget) return;
    if (newPassword !== confirmNewPassword) {
      setError(isFa ? "رمزهای عبور یکسان نیستند." : "Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await resetSupportStaffPassword(resetTarget.id, newPassword);
      setResetTarget(null);
      setNewPassword("");
      setConfirmNewPassword("");
      setNotice(
        isFa
          ? "رمز عبور تغییر کرد و نشست‌های قبلی بسته شدند."
          : "Password reset and existing sessions revoked.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-950">
          <Headphones className="text-[#0B4FD8]" />
          {isFa ? "حساب‌های تیم پشتیبانی" : "Support Team Accounts"}
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {isFa
            ? "حساب‌های جداگانه برای کارمندانی که فقط به تکت‌های پشتیبانی دسترسی دارند."
            : "Separate staff accounts with access limited to the support workspace."}
        </p>
      </header>

      {error ? <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{notice}</div> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={UsersRound}
          label={isFa ? "کارمندان فعال" : "Active staff"}
          value={summary.active}
          color="blue"
        />
        <SummaryCard
          icon={TicketCheck}
          label={isFa ? "تکت‌های در حال کار" : "Assigned active tickets"}
          value={summary.tickets}
          color="teal"
        />
        <SummaryCard
          icon={UserX}
          label={isFa ? "حساب‌های مسدود" : "Blocked accounts"}
          value={summary.blocked}
          color="red"
        />
      </div>

      <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-black text-slate-900">
          <Plus size={18} /> {isFa ? "ایجاد حساب جدید" : "Create a new account"}
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input label={isFa ? "نام" : "Name"} value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Input label={isFa ? "ایمیل" : "Email"} type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
          <Input label={isFa ? "شماره تماس" : "Phone"} value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <Input label={isFa ? "رمز عبور اولیه" : "Initial password"} type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
          <Input label={isFa ? "تکرار رمز عبور" : "Confirm password"} type="password" value={form.confirmPassword} onChange={(confirmPassword) => setForm({ ...form, confirmPassword })} />
          <label className="block text-xs font-bold text-slate-600">
            <span className="mb-1.5 block">
              {isFa ? "نقش تخصصی پشتیبانی" : "Support specialization"}
            </span>
            <select
              value={form.specialization}
              onChange={(event) =>
                setForm({ ...form, specialization: event.target.value })
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-500"
            >
              {SUPPORT_SPECIALIZATIONS.map((value) => (
                <option key={value} value={value}>
                  {supportSpecializationLabel(value, isFa ? "fa" : "en")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-500">
          {isFa
            ? "حداقل ۸ حرف، شامل حرف بزرگ، حرف کوچک و عدد."
            : "Minimum 8 characters with uppercase, lowercase, and a number."}
        </p>
        <button disabled={busy} className="mt-4 rounded-xl bg-[#0B4FD8] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
          {isFa ? "ایجاد حساب" : "Create account"}
        </button>
      </form>

      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-3 border-b p-4">
          <label className="relative min-w-64 flex-1">
            <Search className="absolute start-3 top-3 text-slate-400" size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isFa ? "جستجوی نام، ایمیل یا تماس" : "Search name, email, or phone"} className="w-full rounded-xl border border-slate-200 py-2.5 pe-3 ps-10 text-sm outline-none focus:border-blue-500" />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 px-3 text-sm font-bold">
            <option value="all">{isFa ? "همه وضعیت‌ها" : "All statuses"}</option>
            <option value="active">{isFa ? "فعال" : "Active"}</option>
            <option value="blocked">{isFa ? "مسدود" : "Blocked"}</option>
          </select>
          <select value={specialization} onChange={(event) => setSpecialization(event.target.value)} className="rounded-xl border border-slate-200 px-3 text-sm font-bold">
            <option value="all">{isFa ? "همه نقش‌ها" : "All specializations"}</option>
            {SUPPORT_SPECIALIZATIONS.map((value) => (
              <option key={value} value={value}>
                {supportSpecializationLabel(value, isFa ? "fa" : "en")}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>{[isFa ? "کارمند" : "Staff member", isFa ? "نقش تخصصی" : "Specialization", isFa ? "تماس" : "Contact", isFa ? "حجم کار" : "Workload", isFa ? "وضعیت" : "Status", isFa ? "ایجاد شده" : "Created", isFa ? "عملیات" : "Actions"].map((label) => <th key={label} className="px-4 py-3 text-start font-black">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={7} className="p-10 text-center font-bold text-slate-400">...</td></tr> : staff.length === 0 ? <tr><td colSpan={7} className="p-10 text-center font-bold text-slate-500">{isFa ? "حسابی یافت نشد." : "No support accounts found."}</td></tr> : staff.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3"><p className="font-black text-slate-900">{row.name}</p><p className="text-xs font-semibold text-slate-500">{row.email}</p></td>
                  <td className="px-4 py-3">
                    <select
                      value={row.specialization || "general"}
                      disabled={busy || row.status === "blocked"}
                      onChange={(event) =>
                        changeSpecialization(row, event.target.value)
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-black text-slate-700"
                    >
                      {SUPPORT_SPECIALIZATIONS.map((value) => (
                        <option key={value} value={value}>
                          {supportSpecializationLabel(value, isFa ? "fa" : "en")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{row.phone}</td>
                  <td className="px-4 py-3"><p className="font-black text-slate-800">{Number(row.activeTickets || 0)} {isFa ? "فعال" : "active"}</p></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{row.status === "active" ? (isFa ? "فعال" : "Active") : (isFa ? "مسدود" : "Blocked")}</span></td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-500">{new Date(row.createdAt).toLocaleDateString(isFa ? "fa-AF" : "en-US")}</td>
                  <td className="px-4 py-3"><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => { setResetTarget(row); setNewPassword(""); setConfirmNewPassword(""); }} className="rounded-lg bg-blue-50 p-2 text-blue-700" title={isFa ? "تغییر رمز" : "Reset password"}><KeyRound size={16} /></button><button type="button" disabled={busy} onClick={() => toggleStatus(row)} className={`rounded-lg p-2 ${row.status === "active" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`} title={row.status === "active" ? (isFa ? "مسدود کردن" : "Block") : (isFa ? "فعال کردن" : "Activate")}>{row.status === "active" ? <UserX size={16} /> : <ShieldCheck size={16} />}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {resetTarget ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"><form onSubmit={resetPassword} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-black">{isFa ? "تغییر رمز عبور" : "Reset password"}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{resetTarget.name} · {resetTarget.email}</p><div className="mt-4 space-y-3"><Input label={isFa ? "رمز جدید" : "New password"} type="password" value={newPassword} onChange={setNewPassword} /><Input label={isFa ? "تکرار رمز جدید" : "Confirm new password"} type="password" value={confirmNewPassword} onChange={setConfirmNewPassword} /></div><div className="mt-5 flex gap-2"><button disabled={busy} className="rounded-xl bg-[#0B4FD8] px-4 py-2 text-sm font-black text-white">{isFa ? "ذخیره" : "Save"}</button><button type="button" onClick={() => setResetTarget(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">{isFa ? "لغو" : "Cancel"}</button></div></form></div> : null}
    </section>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return <label className="block text-xs font-bold text-slate-600"><span className="mb-1.5 block">{label}</span><input required type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></label>;
}

function SummaryCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${colors[color]}`}>
        <Icon size={20} />
      </span>
      <span>
        <strong className="block text-xl font-black text-slate-950">{value}</strong>
        <span className="text-xs font-bold text-slate-500">{label}</span>
      </span>
    </article>
  );
}
