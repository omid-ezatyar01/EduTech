import { X, BookOpen, Clock, UserRound } from "lucide-react";

export default function AssignmentDetailsModal({
  isOpen,
  onClose,
  assignment,
  language = "fa",
}) {
  const isFa = language === "fa";
  if (!isOpen || !assignment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-[32px] bg-white p-6 sm:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute left-6 top-6 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-black text-slate-950 mb-6 pe-8">
          {isFa ? "جزئیات تمرین" : "Assignment Details"}
        </h2>

        <div className="space-y-5">
          <div>
            <h3 className="text-lg font-black text-primary-700">
              {assignment.title}
            </h3>
            <p className="mt-2 text-sm font-medium leading-7 text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
              {assignment.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <BookOpen size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500">
                  {isFa ? "کورس" : "Course"}
                </p>
                <p className="text-xs font-black text-slate-900">
                  {assignment.course}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <UserRound size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500">
                  {isFa ? "استاد" : "Teacher"}
                </p>
                <p className="text-xs font-black text-slate-900">
                  {assignment.teacher}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 col-span-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500">
                  {isFa ? "مهلت ارسال" : "Submission Deadline"}
                </p>
                <p className="text-xs font-black text-slate-900">
                  {assignment.deadline} {assignment.time}
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-8 w-full rounded-xl bg-slate-100 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
        >
          {isFa ? "بستن" : "Close"}
        </button>
      </div>
    </div>
  );
}
