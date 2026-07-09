import { ExternalLink, MoreVertical } from "lucide-react";

const statusStyles = {
  live: "bg-[#DCFCE7] text-[#10B981]",
  scheduled: "bg-[#DBEAFE] text-[#0B4FD8]",
  finished: "bg-slate-100 text-slate-600",
  canceled: "bg-[#FEE2E2] text-[#EF4444]",
};

export default function TeacherClassRow({ item, mobile = false, onJoin, onManage, onDetails }) {
  const badge = statusStyles[item.status] || statusStyles.scheduled;

  if (mobile) {
    return (
      <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-black text-[#0F172A]">{item.course}</p>
            <p className="mt-1 text-xs text-slate-500">{item.topic}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge}`}>{item.statusLabel}</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
          <p>تاریخ: {item.date}</p>
          <p>زمان: {item.time}</p>
          <p>شاگردان: {item.students}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {item.status === "live" ? (
            <button type="button" onClick={() => onJoin(item)} className="rounded-xl bg-[#0B4FD8] px-3 py-2 text-xs font-bold text-white">
              ورود
            </button>
          ) : (
            <button type="button" onClick={() => onManage(item)} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-bold text-slate-700">
              {item.status === "finished" ? "جزئیات" : "مدیریت"}
            </button>
          )}
          <button type="button" onClick={() => onDetails(item)} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-bold text-slate-700">
            بیشتر
          </button>
        </div>
      </article>
    );
  }

  return (
    <tr className="border-b border-[#E2E8F0] text-sm hover:bg-slate-50/70">
      <td className="px-4 py-3 font-bold text-slate-900">{item.course}</td>
      <td className="px-4 py-3 text-slate-700">{item.topic}</td>
      <td className="px-4 py-3 text-slate-700">{item.date}</td>
      <td className="px-4 py-3 text-slate-700">{item.time}</td>
      <td className="px-4 py-3 text-slate-700">{item.students}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge}`}>{item.statusLabel}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {item.status === "live" ? (
            <button type="button" onClick={() => onJoin(item)} className="inline-flex items-center gap-1 rounded-lg bg-[#0B4FD8] px-3 py-1.5 text-xs font-bold text-white">
              <ExternalLink size={13} /> ورود
            </button>
          ) : (
            <button type="button" onClick={() => onManage(item)} className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-bold text-slate-700">
              {item.status === "finished" ? "جزئیات" : "مدیریت"}
            </button>
          )}
          <button type="button" onClick={() => onDetails(item)} className="rounded-lg border border-[#E2E8F0] p-1.5 text-slate-500">
            <MoreVertical size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
