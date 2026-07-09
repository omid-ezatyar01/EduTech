import {
  Code,
  Briefcase,
  MessageCircle,
  Plus,
  Edit2,
  Trash2,
  Globe2,
} from "lucide-react";
import { useState } from "react";

const getIcon = (platform) => {
  switch (platform.toLowerCase()) {
    case "linkedin":
      return Briefcase;
    case "twitter":
      return MessageCircle;
    case "github":
      return Code;
    default:
      return Globe2;
  }
};

export default function SocialLinksSettingsCard({ links }) {
  const [socials, setSocials] = useState(links);

  const handleDelete = (id) => {
    if (window.confirm("آیا از حذف این لینک مطمئن هستید؟")) {
      setSocials(socials.filter((s) => s.id !== id));
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
      <div className="mb-6">
        <h3 className="text-lg font-black text-slate-900">شبکه‌های اجتماعی</h3>
        <p className="text-sm font-medium text-slate-500 mt-1">
          لینک شبکه‌های اجتماعی خود را مدیریت کنید.
        </p>
      </div>
      <div className="space-y-4">
        {socials.map((link) => {
          const Icon = getIcon(link.platform);
          return (
            <div
              key={link.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">
                    {link.platform}
                  </div>
                  <div
                    className="text-sm text-slate-500 text-left w-full"
                    dir="ltr"
                  >
                    {link.url}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-primary-600 hover:shadow-sm transition">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(link.id)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-4 text-sm font-bold text-slate-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600 transition">
        <Plus className="h-5 w-5" />
        افزودن شبکه اجتماعی دیگر
      </button>
    </div>
  );
}
