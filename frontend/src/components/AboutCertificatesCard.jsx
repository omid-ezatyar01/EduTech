import { BadgeCheck, CheckCircle2 } from "lucide-react";

export default function AboutCertificatesCard() {
  const features = [
    "سرتیفیکیت قابل دانلود",
    "قابل اشتراک‌گذاری در لینکدین",
    "دارای کد تایید اصالت",
  ];

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
          <BadgeCheck size={20} />
        </div>
        <h3 className="text-lg font-black text-slate-950">
          درباره سرتیفیکیت‌ها
        </h3>
      </div>
      <p className="mb-5 text-sm font-semibold leading-7 text-slate-600">
        پس از تکمیل موفق کورس و قبولی در تمامی ارزیابی‌ها، سرتیفیکیت رسمی دریافت
        خواهید کرد.
      </p>
      <ul className="space-y-3">
        {features.map((feature, idx) => (
          <li
            key={idx}
            className="flex items-center gap-2 text-sm font-bold text-slate-700"
          >
            <CheckCircle2 size={16} className="text-green-500" /> {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}
