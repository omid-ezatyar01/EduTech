import {
  CalendarDays,
  Clock3,
  ExternalLink,
  Link2,
  Square,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";

function InfoCard({ icon: Icon, label, value, tone = "blue", dir = "rtl" }) {
  const toneClass = tone === "emerald"
    ? "bg-emerald-50 text-emerald-700"
    : tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : "bg-[#0B4FD8]/10 text-[#0B4FD8]";

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneClass}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-slate-500">{label}</p>
          <p dir={dir} className="mt-1 break-words text-sm font-black leading-6 text-slate-900 [overflow-wrap:anywhere]">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ClassDetailsModal({
  open,
  classInfo,
  onClose,
  language = "fa",
  onJoin,
  onEnd,
  onAttendance,
  onCancel,
  onDelete,
  busy = false,
}) {
  if (!open || !classInfo) return null;

  const isFa = language === "fa";

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-slate-50 shadow-2xl"
        dir={isFa ? "rtl" : "ltr"}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] bg-white px-5 py-4 sm:px-6">
          <div className={isFa ? "text-right" : "text-left"}>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0B4FD8]">
              {isFa ? "جزئیات جلسه" : "Session details"}
            </p>
            <h3 className="mt-2 text-xl font-black text-[#0F172A]">{classInfo.title}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">{classInfo.courseTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label={isFa ? "بستن" : "Close"}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard icon={CalendarDays} label={isFa ? "تاریخ" : "Date"} value={classInfo.dateLabel || "-"} />
            <InfoCard icon={Clock3} label={isFa ? "زمان" : "Time"} value={classInfo.timeLabel || "-"} dir="ltr" />
            <InfoCard icon={Users} label={isFa ? "حضور" : "Attendance"} value={`${classInfo.attendanceCount || 0}`} tone="emerald" dir="ltr" />
            <InfoCard icon={Video} label={isFa ? "وضعیت" : "Status"} value={classInfo.statusLabel || "-"} tone="amber" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
              <h4 className="text-base font-black text-slate-950">{isFa ? "خلاصه جلسه" : "Session overview"}</h4>
              <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 px-4 py-2">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 py-3">
                  <p className="text-xs font-black text-slate-500">{isFa ? "پلتفرم" : "Platform"}</p>
                  <p className="text-sm font-black text-slate-900">{classInfo.platformLabel || "-"}</p>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 py-3">
                  <p className="text-xs font-black text-slate-500">{isFa ? "لینک جلسه" : "Meeting link"}</p>
                  <div dir="ltr" className="max-w-[65%] break-words text-sm font-black text-slate-900 [overflow-wrap:anywhere]">
                    {classInfo.meetingLink ? (
                      <a href={classInfo.meetingLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[#0B4FD8] hover:underline">
                        <span>{classInfo.meetingLink}</span>
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <span className="text-slate-500">{isFa ? "ثبت نشده" : "Not added"}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 py-3">
                  <p className="text-xs font-black text-slate-500">{isFa ? "اعلان شاگردان" : "Student notifications"}</p>
                  <p className="text-sm font-black text-slate-900">{classInfo.notifyStudents ? (isFa ? "فعال" : "Enabled") : (isFa ? "غیرفعال" : "Disabled")}</p>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 py-3">
                  <p className="text-xs font-black text-slate-500">{isFa ? "یادآوری" : "Reminder"}</p>
                  <p className="text-sm font-black text-slate-900">{classInfo.reminderEnabled ? (isFa ? "فعال" : "Enabled") : (isFa ? "غیرفعال" : "Disabled")}</p>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 py-3">
                  <p className="text-xs font-black text-slate-500">{isFa ? "حضور خودکار" : "Auto attendance"}</p>
                  <p className="text-sm font-black text-slate-900">{classInfo.autoAttendance ? (isFa ? "فعال" : "Enabled") : (isFa ? "غیرفعال" : "Disabled")}</p>
                </div>
                <div className="flex items-start justify-between gap-3 py-3">
                  <p className="text-xs font-black text-slate-500">{isFa ? "توضیحات" : "Description"}</p>
                  <p className="max-w-[65%] whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-700 [overflow-wrap:anywhere]">
                    {classInfo.description || (isFa ? "توضیحی ثبت نشده است." : "No description added.")}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
              <h4 className="text-base font-black text-slate-950">{isFa ? "اقدامات مدیریتی" : "Management actions"}</h4>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => onJoin?.(classInfo)}
                  disabled={!classInfo.meetingLink}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B4FD8] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Link2 size={16} />
                  {isFa ? "ورود به جلسه" : "Join session"}
                </button>

                {classInfo.status === "live" ? (
                  <button
                    type="button"
                    onClick={() => onEnd?.(classInfo)}
                    disabled={busy}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 text-sm font-black text-blue-700 disabled:opacity-60"
                  >
                    <Square size={16} />
                    {isFa ? "پایان جلسه" : "End session"}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => onAttendance?.(classInfo)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 text-sm font-black text-slate-700"
                >
                  <Users size={16} />
                  {isFa ? "مدیریت حضور" : "Manage attendance"}
                </button>

                {classInfo.status !== "cancelled" && classInfo.status !== "completed" ? (
                  <button
                    type="button"
                    onClick={() => onCancel?.(classInfo)}
                    disabled={busy}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-black text-amber-700 disabled:opacity-60"
                  >
                    <Square size={16} />
                    {isFa ? "لغو جلسه" : "Cancel session"}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => onDelete?.(classInfo)}
                  disabled={busy}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 text-sm font-black text-rose-700 disabled:opacity-60"
                >
                  <Trash2 size={16} />
                  {isFa ? "حذف جلسه" : "Delete session"}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
