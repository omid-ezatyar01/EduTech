import { X, Bell } from "lucide-react";
import { useState } from "react";

export default function NotificationManagementModal({
  isOpen,
  onClose,
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "مدیریت اعلان‌ها" : "Manage Notifications",
    email: isFa ? "اعلان‌های ایمیلی" : "Email Notifications",
    system: isFa ? "اعلان‌های داخل سیستم" : "In-app Notifications",
    sms: isFa ? "اعلان‌های پیامکی" : "SMS Notifications",
    classReminders: isFa ? "یادآوری‌های صنف" : "Class Reminders",
    assignmentReminders: isFa ? "یادآوری تمرین‌ها" : "Assignment Reminders",
    cancel: isFa ? "لغو" : "Cancel",
    save: isFa ? "ذخیره تنظیمات" : "Save Settings",
  };

  const [toggles, setToggles] = useState({
    email: true,
    system: true,
    sms: false,
    classReminders: true,
    assignmentReminders: true,
  });

  if (!isOpen) return null;

  const handleToggle = (key) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const items = [
    { key: "email", label: t.email },
    { key: "system", label: t.system },
    { key: "sms", label: t.sms },
    { key: "classReminders", label: t.classReminders },
    { key: "assignmentReminders", label: t.assignmentReminders },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      dir={isFa ? "rtl" : "ltr"}
    >
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            {t.title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
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
        <div className="border-t border-slate-100 p-6 bg-slate-50 rounded-b-2xl flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 transition"
          >
            {t.cancel}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-black text-white shadow-sm hover:bg-primary-700 transition"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
