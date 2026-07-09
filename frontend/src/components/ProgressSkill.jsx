export default function ProgressSkill({ name, percentage }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-black text-slate-800">{name}</span>
        <span className="text-xs font-bold text-slate-500">{percentage}%</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-teal-500 transition-all duration-1000 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
