export default function AssignmentStatusChart({ stats, language = "fa" }) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "وضعیت تمرین‌ها" : "Assignment Status",
    total: isFa ? "همه تمرین‌ها" : "All Assignments",
    pending: isFa ? "در انتظار ارسال" : "Pending Submission",
    submitted: isFa ? "ارسال شده" : "Submitted",
    reviewed: isFa ? "بررسی شده" : "Reviewed",
    locked: isFa ? "قفل شده" : "Locked",
  };
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-black text-slate-950 mb-6 text-center">
        {t.title}
      </h3>

      <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
        <svg
          viewBox="0 0 160 160"
          className="absolute inset-0 h-full w-full -rotate-90"
        >
          {/* Locked */}
          <circle
            cx="80"
            cy="80"
            r="64"
            className="stroke-slate-200"
            strokeWidth="16"
            fill="none"
          />
          {/* Reviewed (Blue) */}
          <circle
            cx="80"
            cy="80"
            r="64"
            className="stroke-primary-500"
            strokeWidth="16"
            fill="none"
            strokeDasharray="402"
            strokeDashoffset="100.5"
          />
          {/* Submitted (Green) */}
          <circle
            cx="80"
            cy="80"
            r="64"
            className="stroke-teal-500"
            strokeWidth="16"
            fill="none"
            strokeDasharray="402"
            strokeDashoffset="201"
          />
          {/* Pending (Orange) */}
          <circle
            cx="80"
            cy="80"
            r="64"
            className="stroke-amber-500"
            strokeWidth="16"
            fill="none"
            strokeDasharray="402"
            strokeDashoffset="301.5"
          />
        </svg>
        <div className="text-center">
          <span className="text-2xl font-black text-slate-900">
            {stats.total}
          </span>
          <p className="text-[10px] font-bold text-slate-500 mt-1">
            {t.total}
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-bold text-slate-700">
            <span className="h-3 w-3 rounded-full bg-amber-500"></span>
            {t.pending}
          </span>
          <span className="font-black text-slate-900">{stats.pending}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-bold text-slate-700">
            <span className="h-3 w-3 rounded-full bg-teal-500"></span>
            {t.submitted}
          </span>
          <span className="font-black text-slate-900">{stats.submitted}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-bold text-slate-700">
            <span className="h-3 w-3 rounded-full bg-primary-500"></span>
            {t.reviewed}
          </span>
          <span className="font-black text-slate-900">{stats.reviewed}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-bold text-slate-700">
            <span className="h-3 w-3 rounded-full bg-slate-200"></span>
            {t.locked}
          </span>
          <span className="font-black text-slate-900">{stats.locked}</span>
        </div>
      </div>
    </div>
  );
}
