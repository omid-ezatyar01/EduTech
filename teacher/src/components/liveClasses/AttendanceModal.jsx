import { useEffect, useState } from "react";

const options = [
  { value: "present", label: "حاضر" },
  { value: "absent", label: "غایب" },
];

export default function AttendanceModal({ open, classInfo, attendees, onClose, onSave }) {
  const [rows, setRows] = useState(() => attendees || []);

  useEffect(() => {
    const timer = setTimeout(() => setRows(attendees || []), 0);
    return () => clearTimeout(timer);
  }, [attendees, open]);

  if (!open || !classInfo) {
    return null;
  }

  const updateStatus = (studentId, status) => {
    setRows((prev) => prev.map((row) => (row.studentId === studentId ? { ...row, status } : row)));
  };

  const submit = (event) => {
    event.preventDefault();
    onSave(rows);
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/60 p-3" onClick={onClose}>
      <form onSubmit={submit} onClick={(event) => event.stopPropagation()} className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <h3 className="text-xl font-black text-[#0F172A]">مدیریت حضور صنف</h3>
        <p className="mt-1 text-sm text-slate-600">{classInfo.course} - {classInfo.topic}</p>

        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <div key={row.studentId} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2E8F0] p-2.5">
              <img src={row.avatar || "/logo.png"} alt={row.name} className="h-10 w-10 rounded-full object-cover" />
              <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{row.name}</p>
              <select value={row.status} onChange={(e) => updateStatus(row.studentId, e.target.value)} className="h-9 rounded-lg border border-[#E2E8F0] px-2 text-xs font-semibold outline-none focus:border-[#0B4FD8]">
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-700">لغو</button>
          <button type="submit" className="h-11 rounded-xl bg-[#0B4FD8] text-sm font-bold text-white">ذخیره حضور</button>
        </div>
      </form>
    </div>
  );
}
