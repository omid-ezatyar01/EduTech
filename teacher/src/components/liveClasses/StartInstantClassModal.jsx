import { useState } from "react";

const initialForm = {
  course: "MERN Stack",
  topic: "",
  meetLink: "",
};

export default function StartInstantClassModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState(initialForm);

  if (!open) {
    return null;
  }

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form);
    setForm(initialForm);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-3" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={(event) => event.stopPropagation()} className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <h3 className="text-xl font-black text-[#0F172A]">شروع صنف فوری</h3>

        <div className="mt-4 space-y-3">
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">انتخاب کورس</span>
            <select value={form.course} onChange={(e) => setField("course", e.target.value)} className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]">
              <option>MERN Stack</option>
              <option>Backend API Development</option>
              <option>Python Programming</option>
              <option>UI/UX Design</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">موضوع کوتاه</span>
            <input value={form.topic} required onChange={(e) => setField("topic", e.target.value)} className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]" />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">لینک Google Meet</span>
            <input value={form.meetLink} required onChange={(e) => setField("meetLink", e.target.value)} className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]" />
          </label>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-700">لغو</button>
          <button type="submit" className="h-11 rounded-xl bg-[#0B4FD8] text-sm font-bold text-white">شروع صنف</button>
        </div>
      </form>
    </div>
  );
}
