import { X, Award, CheckCircle2 } from "lucide-react";

export default function TeacherFeedbackModal({
  isOpen,
  onClose,
  assignment,
  language = "fa",
}) {
  const isFa = language === "fa";
  if (!isOpen || !assignment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
        <button
          onClick={onClose}
          className="absolute left-6 top-6 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-black text-slate-950 mb-2">
          {isFa ? "نظر استاد" : "Teacher Feedback"}
        </h2>
        <p className="text-sm font-bold text-slate-500 mb-6">
          {assignment.title}
        </p>

        {assignment.status === "reviewed" ? (
          <div className="space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-600 mb-2">
              <Award size={40} />
            </div>
            <p className="text-sm font-black text-slate-700">
              {isFa ? "نمره کسب شده:" : "Score:"}
            </p>
            <p className="text-4xl font-black text-slate-950" dir="ltr">
              {assignment.grade}
            </p>
            <div className="rounded-2xl bg-slate-50 p-5 mt-4 text-sm font-semibold leading-7 text-slate-700 text-start border border-slate-100">
              <p className="font-black text-slate-900 mb-2">
                {isFa ? "بازخورد:" : "Feedback:"}
              </p>
              {assignment.feedback}
            </div>
          </div>
        ) : (
          <div className="py-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-600 mb-4">
              <CheckCircle2 size={32} />
            </div>
            <p className="text-base font-black text-slate-800 leading-7">
              {isFa
                ? "تمرین شما دریافت شد و در حال بررسی است."
                : "Your assignment was received and is under review."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
