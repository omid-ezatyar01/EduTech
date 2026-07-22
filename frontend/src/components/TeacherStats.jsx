import { Award, BookOpen, Star, UsersRound } from "lucide-react";

export default function TeacherStats({ stats }) {
  const icons = [Star, UsersRound, BookOpen, Award];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat, idx) => {
        const Icon = icons[idx];
        return (
          <div
            className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-[0_12px_35px_rgba(15,23,42,0.03)] transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-md sm:p-5"
            key={idx}
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600">
              <Icon size={26} />
            </div>
            <div>
              <p className="break-words text-lg font-black leading-6 text-slate-950 sm:text-xl">{stat.value}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {stat.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
