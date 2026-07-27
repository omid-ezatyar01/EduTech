import { Headphones } from "lucide-react";
import { Link } from "react-router";

export default function CertificateHelpCard({ language = "fa" }) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "نیاز به کمک دارید؟" : "Need Help?",
    subtitle: isFa
      ? "اگر در مورد سرتیفیکیت‌ها سوالی دارید، با پشتیبانی در تماس باشید."
      : "If you have questions about certificates, contact support.",
    cta: isFa ? "تماس با پشتیبانی" : "Contact Support",
  };

  return (
    <div className="rounded-[24px] border border-teal-100 bg-teal-50 p-6 shadow-sm text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-sm">
        <Headphones size={24} />
      </div>
      <h3 className="text-lg font-black text-slate-950">{t.title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-teal-800">
        {t.subtitle}
      </p>
      <Link
        to="/contact"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-black text-teal-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-50"
      >
        {t.cta}
      </Link>
    </div>
  );
}
