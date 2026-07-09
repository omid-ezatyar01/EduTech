import { useState } from "react";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  course: "توسعه MERN Stack",
  note: "",
};

export default function AddStudentModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState(initialForm);

  if (!open) {
    return null;
  }

  const updateField = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form);
    setForm(initialForm);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-3" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
      >
        <h3 className="text-xl font-black text-slate-900">افزودن شاگرد به کورس</h3>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">نام کامل شاگرد</span>
            <input
              required
              value={form.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
              className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">ایمیل شاگرد</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">شماره تماس</span>
            <input
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">انتخاب کورس</span>
            <select
              value={form.course}
              onChange={(event) => updateField("course", event.target.value)}
              className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]"
            >
              <option>توسعه MERN Stack</option>
              <option>Backend API Development</option>
            </select>
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">یادداشت اختیاری</span>
            <textarea
              value={form.note}
              onChange={(event) => updateField("note", event.target.value)}
              rows={4}
              className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#0B4FD8]"
            />
          </label>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-600"
          >
            لغو
          </button>
          <button
            type="submit"
            className="h-11 rounded-xl bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9] text-sm font-bold text-white"
          >
            ارسال دعوت‌نامه
          </button>
        </div>
      </form>
    </div>
  );
}
