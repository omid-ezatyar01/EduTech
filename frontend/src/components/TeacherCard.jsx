import { Share2, Star } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { resolveAvatarUrl } from "../utils/avatar";
import { buildTeacherPath } from "../utils/routePaths";
import { shareContent } from "../utils/share";

export default function TeacherCard({ labels, teacher, index = 0, rank = 0 }) {
  const [failedAvatarKey, setFailedAvatarKey] = useState("");
  const teacherId = teacher?._id || index;
  const teacherName = teacher?.name || "Teacher";
  const teacherPath = buildTeacherPath(teacher);
  const teacherAvatar = resolveAvatarUrl(String(teacher?.avatar || "").trim());
  const avatarKey = `${teacherId}:${teacherAvatar}`;
  const hasAvatar = Boolean(teacherAvatar) && failedAvatarKey !== avatarKey;
  const applicationExperienceYears = Number(teacher?.teacherApplication?.yearsExperience);
  const explicitExperienceYears = Number(teacher?.experienceYears);
  const experienceYears = Number.isFinite(applicationExperienceYears)
    ? Math.max(0, Math.round(applicationExperienceYears))
    : Number.isFinite(explicitExperienceYears)
      ? Math.max(0, Math.round(explicitExperienceYears))
      : 0;
  const rating = Number(teacher?.rating || 0);
  const ratingCount = Math.max(0, Number(teacher?.ratingCount || 0));
  const experienceYearsLabel = String(
    Number.isFinite(experienceYears) && experienceYears >= 0
      ? experienceYears
      : teacher?.experienceYearsLabel || "",
  ).trim();
  const isFa = Boolean(teacher?.isFa);
  const handleShareTeacher = async () => {
    const shared = await shareContent({
      title: teacherName,
      text: isFa
        ? "پروفایل این مدرس را در EduTech ببینید."
        : "View this instructor on EduTech.",
      path: teacherPath,
      previewPath: `/share/teacher/${encodeURIComponent(teacherId)}`,
    });
    if (shared && !navigator.share) {
      alert(isFa ? "لینک مدرس کپی شد." : "Teacher link copied.");
    }
  };

  return (
    <article
      className="group mx-auto flex h-full w-full max-w-[390px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-xl"
    >
      <div className="relative h-24 bg-gradient-to-br from-primary-100 via-blue-50 to-teal-100">
        {rank > 0 ? <span className={`absolute start-3 top-3 z-10 rounded-full border px-3 py-1.5 text-xs font-black shadow-sm backdrop-blur ${rank === 1 ? "border-amber-200 bg-amber-50/95 text-amber-800" : rank <= 3 ? "border-primary-200 bg-primary-50/95 text-primary-700" : "border-white/80 bg-white/90 text-slate-600"}`}>{isFa ? "رتبه" : "Rank"} #{rank}</span> : null}
        <button type="button" onClick={handleShareTeacher} aria-label={isFa ? "اشتراک‌گذاری مدرس" : "Share teacher"} className="absolute end-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-slate-700 shadow-sm transition hover:text-primary-700"><Share2 size={16} /></button>
      </div>
      <div className="relative -mt-12 flex justify-center px-4">
        {hasAvatar ? (
          <img
            src={teacherAvatar}
            alt={teacherName}
            className="h-24 w-24 rounded-2xl border-4 border-white bg-white object-cover shadow-lg"
            style={{ objectPosition: "center top" }}
            onError={() => setFailedAvatarKey(avatarKey)}
          />
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-2xl border-4 border-white bg-white p-3 shadow-lg"><img src="/logo.png" alt="" className="h-full w-full object-contain" /></div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5 pt-3">
        <h3 className="text-center text-xl font-black leading-tight text-slate-950">{teacherName}</h3>
        <p className="mt-1 line-clamp-1 text-center text-sm font-bold text-primary-700">{teacher.role}</p>
        {Array.isArray(teacher.tags) && teacher.tags.length ? <div className="mt-3 flex flex-wrap justify-center gap-1.5">{teacher.tags.slice(0, 2).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{tag}</span>)}</div> : null}

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-black text-amber-600"><Star size={15} fill={ratingCount > 0 ? "currentColor" : "none"}/>{ratingCount > 0 ? `${rating.toFixed(1)} (${ratingCount})` : isFa ? "هنوز امتیازی نیست" : "No ratings yet"}</div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-100 py-4">
          <div className="text-center">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{labels.teacherCourses}</p>
            <p className="mt-1 text-sm font-black text-slate-900">{teacher.courses}</p>
          </div>
          <div className="border-x border-slate-100 text-center">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{teacher.studentsLabel || "Students"}</p>
            <p className="mt-1 text-sm font-black text-slate-900">{teacher.students}</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
              {teacher.experienceLabel || "Experience"}
            </p>
            <p className="mt-1 text-sm font-black text-slate-900">
              {isFa ? (
                experienceYearsLabel ? (
                  <>
                    <span dir="ltr" className="inline-block">{experienceYearsLabel}</span>{" "}
                    <span>سال</span>
                  </>
                ) : (
                  teacher.experienceText || "-"
                )
              ) : (
                teacher.experienceText ||
                (Number.isFinite(experienceYears) && experienceYears >= 0
                  ? `${experienceYearsLabel || experienceYears} Years`
                  : "-")
              )}
            </p>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <Link
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary-600 px-4 text-sm font-black text-white transition hover:bg-primary-700"
            to={teacherPath}
          >
            {labels.viewProfile || "Details"}
          </Link>
        </div>
      </div>
    </article>
  );
}
