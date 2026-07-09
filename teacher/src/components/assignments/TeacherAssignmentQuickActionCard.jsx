export default function TeacherAssignmentQuickActionCard({ title, text, icon: Icon, buttonLabel, onClick, tone = "blue" }) {
  const toneClass = {
    blue: "bg-[#DBEAFE] text-[#0B4FD8]",
    teal: "bg-[#CCFBF1] text-[#00B8A9]",
    orange: "bg-[#FEF3C7] text-[#F59E0B]",
    purple: "bg-[#EDE9FE] text-[#8B5CF6]",
  };

  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <div className={`inline-flex rounded-xl p-2 ${toneClass[tone] || toneClass.blue}`}>
        <Icon size={18} />
      </div>
      <h3 className="mt-3 text-sm font-black text-[#0F172A]">{title}</h3>
      <p className="mt-1 text-xs font-medium text-slate-500">{text}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-[#E2E8F0] px-4 text-sm font-semibold text-slate-700 hover:border-[#0B4FD8] hover:text-[#0B4FD8]"
      >
        {buttonLabel}
      </button>
    </article>
  );
}
