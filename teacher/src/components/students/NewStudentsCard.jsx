export default function NewStudentsCard({ students = [] }) {
  const visibleStudents = Array.isArray(students) ? students.slice(0, 5) : [];
  const avatarFallback = "/logo-en.png";

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-extrabold text-slate-900">شاگردان جدید</h3>
      </div>

      {visibleStudents.length ? (
        <div className="space-y-3">
          {visibleStudents.map((student) => (
            <article key={student.id} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] p-3">
              <div className="relative">
                <img
                  src={student.avatar || avatarFallback}
                  alt={student.name}
                  className="h-11 w-11 rounded-full border border-slate-200 object-cover"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = avatarFallback;
                  }}
                />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white bg-[#10B981]" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{student.name}</p>
                <p className="truncate text-xs text-slate-500">{student.course}</p>
              </div>

              <p className="text-xs font-medium text-slate-400">{student.time}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-6 text-center text-sm font-semibold text-slate-500">
          شاگرد جدیدی موجود نیست.
        </p>
      )}
    </section>
  );
}
