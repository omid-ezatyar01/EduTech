export default function CertificateStatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass,
}) {
  return (
    <div className="flex items-start gap-4 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${colorClass}`}
      >
        <Icon size={24} />
      </div>
      <div>
        <p className="text-3xl font-black text-slate-900">{value}</p>
        <h3 className="mt-1 text-sm font-black text-slate-800">{title}</h3>
        <p className="mt-1 text-xs font-bold text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}
