import TeacherCourseCard from "./TeacherCourseCard";

export default function TeacherCoursesTable({
  courses,
  language,
  onEdit,
  onDetails,
  onStartClass,
  onRequestEndReview,
  onRequestCancel,
  pagination,
  onPageChange,
}) {
  const currentPage = Number(pagination?.page || 1);
  const limit = Number(pagination?.limit || 10);
  const total = Number(pagination?.total || courses.length);
  const totalPages = Math.max(1, Number(pagination?.totalPages || 1));
  const count = courses.length;
  const startIndex = total && count ? (currentPage - 1) * limit + 1 : 0;
  const endIndex = total && count ? Math.min(startIndex + count - 1, total) : 0;
  const showPagination = totalPages > 1;
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1,
  );

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
        {courses.map((course) => (
          <TeacherCourseCard
            key={course.id}
            course={course}
            language={language}
            onEdit={() => onEdit(course)}
            onDetails={() => onDetails(course)}
            onStartClass={() => onStartClass(course)}
            onRequestEndReview={() => onRequestEndReview(course)}
            onRequestCancel={() => onRequestCancel(course)}
          />
        ))}
      </div>

      {!courses.length ? (
        <div className="m-4 rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center text-sm font-semibold text-slate-500 sm:m-5">
          {language === "fa"
            ? "هیچ کورسی با فیلترهای فعلی پیدا نشد."
            : "No courses found for current filters."}
        </div>
      ) : null}

      <div className={`flex flex-wrap items-center gap-3 border-t border-[#E2E8F0] px-4 py-4 text-sm text-slate-600 sm:px-5 ${
        showPagination ? "justify-between" : "justify-center"
      }`}>
        <p className="w-full text-center sm:w-auto">
          {language === "fa"
            ? `نمایش ${startIndex} تا ${endIndex} از ${total} کورس`
            : `Showing ${startIndex} to ${endIndex} of ${total} courses`}
        </p>
        {showPagination ? (
          <div className="mx-auto flex flex-wrap items-center justify-center gap-2 sm:mx-0">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {language === "fa" ? "قبلی" : "Previous"}
            </button>
            {pageNumbers.map((item, index) => {
              const previous = pageNumbers[index - 1];
              const showGap = previous && item - previous > 1;

              return (
                <span key={item} className="flex items-center gap-2">
                  {showGap ? <span className="text-xs font-bold text-slate-400">...</span> : null}
                  <button
                    type="button"
                    onClick={() => onPageChange?.(item)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                      item === currentPage
                        ? "bg-[#0B4FD8]/10 text-[#0B4FD8]"
                        : "border border-[#E2E8F0] hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange?.(Math.min(totalPages, currentPage + 1))}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {language === "fa" ? "بعدی" : "Next"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
