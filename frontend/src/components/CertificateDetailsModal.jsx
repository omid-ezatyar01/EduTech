import { X, ExternalLink, CheckCircle2, Circle } from "lucide-react";
import { Link } from "react-router";

export default function CertificateDetailsModal({
  isOpen,
  onClose,
  certificate,
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "جزئیات سرتیفیکیت" : "Certificate Details",
    progress: isFa ? "پیشرفت کورس" : "Course Progress",
    remaining: isFa ? "نیازمندی‌های باقی‌مانده:" : "Remaining Requirements:",
    completedSessions: isFa ? "تکمیل تمام جلسات" : "Complete all sessions",
    pendingAssignments: isFa
      ? "ارسال تمرین‌های باقی‌مانده"
      : "Submit remaining assignments",
    finalProject: isFa ? "قبولی در پروژه نهایی" : "Pass the final project",
    goToCourse: isFa ? "رفتن به کورس" : "Go to Course",
  };

  if (!isOpen || !certificate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className={`absolute top-6 text-slate-400 transition hover:text-slate-600 ${
            isFa ? "left-6" : "right-6"
          }`}
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-black text-slate-950 mb-2">{t.title}</h2>
        <p className="text-sm font-bold text-primary-600 mb-6">
          {certificate.course}
        </p>

        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-sm font-bold">
            <span className="text-slate-700">{t.progress}</span>
            <span className="text-primary-600">{certificate.progress}٪</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-purple-500"
              style={{ width: `${certificate.progress}%` }}
            />
          </div>
        </div>

        <div className="mb-8">
          <h4 className="text-sm font-black text-slate-900 mb-4">
            {t.remaining}
          </h4>
          <ul className="space-y-3">
            <li className="flex items-center gap-3 text-sm font-semibold text-slate-600">
              <CheckCircle2 size={18} className="text-green-500" /> {t.completedSessions}
            </li>
            <li className="flex items-center gap-3 text-sm font-semibold text-slate-600">
              <Circle size={18} className="text-slate-300" /> {t.pendingAssignments}
            </li>
            <li className="flex items-center gap-3 text-sm font-semibold text-slate-600">
              <Circle size={18} className="text-slate-300" /> {t.finalProject}
            </li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Link
            to="/student/courses"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            <ExternalLink size={18} /> {t.goToCourse}
          </Link>
        </div>
      </div>
    </div>
  );
}
