import { Video } from "lucide-react";

export default function TeacherLiveClassesCard({ classes = [], language }) {
  return (
    <section className="flex h-[360px] w-full flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black text-[#0F172A]">
        {language === "fa" ? "صنف‌های زنده امروز" : "Today's Live Classes"}
      </h3>

      {classes.length ? (
        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pe-1">
          {classes.map((item) => (
            <div key={item.id} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-[#0F172A]">{item.title}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {item.time} - {item.studentsCount} {language === "fa" ? "شاگرد" : "students"}
                  </p>
                </div>
                <a
                  href={item.meetingLink || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-white ${
                    item.meetingLink ? "bg-[#0B4FD8] hover:bg-[#083FAA]" : "bg-slate-400 pointer-events-none"
                  }`}
                >
                  <Video size={14} />
                  {language === "fa" ? "ورود به جلسه" : "Join Session"}
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3 text-sm font-medium text-slate-500">
          {language === "fa" ? "برای امروز صنف زنده‌ای برنامه‌ریزی نشده است." : "No live classes are scheduled for today."}
        </p>
      )}
    </section>
  );
}
