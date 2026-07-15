import { Headset } from "lucide-react";
import { Link } from "react-router-dom";

export default function HelpCard({ compact = false, language = "fa" }) {
  const isFa = language === "fa";

  return (
    <div
      className={`relative flex h-full flex-col items-start overflow-hidden rounded-[24px] bg-gradient-to-br from-teal-500 to-primary-600 text-white shadow-sm sm:flex-row sm:items-center ${
        compact ? "gap-4 p-5 sm:p-6" : "gap-6 p-6 sm:p-8"
      }`}
    >
      <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div
        className={`relative z-10 flex shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-sm ${
          compact ? "h-12 w-12" : "h-14 w-14"
        }`}
      >
        <Headset size={compact ? 24 : 28} className="text-white" />
      </div>
      <div className="min-w-0 flex-1 relative z-10">
        <h4 className={`${compact ? "text-base" : "text-lg"} font-black`}>
          {isFa ? "مشکل در ورود به صنف دارید؟" : "Having trouble joining class?"}
        </h4>
        <p
          className={`text-sm font-semibold text-teal-50 ${
            compact ? "mt-1.5 leading-5" : "mt-2 leading-6"
          }`}
        >
          {isFa
            ? "در صورت مشکل در ورود به Google Meet یا هر سوال دیگر، با پشتیبانی در تماس باشید."
            : "If you have trouble joining Google Meet or any other question, contact support."}
        </p>
      </div>
      <Link
        to="/contact"
        className={`relative z-10 mt-2 flex shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-primary-700 shadow-sm transition hover:-translate-y-0.5 sm:mt-0 ${
          compact ? "px-5 py-3" : "px-6 py-3.5"
        }`}
      >
        {isFa ? "تماس با پشتیبانی" : "Contact Support"}
      </Link>
    </div>
  );
}
