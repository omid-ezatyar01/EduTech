import { Ban, Edit3, Eye, PlayCircle, Send } from "lucide-react";
import { formatProgressLabel } from "../../utils/courseProgress";

const COURSE_IMAGE_FALLBACK = "/logo.png";

function Thumbnail({ src, type, title }) {
  const map = {
    mern: "from-slate-800 to-teal-700",
    api: "from-slate-900 to-blue-700",
    python: "from-slate-800 to-[#8B5CF6]",
  };

  return (
    <div className={`relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${map[type] || map.mern}`}>
      <img
        src={src || COURSE_IMAGE_FALLBACK}
        alt={title || "Course"}
        className={`h-full w-full ${src ? "bg-slate-50 object-contain" : "bg-white object-contain p-6"}`}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = COURSE_IMAGE_FALLBACK;
          event.currentTarget.className = "h-full w-full bg-white object-contain p-6";
        }}
      />
    </div>
  );
}

export default function TeacherCourseCard({
  course,
  language,
  onEdit,
  onDetails,
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
          ? "Available when the scheduled time is reached"
          : !course.minimumStudentsReached
            ? "Minimum students not reached yet, but teacher can still start manually"
          : "Start course officially";
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
    !course.isBootcampInternal &&
    course.status !== "cancelled" &&
    !course.classCancelledAt &&
    !course.classEndedAt &&
    course.cancellationRequest?.status !== "pending";
  const canEditCourse =
    !course.isBootcampInternal &&
    !course.classEndedAt &&
    course.lifecycleStatus !== "pending_review";
  const cancelTitle = course.cancellationRequest?.status === "pending"
    ? "Cancellation request pending"
    : course.status === "cancelled" || course.classCancelledAt
      ? "Class cancelled"
      : course.classEndedAt
        ? "Class ended"
        : "Request cancellation";

  const labels = {
    students: language === "fa" ? "شاگردان" : "Students",
    progress: language === "fa" ? "پیشرفت کورس" : "Course Progress",
    status: language === "fa" ? "وضعیت" : "Status",
    created: language === "fa" ? "تاریخ ایجاد" : "Created",
    actions: language === "fa" ? "عملیات" : "Actions",
    view: language === "fa" ? "دیدن جزئیات" : "View details",
    edit: language === "fa" ? "ویرایش" : "Edit",
    start: language === "fa" ? "شروع رسمی کورس" : "Start course officially",
    endReview: language === "fa" ? "درخواست پایان" : "Request end review",
    cancel: language === "fa" ? "درخواست لغو" : "Request cancel",
  };

  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-4">
      <Thumbnail src={course.thumbnailUrl} type={course.thumbnailType} title={course.title} />
      <h4 className="mt-3 break-words text-base font-black leading-7 text-[#0F172A]">{course.title}</h4>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[11px] font-black text-slate-500">{labels.students}</p>
          <p className="mt-1 text-sm font-black text-slate-900">{course.students}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[11px] font-black text-slate-500">{labels.created}</p>
          <p className="mt-1 text-sm font-black text-slate-900">{course.createdAt}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[11px] font-black text-slate-500">{labels.progress}</p>
            <span className="text-xs font-black text-slate-700" dir="ltr">
              {course.progressLabel || formatProgressLabel(course.progress, language)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9]"
              style={{ width: `${course.progress}%` }}
            />
          </div>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[11px] font-black text-slate-500">{labels.status}</p>
          <div className="flex max-w-[72%] flex-col items-end gap-1">
            <span className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-bold ${statusClass}`}>
              {course.statusLabel}
            </span>
            {course.publicStatusLabel ? (
              <span className="text-[10px] font-black text-slate-500">
                {language === "fa" ? "نمایش شاگرد: " : "Student view: "}
                {course.publicStatusLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11px] font-black text-slate-500">{labels.actions}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-1.5">
        <button type="button" onClick={onDetails} aria-label={labels.view} title={labels.view} className="flex h-10 items-center justify-center rounded-lg border border-[#E2E8F0] text-slate-600 hover:bg-slate-50 hover:text-[#0B4FD8]"><Eye size={16} /></button>
        <button
          type="button"
          onClick={onEdit}
          disabled={!canEditCourse}
          aria-label={labels.edit}
          title={canEditCourse ? labels.edit : (language === "fa" ? "کورس پایان یافته است" : "Course ended")}
          className={`flex h-10 items-center justify-center rounded-lg border ${
            canEditCourse
              ? "border-[#E2E8F0] text-slate-600 hover:bg-slate-50 hover:text-[#0B4FD8]"
              : "cursor-not-allowed border-slate-200 text-slate-300"
          }`}
        ><Edit3 size={16} /></button>
        <button
          type="button"
          onClick={onStartClass}
          disabled={!canStartClass}
          aria-label={labels.start}
          className={`flex h-10 items-center justify-center rounded-lg border ${
            !canStartClass
              ? "cursor-not-allowed border-emerald-200 text-emerald-600/45"
              : "border-sky-200 text-sky-600 hover:bg-sky-50"
          }`}
          title={startClassTitle}
        >
          <PlayCircle size={16} />
        </button>
        <button
          type="button"
          onClick={onRequestEndReview}
          disabled={!canRequestEndReview}
          title={requestEndTitle}
          aria-label={labels.endReview}
          className={`flex h-10 items-center justify-center rounded-lg border ${
            canRequestEndReview
              ? "border-sky-200 text-sky-600 hover:bg-sky-50"
              : "cursor-not-allowed border-sky-100 text-sky-600/40"
          }`}
        >
          <Send size={16} />
        </button>
        <button
          type="button"
          onClick={onRequestCancel}
          disabled={!canRequestCancel}
          title={cancelTitle}
          aria-label={labels.cancel}
          className={`flex h-10 items-center justify-center rounded-lg border ${
            canRequestCancel
              ? "border-rose-200 text-rose-600 hover:bg-rose-50"
              : "cursor-not-allowed border-rose-100 text-rose-600/40"
          }`}
        >
          <Ban size={16} />
        </button>
        </div>
      </div>
    </article>
  );
}
