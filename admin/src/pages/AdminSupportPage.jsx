import { useState } from "react";
import { Headphones, UsersRound, Wifi, WifiOff } from "lucide-react";
import { Link } from "react-router";
import { useAdminI18n } from "../i18n/AdminI18nContext";
import AdminSupportTeamChat from "../features/supportStaff/components/AdminSupportTeamChat";

const copy = {
  en: {
    title: "Support Team Chat",
    subtitle: "Message the whole support team or contact a team member directly.",
    manageTeam: "Manage support team",
    live: "Live",
    reconnecting: "Reconnecting",
  },
  fa: {
    title: "گفتگوی تیم پشتیبانی",
    subtitle: "برای همه تیم پیام بفرستید یا مستقیماً با یک عضو گفتگو کنید.",
    manageTeam: "مدیریت تیم پشتیبانی",
    live: "زنده",
    reconnecting: "در حال اتصال",
  },
};

export default function AdminSupportPage() {
  const { language } = useAdminI18n();
  const t = copy[language] || copy.fa;
  const [live, setLive] = useState(false);

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-950">
            <Headphones className="text-[#0B4FD8]" />
            {t.title}
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {t.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/support-staff"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-black text-blue-700"
          >
            <UsersRound size={16} />
            {t.manageTeam}
          </Link>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
              live
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {live ? <Wifi size={14} /> : <WifiOff size={14} />}
            {live ? t.live : t.reconnecting}
          </span>
        </div>
      </header>

      <AdminSupportTeamChat
        language={language}
        onLiveChange={setLive}
      />
    </div>
  );
}
