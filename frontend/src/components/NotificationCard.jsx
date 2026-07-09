import { Bell, Info } from "lucide-react";

export default function NotificationCard({ text, time, isNew }) {
  return (
    <div
      className={`flex gap-4 rounded-xl p-4 transition hover:bg-slate-50 ${isNew ? "bg-primary-50/50" : ""}`}
    >
      <div
        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isNew ? "bg-primary-100 text-primary-600" : "bg-slate-100 text-slate-500"}`}
      >
        {isNew ? <Bell size={18} /> : <Info size={18} />}
      </div>
      <div>
        <p
          className={`text-sm leading-6 ${isNew ? "font-black text-slate-900" : "font-bold text-slate-700"}`}
        >
          {text}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-400">{time}</p>
      </div>
    </div>
  );
}
