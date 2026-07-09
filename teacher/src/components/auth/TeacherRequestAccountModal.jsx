import { X, Mail, Phone, Headphones } from "lucide-react";

export default function TeacherRequestAccountModal({ isOpen, onClose, language, isRTL }) {
  if (!isOpen) return null;

  const t = {
    title: language === "fa" ? "درخواست حساب مدرس" : "Teacher Account Request",
    body:
      language === "fa"
        ? "حساب مدرس توسط ادمین EduTech ساخته می‌شود. اگر مدرس هستید و حساب ندارید، لطفاً با مدیریت یا پشتیبانی تماس بگیرید."
        : "Teacher accounts are created by EduTech admin. If you are a teacher and do not have an account, please contact management or support.",
    close: language === "fa" ? "بستن" : "Close",
    support: language === "fa" ? "تماس با پشتیبانی" : "Contact Support",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 px-4 backdrop-blur-sm"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className={`flex items-center justify-between border-b border-[#E2E8F0] p-5 ${isRTL ? "" : "flex-row-reverse"}`}>
          <h2 className="text-xl font-black text-[#0F172A]">{t.title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={`p-6 ${isRTL ? "text-right" : "text-left"}`}>
          <p className="text-sm font-medium leading-relaxed text-slate-600">{t.body}</p>
          <div className="mt-6 space-y-4 rounded-xl bg-[#F8FAFC] p-4 border border-[#E2E8F0]">
            <div className={`flex items-center gap-3 text-sm font-bold text-[#0F172A] ${isRTL ? "" : "flex-row-reverse"}`}>
              <Mail className="h-5 w-5 text-[#00B8A9]" />
              <span>admin@edutech.com</span>
            </div>
            <div className={`flex items-center gap-3 text-sm font-bold text-[#0F172A] ${isRTL ? "" : "flex-row-reverse"}`}>
              <Phone className="h-5 w-5 text-[#00B8A9]" />
              <span dir="ltr">+93 700 000 000</span>
            </div>
          </div>
          <div className={`mt-8 flex gap-3 ${isRTL ? "" : "flex-row-reverse"}`}>
            <button
              onClick={onClose}
              className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              {t.close}
            </button>
            <button className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00B8A9] py-3 text-sm font-bold text-white shadow-lg hover:bg-[#009A8D] transition ${isRTL ? "" : "flex-row-reverse"}`}>
              <Headphones className="h-4 w-4" /> {t.support}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
