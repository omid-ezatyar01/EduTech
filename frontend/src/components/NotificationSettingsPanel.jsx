import { Bell } from "lucide-react";
import { useState } from "react";

export default function NotificationSettingsPanel({
  data,
  onOpenModal,
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    updated: isFa
      ? "تنظیمات اعلان‌ها به‌روزرسانی شد"
      : "Notification settings updated",
    course: isFa ? "اعلان‌های کورس و صنف" : "Course and class notifications",
    assignments: isFa ? "یادآوری تمرین‌ها" : "Assignment reminders",
    payments: isFa ? "اعلان‌های پرداخت" : "Payment notifications",
    news: isFa ? "اخبار و پیشنهادها" : "News and suggestions",
    important: isFa ? "پیام‌های مهم" : "Important messages",
    title: isFa ? "اعلان‌ها" : "Notifications",
    manageAll: isFa ? "مدیریت همه اعلان‌ها" : "Manage All Notifications",
  };

  const [toggles, setToggles] = useState({
    course: data.course ?? true,
    assignments: data.assignments ?? true,
    payments: data.payments ?? true,
    news: data.news ?? false,
    important: data.important ?? true,
  });
  const [toastMsg, setToastMsg] = useState("");

  const handleToggle = (key) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
    setToastMsg(t.updated);
    setTimeout(() => setToastMsg(""), 2000);
  };

  const items = [
    { key: "course", label: t.course },
    { key: "assignments", label: t.assignments },
    { key: "payments", label: t.payments },
    { key: "news", label: t.news },
    { key: "important", label: t.important },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
          <Bell className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-black text-slate-900">{t.title}</h3>
      </div>
      <div className="space-y-4 mb-6">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              {item.label}
            </span>
            <button
              onClick={() => handleToggle(item.key)}
              className={`relative h-6 w-11 rounded-full transition-colors ${toggles[item.key] ? "bg-teal-500" : "bg-slate-200"}`}
            >
              <span
                className={`absolute top-1 bottom-1 w-4 rounded-full bg-white transition-all ${toggles[item.key] ? "left-1" : "left-6"}`}
              />
            </button>
          </div>
        ))}
      </div>
      {toastMsg && (
        <div className="mb-4 text-xs font-bold text-teal-600 bg-teal-50 p-2 rounded text-center">
          {toastMsg}
        </div>
      )}
      <button
        type="button"
        onClick={onOpenModal}
        className="mt-4 flex w-full items-center justify-center rounded-xl bg-slate-50 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-100"
      >
        {t.manageAll}
      </button>
    </div>
  );
}
