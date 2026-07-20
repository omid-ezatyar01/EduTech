import { Ban, Edit3, Eye, PlayCircle, Send, Trash2 } from "lucide-react";
import { formatProgressLabel } from "../../utils/courseProgress";

const COURSE_IMAGE_FALLBACK = "/logo.png";

function Thumbnail({ src, type, title }) {
  const map = {
    mern: "from-slate-800 to-teal-700",
    api: "from-slate-900 to-blue-700",
    python: "from-slate-800 to-[#8B5CF6]",
  };

  return (
    <div className={`relative h-12 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br ${map[type] || map.mern}`}>
      <img
        src={src || COURSE_IMAGE_FALLBACK}
        alt={title || "Course"}
        className={`h-full w-full ${src ? "bg-slate-50 object-contain" : "bg-white object-contain p-2"}`}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = COURSE_IMAGE_FALLBACK;
          event.currentTarget.className = "h-full w-full bg-white object-contain p-2";
        }}
      />
    </div>
  );
}

export default function TeacherCourseRow({
  course,
  language,
  isRTL,
  onEdit,
  onDetails,
  onDelete,
  onStartClass,
  onRequestEndReview,
  onRequestCancel,
}) {
  const statusClassMap = {
    published: "bg-[#10B981]/10 text-[#10B981]",
    approved: "bg-blue-100 text-blue-700",
    pending: "bg-amber-100 text-amber-700",
    draft: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
    rejected: "bg-red-100 text-red-700",
  };
  const statusClass = course.classEndedAt
    ? "bg-[#0B4FD8]/10 text-[#0B4FD8]"
    : course.status === "cancelled" || course.classCancelledAt
      ? "bg-rose-100 text-rose-700"
    : course.cancellationRequest?.status === "pending"
      ? "bg-amber-100 text-amber-700"
    : course.endRequest?.status === "pending"
      ? "bg-sky-100 text-sky-700"
    : course.classStartedAt
      ? "bg-emerald-100 text-emerald-700"
    : (statusClassMap[course.status] || "bg-slate-100 text-slate-700");
  const canStartClass =
    course.status === "published" &&
    course.canStartToday &&
    !course.classStartedAt &&
    !course.classEndedAt;
  const startClassTitle = course.classStartedAt
    ? "Class started"
    : course.classEndedAt
      ? "Class ended"
      : course.status !== "published"
        ? "Publish course first"
        : !course.canStartToday
          ? "Can start only on course start date"
          : !course.minimumStudentsReached
            ? "Minimum students not reached yet, but teacher can still start manually"
          : "Start class";
  const canRequestEndReview =
    Boolean(course.classStartedAt) &&
    !course.classEndedAt &&
    course.endRequest?.status !== "pending";
  const requestEndTitle = course.endRequest?.status === "pending"
    ? "End request pending"
    : course.classEndedAt
      ? "Class ended"
      : !course.classStartedAt
        ? "Start class first"
        : "Request admin end review";
  const canRequestCancel =
    course.status !== "cancelled" &&
    !course.classCancelledAt &&
    !course.classEndedAt &&
    course.cancellationRequest?.status !== "pending";
  const canEditCourse = !course.classEndedAt;
  const canDeleteCourse = !course.classEndedAt;
  const cancelTitle = course.cancellationRequest?.status === "pending"
    ? "Cancellation request pending"
    : course.status === "cancelled" || course.classCancelledAt
      ? "Class cancelled"
      : course.classEndedAt
        ? "Class ended"
        : "Request cancellation";

  return (
    <tr className="border-b border-[#E2E8F0] transition hover:bg-slate-50/70 last:border-b-0">
      <td className="px-4 py-4">
        <div className="flex min-w-0 items-center justify-start gap-3">
          <Thumbnail src={course.thumbnailUrl} type={course.thumbnailType} title={course.title} />
          <div className={`min-w-0 ${isRTL ? "text-right" : "text-left"}`}>
            <p className="line-clamp-2 text-sm font-extrabold leading-6 text-[#0F172A] xl:text-[15px]">{course.title}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-4 text-center">
        <span className="inline-flex min-w-11 items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
          {course.students}
        </span>
      </td>
      <td className="px-3 py-4">
        <div className="mx-auto w-full max-w-40">
          <div className="mb-1.5 flex items-center justify-center text-xs font-black text-slate-600">
            <span dir="ltr">{course.progressLabel || formatProgressLabel(course.progress, language)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9]"
              style={{ width: `${course.progress}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-3 py-4 text-center">
        <span className={`inline-flex max-w-full items-center justify-center rounded-full px-3 py-1.5 text-xs font-bold ${statusClass}`}>
          {course.statusLabel}
        </span>
      </td>
      <td className="px-3 py-4 text-center text-sm font-semibold text-slate-600">{course.createdAt}</td>
      <td className="px-4 py-4 text-center">
        <div className="mx-auto flex w-fit flex-nowrap items-center justify-center gap-1 xl:gap-1.5">
          <button
            type="button"
            onClick={onDetails}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0B4FD8] xl:h-9 xl:w-9"
            title="View"
          >
            <Eye size={16} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={!canEditCourse}
            className={`grid h-8 w-8 place-items-center rounded-lg xl:h-9 xl:w-9 ${
              canEditCourse
                ? "text-slate-500 hover:bg-slate-100 hover:text-[#0B4FD8]"
                : "cursor-not-allowed text-slate-300"
            }`}
            title={canEditCourse ? "Edit" : "Ended course"}
          >
            <Edit3 size={16} />
          </button>
          <button
            type="button"
            onClick={onStartClass}
            disabled={!canStartClass}
            className={`grid h-8 w-8 place-items-center rounded-lg xl:h-9 xl:w-9 ${
              !canStartClass
                ? "cursor-not-allowed text-emerald-600/45"
                : "text-slate-500 hover:bg-sky-50 hover:text-sky-600"
            }`}
            title={startClassTitle}
          >
            <PlayCircle size={16} />
          </button>
          <button
            type="button"
            onClick={onRequestEndReview}
            disabled={!canRequestEndReview}
            className={`grid h-8 w-8 place-items-center rounded-lg xl:h-9 xl:w-9 ${
              canRequestEndReview
                ? "text-slate-500 hover:bg-sky-50 hover:text-sky-600"
                : "cursor-not-allowed text-sky-600/40"
            }`}
            title={requestEndTitle}
          >
            <Send size={16} />
          </button>
          <button
            type="button"
            onClick={onRequestCancel}
            disabled={!canRequestCancel}
            className={`grid h-8 w-8 place-items-center rounded-lg xl:h-9 xl:w-9 ${
              canRequestCancel
                ? "text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                : "cursor-not-allowed text-rose-600/40"
            }`}
            title={cancelTitle}
          >
            <Ban size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!canDeleteCourse}
            className={`grid h-8 w-8 place-items-center rounded-lg xl:h-9 xl:w-9 ${
              canDeleteCourse
                ? "text-slate-500 hover:bg-red-50 hover:text-[#EF4444]"
                : "cursor-not-allowed text-slate-300"
            }`}
            title={canDeleteCourse ? "Delete" : "Ended course"}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}
