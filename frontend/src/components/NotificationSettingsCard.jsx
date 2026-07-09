import { Bell, BellRing } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotificationSettingsCard({ language = "fa" }) {
  const isFa = language === "fa";
  return (
    <div
      className={`flex h-full flex-col rounded-[24px] border border-slate-200 bg-slate-50 p-6 shadow-sm ${
        isFa ? "text-right" : "text-left"
      }`}
    >
      <h3 className="mb-5 text-lg font-black text-slate-950">
        {isFa ? "اعلان‌ها" : "Notifications"}
      </h3>
      <div className="mb-6 flex flex-1 items-start gap-2 text-sm font-semibold leading-6 text-slate-600">
        <BellRing size={18} className="mt-0.5 shrink-0 text-amber-500" />
        <p>
          {isFa
            ? "برای دریافت یادآوری‌ها، اعلان‌ها را فعال کنید."
            : "Enable notifications to receive reminders."}
        </p>
      </div>
      <Link
        to="/student/profile"
        className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-black text-slate-800 transition hover:bg-slate-100 shadow-sm"
      >
        <Bell size={18} className="text-primary-600" />
        {isFa ? "تنظیمات اعلان‌ها" : "Notification Settings"}
      </Link>
    </div>
  );
}
