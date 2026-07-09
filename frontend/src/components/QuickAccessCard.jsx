import { Clock, Star, Download, Bookmark } from "lucide-react";

export default function QuickAccessCard() {
  const links = [
    { label: "منابع اخیر", icon: Clock },
    { label: "منابع مهم", icon: Star },
    { label: "دانلودها", icon: Download },
    { label: "نشان‌گذاری‌شده‌ها", icon: Bookmark },
  ];

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-black text-slate-950">دسترسی سریع</h3>
      <ul className="space-y-2">
        {links.map((link, idx) => (
          <li key={idx}>
            <button className="flex w-full items-center gap-3 rounded-xl p-3 text-sm font-bold text-slate-700 transition hover:bg-primary-50 hover:text-primary-700">
              <link.icon size={18} className="text-slate-400" /> {link.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
