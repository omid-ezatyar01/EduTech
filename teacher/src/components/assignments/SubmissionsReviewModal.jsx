import { useState } from "react";

const initialRows = [
  { id: 1, name: "امید عزتیار", avatar: "https://i.pravatar.cc/150?img=12", submittedDate: "1403/08/21", file: "project.zip", status: "ارسال شده", grade: "85", feedback: "" },
  { id: 2, name: "فاطمه نوری", avatar: "https://i.pravatar.cc/150?img=32", submittedDate: "1403/08/21", file: "api.pdf", status: "ارسال شده", grade: "92", feedback: "" },
  { id: 3, name: "محمد یوسف", avatar: "https://i.pravatar.cc/150?img=15", submittedDate: "1403/08/22", file: "mongo.docx", status: "دیر ارسال شده", grade: "70", feedback: "" },
];

export default function SubmissionsReviewModal({ open, assignment, onClose, onSave }) {
  const [rows, setRows] = useState(initialRows);

  if (!open || !assignment) {
    return null;
  }

  const update = (id, key, value) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-3" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <h3 className="text-xl font-black text-[#0F172A]">بررسی تسلیمی‌ها</h3>
        <p className="mt-1 text-sm text-slate-600">{assignment.title}</p>

        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-[#E2E8F0] p-3">
              <div className="flex flex-wrap items-center gap-3">
                <img src={row.avatar} alt={row.name} className="h-10 w-10 rounded-full object-cover" />
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{row.name}</p>
                <span className="text-xs text-slate-500">{row.submittedDate}</span>
                <span className="text-xs font-semibold text-[#0B4FD8]">{row.file}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{row.status}</span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input value={row.grade} onChange={(e) => update(row.id, "grade", e.target.value)} placeholder="نمره" className="h-10 rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]" />
                <textarea value={row.feedback} onChange={(e) => update(row.id, "feedback", e.target.value)} placeholder="بازخورد" rows={2} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#0B4FD8]" />
              </div>

              <button type="button" onClick={() => onSave(rows)} className="mt-3 rounded-lg bg-[#0B4FD8] px-3 py-1.5 text-xs font-bold text-white">Save grade</button>
            </article>
          ))}
        </div>

        <button type="button" onClick={onClose} className="mt-4 h-10 rounded-xl border border-[#E2E8F0] px-4 text-sm font-semibold text-slate-700">بستن</button>
      </div>
    </div>
  );
}
