import { Send } from "lucide-react";

export default function RequestResourceCard({ onRequest, language = "fa" }) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "به منبع خاصی نیاز دارید؟" : "Need a specific resource?",
    subtitle: isFa
      ? "اگر منبع مورد نظر را پیدا نکردید، می‌توانید درخواست خود را به استاد ارسال کنید."
      : "If you couldn't find the resource you need, you can send a request to your teacher.",
    cta: isFa ? "درخواست منبع" : "Request Resource",
  };

  return (
    <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-teal-50 to-primary-50 p-6 text-center shadow-sm border border-teal-100">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-sm relative z-10">
        <Send size={24} className="pe-0.5" />
      </div>
      <h3 className="relative z-10 text-lg font-black text-slate-950">{t.title}</h3>
      <p className="relative z-10 mt-2 text-sm font-semibold leading-6 text-slate-600">
        {t.subtitle}
      </p>
      <button
        onClick={onRequest}
        className="relative z-10 mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-sm font-black text-white shadow-glow transition hover:bg-teal-700 hover:-translate-y-0.5"
      >
        {t.cta}
      </button>
    </div>
  );
}
