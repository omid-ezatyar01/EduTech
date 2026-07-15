import TeacherStudentRow from "./TeacherStudentRow";

export default function TeacherStudentsTable({
  students,
  onView,
  onMoreToggle,
  openMenuId,
  onMoreAction,
  page = 1,
  totalPages = 1,
  total = 0,
  onPageChange,
  loading = false,
}) {
  const hasData = Array.isArray(students) && students.length > 0;

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[960px] w-full text-right">
          <thead className="border-b border-[#E2E8F0] bg-slate-50/70 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-bold">شاگرد</th>
              <th className="px-4 py-3 font-bold">کورس</th>
              <th className="px-4 py-3 font-bold">پیشرفت</th>
              <th className="px-4 py-3 font-bold">حضور</th>
              <th className="px-4 py-3 font-bold">تکالیف</th>
              <th className="px-4 py-3 font-bold">آخرین فعالیت</th>
              <th className="px-4 py-3 font-bold">وضعیت</th>
              <th className="px-4 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {hasData ? (
              students.map((student) => (
                <TeacherStudentRow
                  key={student.id}
                  student={student}
                  onView={onView}
                  onMoreToggle={onMoreToggle}
                  moreOpen={openMenuId === student.id}
                  onMoreAction={onMoreAction}
                />
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                  {loading ? "در حال بارگذاری" : "شاگردی برای نمایش پیدا نشد."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {hasData ? (
          students.map((student) => (
            <TeacherStudentRow
              key={student.id}
              student={student}
              mobile
              onView={onView}
              onMoreToggle={onMoreToggle}
              moreOpen={openMenuId === student.id}
              onMoreAction={onMoreAction}
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-6 text-center text-sm font-semibold text-slate-500">
            {loading ? "در حال بارگذاری" : "شاگردی برای نمایش پیدا نشد."}
          </p>
        )}
      </div>

      <footer className="border-t border-[#E2E8F0] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-[#0B4FD8]">صفحه {page} از {Math.max(totalPages, 1)}</p>

          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              قبلی
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              بعدی
            </button>
          </div>

          <p className="text-xs text-slate-500 sm:text-sm">مجموع: {total}</p>
        </div>
      </footer>
    </section>
  );
}
