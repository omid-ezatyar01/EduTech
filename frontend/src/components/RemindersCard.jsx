import { Plus, CheckCircle2 } from "lucide-react";

export default function RemindersCard({
  reminders,
  onAddReminder,
  language = "fa",
}) {
  const isFa = language === "fa";
  return (
    <div
      className={`flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm ${
        isFa ? "text-right" : "text-left"
      }`}
    >
      <h3 className="mb-5 text-lg font-black text-slate-950">
        {isFa ? "یادآوری‌ها" : "Reminders"}
      </h3>

      <div className="mb-6 flex-1 space-y-4">
        {reminders.map((reminder, idx) => {
          // Mocking different colors based on index
          const colorClass =
            idx === 0
              ? "text-primary-500"
              : idx === 1
                ? "text-green-500"
                : "text-amber-500";
          return (
            <div key={idx} className="flex items-start gap-3">
              <CheckCircle2
                size={20}
                className={`mt-0.5 shrink-0 ${colorClass}`}
              />
              <p className="text-sm font-semibold text-slate-700 leading-6">
                {reminder}
              </p>
            </div>
          );
        })}
      </div>

      <button
        onClick={onAddReminder}
        className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-100 hover:border-slate-400"
      >
        <Plus size={18} />
        {isFa ? "افزودن یادآوری" : "Add Reminder"}
      </button>
    </div>
  );
}
