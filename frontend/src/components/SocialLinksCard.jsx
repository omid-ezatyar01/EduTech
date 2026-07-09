import { Share2, Briefcase, MessageCircle, Code, Plus } from "lucide-react";

export default function SocialLinksCard({ links }) {
  const icons = { linkedin: Briefcase, twitter: MessageCircle, github: Code };
  const bgColors = {
    linkedin: "bg-blue-50 text-blue-600",
    twitter: "bg-sky-50 text-sky-500",
    github: "bg-slate-100 text-slate-800",
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Share2 size={24} />
        </div>
        <h3 className="text-xl font-black text-slate-950">شبکه‌های اجتماعی</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(links).map(([platform, url]) => {
          const Icon = icons[platform] || Share2;
          return (
            <div
              key={platform}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition focus-within:border-primary-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary-100 relative"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm ${bgColors[platform]}`}
              >
                <Icon size={18} />
              </div>
              <input
                type="text"
                defaultValue={url}
                className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
                dir="ltr"
              />
            </div>
          );
        })}
      </div>
      <button className="mt-6 flex w-full sm:w-auto sm:px-6 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white py-3.5 text-sm font-black text-slate-700 transition hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700">
        <Plus size={18} /> افزودن شبکه اجتماعی دیگر
      </button>
    </div>
  );
}
