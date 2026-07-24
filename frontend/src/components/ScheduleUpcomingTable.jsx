import { Clock, Video, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function ScheduleUpcomingTable({
  classes,
  onOpenDetails,
  language = "fa",
}) {
  const isFa = language === "fa";
  const dayLabels = {
    Saturday: isFa ? "شنبه" : "Saturday",
    Sunday: isFa ? "یکشنبه" : "Sunday",
    Monday: isFa ? "دوشنبه" : "Monday",
    Tuesday: isFa ? "سه‌شنبه" : "Tuesday",
    Wednesday: isFa ? "چهارشنبه" : "Wednesday",
    Thursday: isFa ? "پنجشنبه" : "Thursday",
    Friday: isFa ? "جمعه" : "Friday",
  };
  const rows = Array.isArray(classes) ? classes : [];
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / itemsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return rows.slice(start, start + itemsPerPage);
  }, [currentPage, rows]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rows]);

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Clock size={24} />
        </div>
        <h2 className="text-xl font-black text-slate-950">
          {isFa ? "صنف‌های آینده" : "Upcoming Classes"}
        </h2>
      </div>

      {!rows.length ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm font-semibold text-slate-500">
          {isFa
            ? "هنوز صنف زمان‌بندی‌شده‌ای برای شما وجود ندارد."
            : "You do not have any scheduled classes yet."}
        </div>
      ) : null}

      {rows.length ? (
        <div className="overflow-x-auto -mx-6 px-6 lg:mx-0 lg:px-0">
        <table className="w-full min-w-[750px] text-start text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/50 font-bold text-slate-500">
            <tr>
              <th className="px-4 py-4 text-start rounded-s-xl">
                {isFa ? "کورس" : "Course"}
              </th>
              <th className="px-4 py-4 text-start">{isFa ? "تاریخ" : "Date"}</th>
              <th className="px-4 py-4 text-start">{isFa ? "زمان" : "Time"}</th>
              <th className="px-4 py-4 text-start">{isFa ? "استاد" : "Teacher"}</th>
              <th className="px-4 py-4 text-start">{isFa ? "وضعیت" : "Status"}</th>
              <th className="px-4 py-4 text-start rounded-e-xl">
                {isFa ? "عملیات" : "Actions"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
            {paginatedRows.map((cls) => (
              <tr key={cls.id} className="transition hover:bg-slate-50/50">
                <td className="px-4 py-5 font-black text-slate-950">
                  {cls.course}
                </td>
                <td className="px-4 py-5 text-slate-600">
                  {dayLabels[cls.day || cls.date] || cls.date}
                </td>
                <td className="px-4 py-5">
                  <p className="font-black text-slate-800">
                    {isFa ? "وقت شما: " : "Your time: "}{cls.localTime || cls.time}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    {isFa ? "وقت استاد: " : "Teacher: "}{cls.teacherTime || cls.time}
                  </p>
                </td>
                <td className="px-4 py-5">{cls.teacher}</td>
                <td className="px-4 py-5">
                  <span
                    className={`inline-flex rounded-md px-2.5 py-1 text-xs font-black ${cls.status === "scheduled" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    {cls.statusLabel}
                  </span>
                </td>
                <td className="px-4 py-5">
                  {cls.meetLink ? (
                    <a
                      href={cls.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-600 to-teal-500 px-4 py-2 text-xs font-black text-white transition hover:opacity-90 shadow-sm"
                    >
                      <Video size={14} /> {isFa ? "ورود به صنف" : "Join Class"}
                    </a>
                  ) : (
                    <button
                      onClick={() => onOpenDetails(cls)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      <Eye size={14} /> {isFa ? "مشاهده جزئیات" : "View Details"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      ) : null}

      {rows.length && totalPages > 1 ? (
        <div className="mt-4 -mx-6 border-y border-slate-200 bg-white p-3 sm:mx-0 sm:rounded-[20px] sm:border sm:shadow-sm">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isFa ? "قبلی" : "Previous"}
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`h-9 min-w-9 rounded-lg px-3 text-xs font-black transition ${
                  currentPage === page
                    ? "bg-primary-600 text-white"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isFa ? "بعدی" : "Next"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
