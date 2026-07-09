import { ShieldCheck } from "lucide-react";
import TeacherAuthHeader from "../components/auth/TeacherAuthHeader";

export default function TeacherAuthLayout({
  children,
  language,
  isRTL,
  onLanguageChange,
  showHeader = true,
  showSecurityNote = true,
  compact = false,
}) {
  return (
    <div
      className={`bg-[#F8FAFC] font-sans flex flex-col items-center justify-center ${
        compact
          ? "min-h-[100dvh] overflow-y-auto p-3 sm:p-4 lg:h-screen lg:overflow-hidden lg:p-5"
          : "min-h-screen p-4 sm:p-6 lg:p-8"
      }`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="w-full max-w-[1200px] bg-white rounded-[20px] sm:rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.06)] border border-[#E2E8F0] overflow-hidden flex flex-col">
        {showHeader ? (
          <TeacherAuthHeader
            language={language}
            isRTL={isRTL}
            onLanguageChange={onLanguageChange}
          />
        ) : null}
        <div className={`flex flex-col lg:flex-row flex-1 ${isRTL ? "" : "lg:flex-row-reverse"}`}>{children}</div>
      </div>
      {showSecurityNote ? (
        <div className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-slate-500">
          <ShieldCheck className="w-5 h-5 text-[#10B981]" />
          {isRTL ? "اتصال شما امن و رمزگذاری شده است." : "Your connection is secure and encrypted."}
          <span className="font-mono text-slate-400 mx-1">|</span>
          <span className="font-mono" dir="ltr">
            te.edutech.study
          </span>
        </div>
      ) : null}
    </div>
  );
}
