import {
  Video,
  FileText,
  Headphones,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { resolveAvatarUrl } from "../utils/avatar";

const COURSE_IMAGE_FALLBACK = "/logo-en.png";

function getInitials(value = "") {
  const words = String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "T";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

export default function StudentCourseCard({
  course,
  onOpenStatusModal,
  language = "fa",
}) {
  const isFa = language === "fa";
  const isActive = course.status === "active";
  const [failedAvatarKey, setFailedAvatarKey] = useState("");
  const teacherAvatar = resolveAvatarUrl(String(course.teacherAvatar || "").trim());
  const avatarKey = `${course.id || course._id || ""}:${teacherAvatar}`;
  const hasTeacherAvatar = Boolean(teacherAvatar) && failedAvatarKey !== avatarKey;
  const teacherInitials = getInitials(course.teacher);

  return (
    <div className="flex flex-col md:flex-row gap-4 sm:gap-6 rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm transition hover:border-primary-100 hover:shadow-md">
      {/* Banner / Image */}
      <div className="w-full shrink-0 overflow-hidden rounded-2xl md:w-[280px] md:h-[180px] h-[120px] sm:h-[160px]">
        <img
          src={course.thumbnail || COURSE_IMAGE_FALLBACK}
          alt={course.title}
          className={`h-full w-full bg-white ${course.thumbnail ? "object-contain" : "object-contain p-6"}`}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = COURSE_IMAGE_FALLBACK;
            event.currentTarget.className = "h-full w-full bg-white object-contain p-6";
          }}
        />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-center py-1">
        <div className="mb-2 flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black ${
              isActive
                ? "bg-green-50 text-green-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {isActive ? <CheckCircle2 size={14} /> : <Clock size={14} />}
            {course.statusLabel}
          </span>
        </div>

        <h3 className="text-lg sm:text-xl font-black text-slate-950">
          {course.title}
        </h3>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600 line-clamp-2">
          {course.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1">
            <Video size={14} /> {isFa ? "صنف آنلاین" : "Live Class"}
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>{course.level}</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>{isFa ? `مدت: ${course.duration}` : `Duration: ${course.duration}`}</span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {hasTeacherAvatar ? (
            <img
              src={teacherAvatar}
              alt={course.teacher}
              className="h-6 w-6 rounded-full border border-slate-200 bg-white object-cover object-center"
              onError={() => setFailedAvatarKey(avatarKey)}
            />
          ) : (
            <div className="grid h-6 w-6 place-items-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-black text-slate-600">
              {teacherInitials}
            </div>
          )}
          <span className="text-sm font-bold text-slate-700">
            {course.teacher}
          </span>
        </div>
      </div>

      {/* Actions & Progress */}
      <div className="flex w-full shrink-0 flex-col justify-center gap-4 border-t border-slate-100 mt-2 sm:mt-0 pt-4 sm:pt-5 md:w-[240px] md:border-s md:border-t-0 md:ps-6 md:pt-0">
        <div className="w-full">
          <div className="mb-2 flex items-center justify-between text-xs font-bold">
            <span className="text-slate-500">{isFa ? "پیشرفت کورس" : "Course Progress"}</span>
            <span className="text-slate-900">{course.progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${isActive ? "bg-gradient-to-r from-primary-500 to-teal-400" : "bg-slate-300"}`}
              style={{ width: `${course.progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-[10px] font-bold text-slate-500">{isFa ? "صنف بعدی:" : "Next class:"}</p>
          <p className="mt-1 text-xs font-black text-slate-800">
            {course.nextClass}
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          {isActive ? (
            null
          ) : (
            <>
              <button
                onClick={() => onOpenStatusModal(course)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                <FileText size={18} /> {isFa ? "جزئیات ثبت‌نام" : "Enrollment Details"}
              </button>
              <Link
                to="/student/messages"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 text-sm font-black text-amber-700 transition hover:bg-amber-100"
              >
                <Headphones size={18} /> {isFa ? "تماس با پشتیبانی" : "Contact Support"}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
