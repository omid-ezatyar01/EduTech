export default function DashboardStatCard({
  title,
  value,
  icon: Icon,
  colorClass,
}) {
  return (
    <div className="flex min-h-[108px] items-center gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${colorClass}`}
      >
        <Icon size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-3xl font-black text-slate-900">{value}</p>
        <p
          className="mt-1 truncate text-sm font-bold text-slate-500"
          title={title}
        >
          {title}
        </p>
      </div>
    </div>
  );
}
