import { FilePlus2, MessageCircle, PlusCircle, Upload } from "lucide-react";

export default function TeacherQuickActions({ language }) {
  const actions = [
    {
      key: "live",
      labelFa: "ایجاد صنف زنده",
      labelEn: "Create Live Class",
      icon: PlusCircle,
      tone: "bg-[#0B4FD8]/10 text-[#0B4FD8]",
    },
    {
      key: "assignment",
      labelFa: "افزودن تمرین",
      labelEn: "Add Assignment",
      icon: FilePlus2,
      tone: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
    },
    {
      key: "resource",
      labelFa: "آپلود منبع",
      labelEn: "Upload Resource",
      icon: Upload,
      tone: "bg-[#00B8A9]/10 text-[#00B8A9]",
    },
    {
      key: "message",
      labelFa: "ارسال پیام گروهی",
      labelEn: "Broadcast Message",
      icon: MessageCircle,
      tone: "bg-[#F59E0B]/10 text-[#F59E0B]",
    },
  ];

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black text-[#0F172A]">
        {language === "fa" ? "اقدام‌های سریع" : "Quick Actions"}
      </h3>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <button
            type="button"
            key={action.key}
            className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3 text-sm font-bold text-slate-700 transition hover:border-[#0B4FD8]/30 hover:bg-white"
          >
            <span className={`rounded-lg p-2 ${action.tone}`}>
              <action.icon size={15} />
            </span>
            {language === "fa" ? action.labelFa : action.labelEn}
          </button>
        ))}
      </div>
    </section>
  );
}
