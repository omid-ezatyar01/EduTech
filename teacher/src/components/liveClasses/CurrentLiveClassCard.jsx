import { ExternalLink, Users, Video } from "lucide-react";

export default function CurrentLiveClassCard({ data, onJoin, onAttendance }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9] p-5 text-white shadow-[0_20px_40px_rgba(11,79,216,0.28)] sm:p-6">
      <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
      <div className="absolute bottom-[-46px] left-[-32px] h-40 w-40 rounded-full bg-white/10" />

      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/90 px-3 py-1 text-xs font-black text-white">
            <span className="h-2 w-2 rounded-full bg-white" />
            در حال برگزاری
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444] px-3 py-1 text-xs font-black">
            LIVE
          </span>
        </div>

        <h3 className="mt-4 text-2xl font-black">{data.course}</h3>
        <p className="mt-1 text-sm font-semibold text-white/90">{data.topic}</p>

        <div className="mt-4 grid grid-cols-1 gap-2 text-sm font-semibold text-white/90 sm:grid-cols-2">
          <p>استاد: {data.teacher}</p>
          <p>پلتفرم: {data.platform}</p>
          <p>تاریخ: {data.date}</p>
          <p>زمان: {data.time}</p>
          <p>
            شاگردان حاضر: {data.presentStudents} / {data.totalStudents}
          </p>
        </div>

        <p className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold">لینک صنف فعال است</p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onJoin}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-[#0B4FD8] transition hover:bg-slate-100"
          >
            <ExternalLink size={16} />
            ورود به Google Meet
          </button>
          <button
            type="button"
            onClick={onAttendance}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/40 bg-transparent text-sm font-bold text-white transition hover:bg-white/10"
          >
            <Users size={16} />
            مدیریت حضور
          </button>
        </div>

        <div className="mt-5 flex items-end gap-2 text-white/80">
          <div className="rounded-xl bg-white/15 p-2">
            <Video size={20} />
          </div>
          <p className="text-xs">Google Meet Class Session</p>
        </div>
      </div>
    </section>
  );
}
