import {
  FileText,
  Headphones,
  Mic,
  Code,
  Upload,
  Info,
  Eye,
  Lock,
} from "lucide-react";

const iconMap = {
  FileText,
  Headphones,
  Mic,
  Code,
};

const statusStyles = {
  pending: {
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    iconBg: "bg-gradient-to-br from-blue-500 to-purple-600",
  },
  submitted: {
    badge: "bg-green-50 text-green-700 border-green-200",
    iconBg: "bg-gradient-to-br from-teal-400 to-teal-600",
  },
  reviewed: {
    badge: "bg-primary-50 text-primary-700 border-primary-200",
    iconBg: "bg-gradient-to-br from-purple-500 to-pink-500",
  },
  locked: {
    badge: "bg-slate-50 text-slate-500 border-slate-200",
    iconBg: "bg-gradient-to-br from-slate-300 to-slate-400",
  },
};

export default function AssignmentItem({
  assignment,
  onAction,
  onDetails,
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    teacher: isFa ? "استاد" : "Teacher",
    deadline: isFa ? "مهلت" : "Deadline",
    submit: isFa ? "ارسال پاسخ" : "Submit Response",
    teacherComment: isFa ? "نظر استاد" : "Teacher Feedback",
    viewGrade: isFa ? "مشاهده نمره" : "View Grade",
    awaitingApproval: isFa ? "در انتظار تایید کورس" : "Waiting for course approval",
    details: isFa ? "جزئیات" : "Details",
  };
  const Icon = iconMap[assignment.icon] || FileText;
  const style = statusStyles[assignment.status];

  return (
    <div className="relative flex h-full flex-col gap-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary-100 hover:shadow-md sm:flex-row">
      {/* Icon Area */}
      <div
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-md ${style.iconBg}`}
      >
        {assignment.status === "locked" ? (
          <Lock size={28} />
        ) : (
          <Icon size={28} />
        )}
      </div>

      {/* Main Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black ${style.badge}`}
          >
            {assignment.statusLabel}
          </span>
          <span className="text-xs font-bold text-slate-500">
            • {assignment.course}
          </span>
        </div>
        <h3 className="text-lg font-black text-slate-950">
          {assignment.title}
        </h3>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600 line-clamp-2 sm:line-clamp-1">
          {assignment.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="text-slate-400">{t.teacher}:</span> {assignment.teacher}
          </span>
          {assignment.status !== "locked" && assignment.deadline ? (
            <>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400">{t.deadline}:</span>{" "}
                <span
                  className={
                    assignment.status === "pending" ? "text-amber-600" : ""
                  }
                >
                  {assignment.deadline}
                  {assignment.time ? ` - ${assignment.time}` : ""}
                </span>
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col justify-center gap-2 sm:w-40 sm:border-s sm:border-slate-100 sm:ps-5">
        {assignment.status === "pending" && (
          <button
            onClick={() => onAction(assignment)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-primary-700"
          >
            <Upload size={16} /> {t.submit}
          </button>
        )}
        {assignment.status === "submitted" && (
          <button
            onClick={() => onAction(assignment)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-500 bg-teal-50 py-3 text-sm font-black text-teal-700 transition hover:bg-teal-100"
          >
            <Eye size={16} /> {t.teacherComment}
          </button>
        )}
        {assignment.status === "reviewed" && (
          <button
            onClick={() => onAction(assignment)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary-500 bg-primary-50 py-3 text-sm font-black text-primary-700 transition hover:bg-primary-100"
          >
            <Eye size={16} /> {t.viewGrade}
          </button>
        )}
        {assignment.status === "locked" && (
          <button
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-xs font-black text-slate-400"
          >
            {t.awaitingApproval}
          </button>
        )}
        <button
          onClick={() => onDetails(assignment)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
        >
          <Info size={16} /> {t.details}
        </button>
      </div>
    </div>
  );
}
