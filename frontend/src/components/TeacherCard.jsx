import { Share2, Star } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { resolveAvatarUrl } from "../utils/avatar";
import { buildTeacherPath } from "../utils/routePaths";
import { shareContent } from "../utils/share";

function getInitials(name) {
  return String(name || "T")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function TeacherCard({ labels, teacher, index = 0 }) {
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
      className="group mx-auto flex h-full w-full max-w-[390px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(15,23,42,0.12)]"
    >
      <div className="flex justify-center bg-gradient-to-b from-slate-100 to-white px-4 pb-3 pt-5">
        {hasAvatar ? (
          <img
            src={teacherAvatar}
            alt={teacherName}
            className="h-36 w-36 rounded-full border-4 border-white bg-white object-cover shadow-lg sm:h-44 sm:w-44"
            style={{ objectPosition: "center top" }}
            onError={() => setFailedAvatarKey(avatarKey)}
          />
        ) : (
          <div className="grid h-36 w-36 place-items-center rounded-full border-4 border-white bg-slate-200 text-3xl font-black text-slate-700 shadow-lg sm:h-44 sm:w-44">
            {getInitials(teacherName)}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-center text-xl font-black leading-tight text-slate-950">{teacherName}</h3>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{labels.teacherCourses}</p>
            <p className="mt-1 text-sm font-black text-slate-900">{teacher.courses}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{teacher.studentsLabel || "Students"}</p>
            <p className="mt-1 text-sm font-black text-slate-900">{teacher.students}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{teacher.ratingLabel || "Rating"}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-black text-slate-900">
              <Star className="text-amber-400" size={14} />
              {ratingCount > 0
                ? rating.toFixed(1)
                : isFa
                  ? "هنوز امتیازی نیست"
                  : "No ratings yet"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
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

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <Link
            className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
            to={teacherPath}
          >
            {labels.viewProfile || "Details"}
          </Link>
          <button
            type="button"
            onClick={handleShareTeacher}
            aria-label={isFa ? "اشتراک‌گذاری مدرس" : "Share teacher"}
            className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
          >
            <Share2 size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}
