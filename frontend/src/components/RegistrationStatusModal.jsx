import { X, CheckCircle2, Circle } from "lucide-react";

export default function RegistrationStatusModal({
  isOpen,
  onClose,
  course,
  language = "fa",
}) {
  if (!isOpen || !course) return null;
  const isFa = language === "fa";

  const steps = isFa
    ? [
        { label: "درخواست ثبت‌نام ارسال شد", completed: true },
        { label: "بررسی توسط ادمین", completed: false, current: true },
        { label: "تایید ثبت‌نام", completed: false },
        { label: "فعال شدن کورس در داشبورد", completed: false },
      ]
    : [
        { label: "Enrollment request submitted", completed: true },
        { label: "Review by admin", completed: false, current: true },
        { label: "Enrollment approval", completed: false },
        { label: "Course activated in dashboard", completed: false },
      ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      dir={isFa ? "rtl" : "ltr"}
    >
      <div className="relative w-full max-w-md animate-in zoom-in-95 rounded-[32px] bg-white p-6 shadow-2xl duration-200">
        <button
          onClick={onClose}
          className={`absolute top-6 text-slate-400 transition hover:text-slate-600 ${
            isFa ? "left-6" : "right-6"
          }`}
        >
          <X size={24} />
        </button>

        <h2 className="text-xl font-black text-slate-950 mb-2">
          {isFa ? "جزئیات ثبت‌نام" : "Enrollment Details"}
        </h2>
        <p className="text-sm font-semibold text-slate-500 mb-8 leading-6">
          {isFa ? "کورس " : "Course "}
          <span className="text-slate-800 font-black">{course.title}</span>{" "}
          {isFa ? "در انتظار تایید ادمین است." : "is pending admin approval."}
        </p>

        <div className="space-y-6 relative mb-8">
          <div
            className={`absolute top-2 bottom-2 w-0.5 bg-slate-100 ${
              isFa ? "right-[11px]" : "left-[11px]"
            }`}
          />
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-4 relative z-10">
              <div className="bg-white">
                {step.completed ? (
                  <CheckCircle2 className="text-green-500" size={24} />
                ) : step.current ? (
                  <div className="h-6 w-6 rounded-full border-4 border-amber-500 bg-white" />
                ) : (
                  <Circle className="text-slate-300" size={24} />
                )}
              </div>
              <span
                className={`text-sm font-bold ${step.completed || step.current ? "text-slate-900" : "text-slate-400"}`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-slate-100 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
        >
          {isFa ? "بستن" : "Close"}
        </button>
      </div>
    </div>
  );
}
