import { Bell } from "lucide-react";
import { useState } from "react";

export default function ProfileNotificationsCard({ initialSettings }) {
  const [settings, setSettings] = useState(initialSettings);

  const toggles = [
    { key: "course", label: "اعلان‌های کورس و صنف" },
    { key: "assignments", label: "یادآوری تمرین‌ها" },
    { key: "payments", label: "اعلان‌های پرداخت" },
    { key: "news", label: "اخبار و پیشنهادها" },
    { key: "important", label: "پیام‌های مهم" },
  ];

  const toggleSetting = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <Bell size={20} />
        </div>
        <h3 className="text-lg font-black text-slate-950">تنظیمات اعلان‌ها</h3>
      </div>
      <div className="space-y-4">
        {toggles.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0"
          >
            <span className="text-sm font-bold text-slate-700">
              {item.label}
            </span>
            <button
              onClick={() => toggleSetting(item.key)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings[item.key] ? "bg-teal-500" : "bg-slate-200"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings[item.key] ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>
        ))}
      </div>
      <button className="mt-4 flex w-full items-center justify-center rounded-xl bg-slate-50 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-100">
        مدیریت همه اعلان‌ها
      </button>
    </div>
  );
}
