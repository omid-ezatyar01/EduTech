import { useState } from "react";

const tabs = ["خلاصه", "تسلیمی‌ها", "نمرات", "بازخوردها"];

export default function AssignmentDetailsModal({ open, item, onClose, onReview, onAnnouncement }) {
  const [tab, setTab] = useState("خلاصه");

  if (!open || !item) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-3" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <h3 className="text-xl font-black text-[#0F172A]">جزئیات تمرین</h3>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold ${
                tab === name ? "border-[#0B4FD8] bg-[#0B4FD8] text-white" : "border-[#E2E8F0] text-slate-600"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm sm:grid-cols-2">
          <Info label="عنوان" value={item.title} />
          <Info label="کورس" value={item.course} />
          <Info label="نوع" value={item.type} />
          <Info label="وضعیت" value={item.statusLabel} />
          <Info label="مهلت" value={`${item.deadline} (${item.deadlineNote})`} />
          <Info label="تسلیمی" value={item.submitted} />
          <Info label="بررسی شده" value={String(item.reviewed)} />
          <Info label="فایل ضمیمه" value="assignment.pdf" />
          <Info label="توضیحات" value={item.description} wide />
          <Info label="دستورالعمل" value="پروژه را با رعایت معیارهای امنیتی و مستندسازی کامل تحویل دهید." wide />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <button type="button" className="h-10 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-700">ویرایش</button>
          <button type="button" onClick={() => onReview(item)} className="h-10 rounded-xl border border-[#0B4FD8] text-sm font-semibold text-[#0B4FD8]">بررسی تسلیمی‌ها</button>
          <button type="button" onClick={() => onAnnouncement(item)} className="h-10 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-700">ارسال اعلان</button>
          <button type="button" onClick={onClose} className="h-10 rounded-xl bg-slate-900 text-sm font-semibold text-white">بستن</button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, wide = false }) {
  return (
    <div className={`rounded-lg bg-white p-3 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-800">{value}</p>
    </div>
  );
}
