export default function SkillBadge({ skill }) {
  return (
    <span className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-primary-50 hover:text-primary-700 cursor-default">
      {skill}
    </span>
  );
}
