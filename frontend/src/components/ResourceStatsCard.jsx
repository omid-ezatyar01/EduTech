export default function ResourceStatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass,
}) {
  return (
    <div className="flex flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${colorClass}`}
        >
          <Icon size={24} />
        </div>
        <span className="text-3xl font-black text-slate-900">{value}</span>
      </div>
      <h3 className="text-sm font-black text-slate-800">{title}</h3>
      <p className="mt-1 text-xs font-bold text-slate-500">{subtitle}</p>
    </div>
  );
}
