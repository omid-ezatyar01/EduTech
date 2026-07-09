import { useState } from "react";

const initialForm = {
  title: "",
  course: "MERN Stack",
  type: "تمرین",
  deadline: "",
  time: "",
  description: "",
  file: "",
  score: "100",
  status: "active",
  allowFile: true,
  notifyStudents: true,
  lateSubmit: false,
  autoReview: false,
};

export default function CreateAssignmentModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState(initialForm);

  if (!open) {
    return null;
  }

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (event) => {
    event.preventDefault();
    onSubmit(form);
    setForm(initialForm);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-3" onClick={onClose}>
      <form onSubmit={submit} onClick={(event) => event.stopPropagation()} className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <h3 className="text-xl font-black text-[#0F172A]">ایجاد تمرین جدید</h3>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-slate-600">عنوان تمرین</span>
            <input value={form.title} required onChange={(e) => setField("title", e.target.value)} placeholder="مثلاً تمرین API و امنیت" className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">انتخاب کورس</span>
            <select value={form.course} onChange={(e) => setField("course", e.target.value)} className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]">
              <option>MERN Stack</option>
              <option>Backend API Development</option>
              <option>Python Programming</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">نوع تمرین</span>
            <select value={form.type} onChange={(e) => setField("type", e.target.value)} className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]">
              <option>تمرین</option>
              <option>پروژه</option>
              <option>کوییز</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">مهلت تحویل</span>
            <input type="date" value={form.deadline} required onChange={(e) => setField("deadline", e.target.value)} className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">زمان تحویل</span>
            <input type="time" value={form.time} required onChange={(e) => setField("time", e.target.value)} className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]" />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-slate-600">توضیحات</span>
            <textarea rows={4} value={form.description} onChange={(e) => setField("description", e.target.value)} className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#0B4FD8]" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">فایل ضمیمه</span>
            <input value={form.file} onChange={(e) => setField("file", e.target.value)} placeholder="نام فایل" className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">نمره کامل</span>
            <input value={form.score} onChange={(e) => setField("score", e.target.value)} className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">وضعیت</span>
            <select value={form.status} onChange={(e) => setField("status", e.target.value)} className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]">
              <option value="draft">پیش‌نویس</option>
              <option value="active">فعال</option>
            </select>
          </label>
        </div>

        <div className="mt-4 space-y-2 text-sm font-semibold text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.allowFile} onChange={(e) => setField("allowFile", e.target.checked)} /> اجازه ارسال فایل</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.notifyStudents} onChange={(e) => setField("notifyStudents", e.target.checked)} /> ارسال اعلان به شاگردان</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.lateSubmit} onChange={(e) => setField("lateSubmit", e.target.checked)} /> اجازه ارسال بعد از مهلت</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.autoReview} onChange={(e) => setField("autoReview", e.target.checked)} /> بررسی خودکار برای کوییز</label>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-700">لغو</button>
          <button type="submit" className="h-11 rounded-xl bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9] text-sm font-bold text-white">ایجاد تمرین</button>
        </div>
      </form>
    </div>
  );
}
