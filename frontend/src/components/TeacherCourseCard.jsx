import { CalendarDays, Clock3, Users } from "lucide-react";

export default function TeacherCourseCard({ course }) {
  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.03)] transition duration-300 hover:-translate-y-1 hover:border-primary-100 hover:shadow-card">
      <span className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
        {course.liveLabel}
      </span>
      <div className="mt-8">
        <span className="inline-block rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          {course.level}
        </span>
        <h3 className="mt-3 text-xl font-black text-slate-950">
          {course.title}
        </h3>
      </div>
      <div className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-sm font-semibold text-slate-700">
        <p className="flex items-center gap-2">
          <Clock3 size={16} /> {course.duration}
        </p>
        <p className="flex items-center gap-2">
          <CalendarDays size={16} /> {course.schedule}
        </p>
        <p className="flex items-center gap-2">
          <Users size={16} /> {course.seats}
        </p>
      </div>
      <div className="mt-6 border-t border-slate-100 pt-5">
        <p className="text-2xl font-black text-primary-700 mb-4">
          {course.price}
        </p>
        <div className="flex flex-col xl:flex-row items-center gap-2">
          <button className="flex-1 w-full flex h-10 items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-black text-white transition hover:bg-primary-700">
            {course.btnRegister}
          </button>
          <button className="flex-1 w-full flex h-10 items-center justify-center gap-2 rounded-lg bg-primary-50 px-4 text-sm font-black text-primary-700 transition hover:bg-primary-100">
            {course.btnDetails}
          </button>
        </div>
      </div>
    </div>
  );
}
