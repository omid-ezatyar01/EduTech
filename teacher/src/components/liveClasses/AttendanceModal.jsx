import { useEffect, useState } from "react";

export default function AttendanceModal({ open, classInfo, attendees, onClose, onSave, language = "fa" }) {
  const [rows, setRows] = useState(() => attendees || []);
  const [saving, setSaving] = useState(false);
  const isFa = language === "fa";
  const options = [
    { value: "present", label: isFa ? "حاضر" : "Present" },
    { value: "absent", label: isFa ? "غایب" : "Absent" },
  ];

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

  const submit = async (event) => {
    event.preventDefault();
    if (saving || !rows.length) return;
    try {
      setSaving(true);
      await onSave(rows);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/60 p-3" onClick={() => { if (!saving) onClose(); }}>
      <form onSubmit={submit} onClick={(event) => event.stopPropagation()} className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <h3 className="text-xl font-black text-[#0F172A]">{isFa ? "مدیریت حضور صنف" : "Manage attendance"}</h3>
        <p className="mt-1 text-sm text-slate-600">{classInfo.course} - {classInfo.topic}</p>

        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <div key={row.studentId} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2E8F0] p-2.5">
              <img src={row.avatar || "/logo.png"} alt={row.name} className="h-10 w-10 rounded-full object-cover" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/logo.png"; }} />
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
        {!rows.length ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500">
            {isFa ? "شاگردی برای ثبت حضور وجود ندارد." : "There are no students to mark."}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={onClose} disabled={saving} className="h-11 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-700 disabled:opacity-60">{isFa ? "لغو" : "Cancel"}</button>
          <button type="submit" disabled={saving || !rows.length} className="h-11 rounded-xl bg-[#0B4FD8] text-sm font-bold text-white disabled:opacity-60">{saving ? (isFa ? "در حال ذخیره…" : "Saving…") : (isFa ? "ذخیره حضور" : "Save attendance")}</button>
        </div>
      </form>
    </div>
  );
}
