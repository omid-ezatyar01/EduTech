export default function TeacherQuickActionCard({
  title,
  text,
  buttonText,
  icon: Icon,
  tone = "blue",
  onClick,
}) {
  const toneClass = {
    blue: "bg-[#0B4FD8]/10 text-[#0B4FD8]",
    teal: "bg-[#00B8A9]/10 text-[#00B8A9]",
    purple: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
    orange: "bg-[#F59E0B]/10 text-[#F59E0B]",
  };

  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <span className={`inline-flex rounded-lg p-2 ${toneClass[tone]}`}>
        <Icon size={18} />
      </span>
      <h3 className="mt-3 text-base font-black text-[#0F172A]">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{text}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-4 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:border-[#0B4FD8]/30 hover:text-[#0B4FD8]"
      >
        {buttonText}
      </button>
    </article>
  );
}
