import { Search } from "lucide-react";

export default function TeacherAssignmentFilterBar({
  search,
  setSearch,
  course,
  setCourse,
  status,
  setStatus,
  type,
  setType,
}) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <label className="relative lg:col-span-2">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجو در تمرین‌ها..."
            className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pr-9 pl-3 text-sm outline-none focus:border-[#0B4FD8]"
          />
        </label>

        <select value={course} onChange={(event) => setCourse(event.target.value)} className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none focus:border-[#0B4FD8]">
          <option value="all">همه کورس‌ها</option>
          <option value="MERN Stack">MERN Stack</option>
          <option value="Backend API Development">Backend API Development</option>
          <option value="Python Programming">Python Programming</option>
        </select>

        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none focus:border-[#0B4FD8]">
          <option value="all">همه وضعیت‌ها</option>
          <option value="active">فعال</option>
          <option value="completed">تکمیل شده</option>
          <option value="expired">منقضی شده</option>
          <option value="draft">پیش‌نویس</option>
        </select>

        <select value={type} onChange={(event) => setType(event.target.value)} className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none focus:border-[#0B4FD8]">
          <option value="all">همه نوع‌ها</option>
          <option value="تمرین">تمرین</option>
          <option value="پروژه">پروژه</option>
          <option value="کوییز">کوییز</option>
        </select>
      </div>
    </section>
  );
}
