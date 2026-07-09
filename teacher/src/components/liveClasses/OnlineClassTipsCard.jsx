import { Lightbulb } from "lucide-react";

const tips = [
  "حداقل ۵ دقیقه زودتر صنف را شروع کنید.",
  "قبل از شروع، میکروفون و دوربین را چک کنید.",
  "بعد از هر بخش، حضور شاگردان را بررسی کنید.",
  "لینک Google Meet را فقط برای شاگردان فعال کنید.",
];

export default function OnlineClassTipsCard() {
  return (
    <section className="rounded-2xl border border-[#BFDBFE] bg-gradient-to-l from-[#E0F2FE] to-[#CCFBF1] p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[#0B4FD8]">
        <Lightbulb size={18} />
        <h3 className="text-base font-extrabold">نکات برگزاری آنلاین</h3>
      </div>

      <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
        {tips.map((tip) => (
          <li key={tip} className="rounded-lg bg-white/70 px-3 py-2">
            {tip}
          </li>
        ))}
      </ul>

      <button type="button" className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#0B4FD8]">
        مشاهده راهنمای کامل
      </button>
    </section>
  );
}
