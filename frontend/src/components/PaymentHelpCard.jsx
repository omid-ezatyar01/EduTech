import { Headphones, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

export default function PaymentHelpCard({ language = "fa" }) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "نیاز به کمک دارید؟" : "Need Help?",
    subtitle: isFa
      ? "اگر در مورد پرداخت‌ها سوالی دارید، با پشتیبانی تماس بگیرید."
      : "If you have questions about payments, contact support.",
    cta: isFa ? "تماس با پشتیبانی" : "Contact Support",
  };

  return (
    <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-teal-50 to-blue-50 p-6 text-center shadow-sm border border-teal-100">
      <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/40 blur-2xl" />
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-sm relative z-10">
        <Wallet size={24} />
      </div>
      <h3 className="relative z-10 text-lg font-black text-slate-950">{t.title}</h3>
      <p className="relative z-10 mt-2 text-sm font-semibold leading-6 text-slate-600">
        {t.subtitle}
      </p>
      <Link
        to="/student/messages"
        className="relative z-10 mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-black text-teal-700 shadow-sm transition hover:bg-teal-50 hover:-translate-y-0.5"
      >
        <Headphones size={18} /> {t.cta}
      </Link>
    </div>
  );
}
