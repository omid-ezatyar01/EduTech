import { Eye, MoreVertical } from "lucide-react";

const statusBadgeStyles = {
  active: "bg-[#DCFCE7] text-[#10B981]",
  followup: "bg-[#FEF3C7] text-[#F59E0B]",
  excellent: "bg-[#EDE9FE] text-[#8B5CF6]",
  low_attendance: "bg-[#FEE2E2] text-[#EF4444]",
};
const STUDENT_AVATAR_FALLBACK = "/logo.png";

export default function TeacherStudentRow({
  student,
  mobile = false,
  onView,
  onMoreToggle,
  moreOpen,
  onMoreAction,
}) {
  const statusStyle = statusBadgeStyles[student.status] || "bg-slate-100 text-slate-700";

  if (mobile) {
    return (
      <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-3">
          <img
            src={student.avatar || STUDENT_AVATAR_FALLBACK}
            alt={student.name}
            className="h-12 w-12 rounded-full border border-slate-200 object-cover"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = STUDENT_AVATAR_FALLBACK;
            }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{student.name}</p>
            <p className="truncate text-xs text-slate-500">{student.course}</p>
          </div>
          <span className={`ms-auto rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle}`}>{student.statusLabel}</span>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>پیشرفت</span>
              <span className="font-semibold text-slate-700">{student.progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-[#00B8A9]" style={{ width: `${student.progress}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <p>حضور: {student.attendance}%</p>
            <p>تکالیف: {student.assignments}</p>
            <p>فعالیت: {student.lastActivity}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onView(student)}
            className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[#0B4FD8] hover:text-[#0B4FD8]"
          >
            پروفایل
          </button>
          <button
            type="button"
            onClick={() => onMoreToggle(student.id)}
            className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[#0B4FD8] hover:text-[#0B4FD8]"
          >
            بیشتر
          </button>
        </div>

        {moreOpen ? (
          <div className="mt-2 space-y-1 rounded-xl border border-[#E2E8F0] bg-white p-2 text-xs">
            {[
              "مشاهده پروفایل",
              "مشاهده تمرین‌ها",
              "گزارش حضور",
              "علامت‌گذاری نیازمند پیگیری",
            ].map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => onMoreAction(action, student)}
                className="w-full rounded-lg px-2 py-1.5 text-right text-slate-700 hover:bg-slate-50"
              >
                {action}
              </button>
            ))}
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <tr className="border-b border-[#E2E8F0] text-sm last:border-b-0 hover:bg-slate-50/70">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <img
            src={student.avatar || STUDENT_AVATAR_FALLBACK}
            alt={student.name}
            className="h-10 w-10 rounded-full border border-slate-200 object-cover"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = STUDENT_AVATAR_FALLBACK;
            }}
          />
          <p className="font-bold text-slate-900">{student.name}</p>
        </div>
      </td>
      <td className="px-4 py-4 text-slate-700">{student.course}</td>
      <td className="px-4 py-4">
        <div className="w-32">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>{student.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-[#00B8A9]" style={{ width: `${student.progress}%` }} />
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-slate-700">{student.attendance}%</td>
      <td className="px-4 py-4 text-slate-700">{student.assignments}</td>
      <td className="px-4 py-4 text-slate-700">{student.lastActivity}</td>
      <td className="px-4 py-4">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle}`}>{student.statusLabel}</span>
      </td>
      <td className="relative px-4 py-4">
        <div className="flex items-center gap-1 text-slate-500">
          <button
            type="button"
            onClick={() => onView(student)}
            className="rounded-lg p-2 transition hover:bg-[#0B4FD8]/10 hover:text-[#0B4FD8]"
            aria-label="مشاهده پروفایل"
          >
            <Eye size={16} />
          </button>
          <button
            type="button"
            onClick={() => onMoreToggle(student.id)}
            className="rounded-lg p-2 transition hover:bg-[#0B4FD8]/10 hover:text-[#0B4FD8]"
            aria-label="عملیات بیشتر"
          >
            <MoreVertical size={16} />
          </button>
        </div>

        {moreOpen ? (
          <div className="absolute left-4 top-12 z-10 w-48 rounded-xl border border-[#E2E8F0] bg-white p-2 shadow-lg">
            {[
              "مشاهده پروفایل",
              "مشاهده تمرین‌ها",
              "گزارش حضور",
              "علامت‌گذاری نیازمند پیگیری",
            ].map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => onMoreAction(action, student)}
                className="w-full rounded-lg px-3 py-2 text-right text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {action}
              </button>
            ))}
          </div>
        ) : null}
      </td>
    </tr>
  );
}
