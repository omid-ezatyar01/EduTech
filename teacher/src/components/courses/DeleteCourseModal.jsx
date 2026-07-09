import { AlertTriangle, X } from "lucide-react";

export default function DeleteCourseModal({ open, course, onClose, onConfirm, language, isRTL }) {
  if (!open || !course) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/55 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-[#0F172A]">{language === "fa" ? "حذف کورس" : "Delete Course"}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl bg-red-50 p-3">
          <AlertTriangle className="text-[#EF4444]" size={18} />
          <p className="text-sm font-semibold text-slate-700">
            {language === "fa"
              ? "آیا مطمئن هستید که می‌خواهید این کورس را حذف کنید؟ این عمل قابل برگشت نیست."
              : "Are you sure you want to delete this course? This action cannot be undone."}
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="h-11 flex-1 rounded-xl border border-[#E2E8F0] bg-white text-sm font-bold text-slate-700">{language === "fa" ? "لغو" : "Cancel"}</button>
          <button onClick={() => onConfirm(course.id)} className="h-11 flex-1 rounded-xl bg-[#EF4444] text-sm font-bold text-white">{language === "fa" ? "حذف کورس" : "Delete Course"}</button>
        </div>
      </div>
    </div>
  );
}
