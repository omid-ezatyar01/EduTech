import { Clock, MicOff, MessageSquare, Users, ShieldCheck } from "lucide-react";

export default function ClassRulesCard({ language = "fa" }) {
  const isFa = language === "fa";
  const rules = [
    {
      text: isFa
        ? "۵ دقیقه قبل از شروع صنف آماده باشید."
        : "Be ready 5 minutes before class starts.",
      icon: Clock,
    },
    {
      text: isFa
        ? "مایکروفون خود را هنگام ورود خاموش کنید."
        : "Mute your microphone when joining.",
      icon: MicOff,
    },
    {
      text: isFa
        ? "سوالات خود را در چت یا با اجازه استاد بپرسید."
        : "Ask questions in chat or with the teacher's permission.",
      icon: MessageSquare,
    },
    {
      text: isFa
        ? "حضور شما در سیستم ثبت می‌شود."
        : "Your attendance is recorded in the system.",
      icon: Users,
    },
    {
      text: isFa
        ? "ورود به صنف از طریق لینک ۱۰ دقیقه بعد از شروع صنف بسته می‌شود."
        : "Join window closed 10 minutes after class start time.",
      icon: Clock,
    },
    {
      text: isFa
        ? "احترام به استاد و همصنفی‌ها الزامی است."
        : "Respect for the teacher and classmates is required.",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-black text-slate-950 mb-5">
        {isFa ? "قوانین صنف" : "Class Rules"}
      </h3>
      <ul className="divide-y divide-slate-100">
        {rules.map((rule, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
              <rule.icon size={16} />
            </div>
            <p className="text-sm font-semibold text-slate-700 leading-6">
              {rule.text}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
