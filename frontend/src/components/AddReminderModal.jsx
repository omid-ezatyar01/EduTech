import { X, CalendarDays, Clock, BellRing } from "lucide-react";

export default function AddReminderModal({ isOpen, onClose, language = "fa" }) {
  const isFa = language === "fa";
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute left-6 top-6 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={24} />
        </button>

        <h2 className="text-xl font-black text-slate-950 mb-6">
          {isFa ? "افزودن یادآوری جدید" : "Add New Reminder"}
        </h2>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onClose();
          }}
        >
          <div>
            <label className="text-xs font-bold text-slate-700 mb-1.5 block">
              {isFa ? "عنوان یادآوری" : "Reminder Title"}
            </label>
            <div className="relative flex items-center">
              <BellRing size={18} className="absolute start-4 text-slate-400" />
              <input
                type="text"
                placeholder={
                  isFa
                    ? "مثلاً: حل تمرین گرامر"
                    : "e.g. Finish grammar homework"
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pe-4 ps-11 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                {isFa ? "تاریخ" : "Date"}
              </label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                {isFa ? "وقت" : "Time"}
              </label>
              <input
                type="time"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-primary-600 py-3.5 text-sm font-black text-white shadow-glow transition hover:bg-primary-700 hover:-translate-y-0.5"
          >
            {isFa ? "ذخیره" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
