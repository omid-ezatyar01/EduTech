export default function TeacherQuickActionCard({ title, text, icon: Icon, tone = "blue", onClick }) {
  const toneClass = {
    blue: "bg-[#DBEAFE] text-[#0B4FD8]",
    teal: "bg-[#CCFBF1] text-[#00B8A9]",
    orange: "bg-[#FEF3C7] text-[#F59E0B]",
    purple: "bg-[#EDE9FE] text-[#8B5CF6]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-[#E2E8F0] bg-white p-4 text-right shadow-sm transition hover:-translate-y-0.5"
    >
      <div className={`inline-flex rounded-xl p-2 ${toneClass[tone] || toneClass.blue}`}>
        <Icon size={18} />
      </div>
      <p className="mt-3 text-sm font-black text-[#0F172A]">{title}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{text}</p>
    </button>
  );
}
