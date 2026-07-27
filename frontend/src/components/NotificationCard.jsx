import { Bell, Info } from "lucide-react";
import { Link } from "react-router";

export default function NotificationCard({ title, text, time, isNew, to = "/student/notifications" }) {
  return (
    <Link
      to={to}
      className={`flex min-w-0 gap-3 rounded-xl border p-4 transition hover:border-primary-100 hover:bg-primary-50/40 ${isNew ? "border-primary-100 bg-primary-50/50" : "border-slate-100 bg-white"}`}
    >
      <div
        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isNew ? "bg-primary-100 text-primary-600" : "bg-slate-100 text-slate-500"}`}
      >
        {isNew ? <Bell size={18} /> : <Info size={18} />}
      </div>
      <div>
        {title ? <p className="mb-1 line-clamp-1 text-xs font-black text-slate-900">{title}</p> : null}
        <p
          className={`text-sm leading-6 ${isNew ? "font-black text-slate-900" : "font-bold text-slate-700"}`}
        >
          {text}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-400">{time}</p>
      </div>
    </Link>
  );
}
