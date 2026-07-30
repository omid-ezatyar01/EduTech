import { useEffect, useMemo, useState } from "react";

export default function UpcomingClassesTable({ classes, language = "fa" }) {
  const isFa = language === "fa";
  const rows = useMemo(
    () => (Array.isArray(classes) ? classes : []),
    [classes],
  );
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedClasses = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return rows.slice(start, start + itemsPerPage);
  }, [rows, safeCurrentPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [rows]);

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 pb-0 shadow-sm sm:pb-6">
      <h2 className="mb-6 text-xl font-black text-slate-950">
        {isFa ? "صنف‌های آینده" : "Upcoming Classes"}
      </h2>

      <div className="overflow-x-auto -mx-6 px-6 lg:mx-0 lg:px-0">
        <table className="w-full min-w-[640px] text-start text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/50 font-bold text-slate-500">
            <tr>
              <th className="px-4 py-4 text-start rounded-s-xl">
                {isFa ? "کورس" : "Course"}
              </th>
              <th className="px-4 py-4 text-start">{isFa ? "موضوع" : "Topic"}</th>
              <th className="px-4 py-4 text-start">{isFa ? "تاریخ" : "Date"}</th>
              <th className="px-4 py-4 text-start">{isFa ? "زمان" : "Time"}</th>
              <th className="px-4 py-4 text-start">{isFa ? "استاد" : "Teacher"}</th>
              <th className="px-4 py-4 text-start rounded-e-xl">{isFa ? "حالت" : "Status"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
            {paginatedClasses.map((cls) => {
              const statusStyles = {
                scheduled: "bg-primary-50 text-primary-700",
                pending: "bg-amber-50 text-amber-700",
                live: "bg-green-50 text-green-700",
                completed: "bg-slate-100 text-slate-600",
                cancelled: "bg-rose-50 text-rose-700",
              };

              return (
                <tr key={cls.id} className="transition hover:bg-slate-50/50">
                  <td className="px-4 py-5 font-black text-slate-950">
                    {cls.course}
                  </td>
                  <td className="px-4 py-5 text-slate-600">{cls.topic}</td>
                  <td className="px-4 py-5">{cls.date}</td>
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
                      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-black ${statusStyles[cls.status] || statusStyles.scheduled}`}
                    >
                      {cls.statusLabel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 -mx-6 border-y border-slate-200 bg-white p-3 sm:mx-0 sm:rounded-[20px] sm:border sm:shadow-sm">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
              disabled={safeCurrentPage === 1}
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
                  safeCurrentPage === page
                    ? "bg-primary-600 text-white"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
              disabled={safeCurrentPage === totalPages}
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
