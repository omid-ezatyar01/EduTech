import { Search } from "lucide-react";

export default function TeacherStudentFilterBar({
  search,
  onSearchChange,
  course,
  onCourseChange,
  courses = [],
}) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <label className="relative lg:col-span-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="جستجو در شاگردان..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pr-9 pl-3 text-sm outline-none transition focus:border-[#0B4FD8] focus:ring-2 focus:ring-[#0B4FD8]/15"
          />
        </label>

        <select
          value={course}
          onChange={(event) => onCourseChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none transition focus:border-[#0B4FD8]"
        >
          <option value="all">همه کورس‌ها</option>
          {courses.map((item) => (
            <option key={item.id || item.title || item} value={item.id || item.title || item}>
              {item.title || item}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
