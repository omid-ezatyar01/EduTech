import { Headphones, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router";

export default function TeacherSupportContactButton({ language = "fa" }) {
  const { pathname } = useLocation();
  if (pathname !== "/teacher/dashboard") return null;
  const isFa = language === "fa";

  return (
    <Link
      to="/teacher/support"
      className="group fixed bottom-[max(1rem,env(safe-area-inset-bottom))] end-3 z-30 inline-flex min-h-14 items-center gap-2 rounded-full border border-white/50 bg-gradient-to-r from-[#0B4FD8] to-[#00A99D] px-3.5 text-white shadow-[0_14px_38px_rgba(11,79,216,0.34)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(11,79,216,0.42)] sm:end-5 sm:px-5"
      aria-label={isFa ? "تماس با تیم پشتیبانی" : "Contact the support team"}
    >
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15">
        <Headphones size={20} />
        <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#087eac] bg-emerald-300" />
      </span>
      <span className="pe-1 text-start">
        <strong className="block whitespace-nowrap text-xs font-black sm:text-sm">
          {isFa ? "پشتیبانی مدرس" : "Teacher support"}
        </strong>
        <span className="hidden items-center gap-1 text-[10px] font-semibold text-white/80 min-[380px]:flex sm:text-[11px]">
          <MessageCircle size={11} />
          {isFa ? "گفتگو با تیم پشتیبانی" : "Chat with support"}
        </span>
      </span>
    </Link>
  );
}
