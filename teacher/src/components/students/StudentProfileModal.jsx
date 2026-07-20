import { useMemo, useState } from "react";

const tabs = ["خلاصه", "حضور", "تکالیف"];

const statusStyle = {
  active: "bg-[#DCFCE7] text-[#10B981]",
  followup: "bg-[#FEF3C7] text-[#F59E0B]",
  excellent: "bg-[#EDE9FE] text-[#8B5CF6]",
  low_attendance: "bg-[#FEE2E2] text-[#EF4444]",
};

const emptyValue = "ثبت نشده";
const STUDENT_AVATAR_FALLBACK = "/logo.png";

export default function StudentProfileModal({ student, open, onClose }) {
  const [activeTab, setActiveTab] = useState("خلاصه");

  const details = useMemo(() => {
    if (!student) {
      return [];
    }

    return [
      { label: "ایمیل", value: student.email || emptyValue },
      { label: "شماره تماس", value: student.phone || emptyValue },
      { label: "کد شاگرد", value: student.studentCode || emptyValue },
      { label: "کورس", value: student.course || emptyValue },
      { label: "پیشرفت", value: `${student.progress}%` },
      { label: "حضور", value: `${student.attendance}%` },
      { label: "تکالیف ارسال‌شده", value: student.assignments },
      { label: "آخرین فعالیت", value: student.lastActivity },
      { label: "کشور", value: student.country || emptyValue },
      { label: "ولایت", value: student.city || emptyValue },
      { label: "صنف/سطح", value: student.gradeLevel || emptyValue },
      { label: "مکتب", value: student.schoolName || emptyValue },
      { label: "وضعیت ثبت‌نام", value: student.enrollmentStatus || emptyValue },
      { label: "دسترسی", value: student.accessStatus || emptyValue },
    ];
  }, [student]);

  if (!open || !student) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-2 sm:p-4" onClick={onClose}>
      <div
        className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-3">
          <img
            src={student.avatar || STUDENT_AVATAR_FALLBACK}
            alt={student.name}
            className="h-16 w-16 rounded-full border border-slate-200 object-cover"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = STUDENT_AVATAR_FALLBACK;
            }}
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-black text-slate-900">{student.name}</h3>
            <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[student.status]}`}>
              {student.statusLabel}
            </span>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold ${
                activeTab === tab
                  ? "border-[#0B4FD8] bg-[#0B4FD8] text-white"
                  : "border-[#E2E8F0] text-slate-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          {activeTab === "خلاصه" ? (
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {details.map((item) => (
                <div key={item.label} className="rounded-lg bg-white p-3">
                  <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                  <p className="mt-1 font-bold text-slate-800">{item.value}</p>
                </div>
              ))}
              <div className="rounded-lg bg-white p-3 sm:col-span-2">
                <p className="text-xs font-semibold text-slate-500">یادداشت</p>
                <p className="mt-1 text-sm text-slate-700">
                  {student.notes || emptyValue}
                </p>
              </div>
            </div>
          ) : activeTab === "حضور" ? (
            <div className="rounded-lg bg-white p-4 text-sm text-slate-700">
              <p className="font-bold">حضور: {student.attendance}%</p>
              <p className="mt-2 text-slate-500">
                {student.hasAttendanceData ? "بر اساس جلسات ثبت‌شده این کورس." : "حضور برای این شاگرد هنوز ثبت نشده است."}
              </p>
            </div>
          ) : activeTab === "تکالیف" ? (
            <div className="rounded-lg bg-white p-4 text-sm text-slate-700">
              <p className="font-bold">تکالیف ارسال‌شده: {student.assignments}</p>
              <p className="mt-2 text-slate-500">
                {Number(student.assignmentTotal || 0) > 0
                  ? `از مجموع ${student.assignmentTotal} تکلیف منتشرشده برای این کورس.`
                  : "برای این کورس هنوز تکلیف منتشرشده ثبت نشده است."}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-white p-4 text-sm text-slate-600">
              <p>اطلاعاتی برای نمایش وجود ندارد.</p>
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled
            className="h-11 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-600"
          >
            مشاهده تکالیف
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
