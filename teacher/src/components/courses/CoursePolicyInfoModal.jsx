import { ShieldCheck, X } from "lucide-react";
import { useEffect } from "react";

export default function CoursePolicyInfoModal({
  policy,
  language = "fa",
  isRTL = true,
  onClose,
}) {
  const open = Boolean(policy);
  const isFa = language === "fa";

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const title = isFa ? policy.titleFa : policy.titleEn;
  const intro = isFa ? policy.introFa : policy.introEn;
  const points = isFa ? policy.pointsFa : policy.pointsEn;

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end justify-center bg-slate-950/65 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-policy-modal-title"
        className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700">
              <ShieldCheck size={21} />
            </span>
            <div>
              <p className="text-[11px] font-black text-primary-700">
                {isFa ? "توضیح قانون کورس" : "Course policy details"}
              </p>
              <h3
                id="course-policy-modal-title"
                className="mt-1 text-lg font-black leading-7 text-slate-950"
              >
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isFa ? "بستن" : "Close"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={19} />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          <p className="rounded-2xl border border-primary-100 bg-primary-50/60 p-4 text-sm font-bold leading-7 text-slate-700">
            {intro}
          </p>
          <ul className="mt-4 space-y-3">
            {points.map((point, index) => (
              <li
                key={point}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-sm font-semibold leading-7 text-slate-700"
              >
                <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-[11px] font-black text-emerald-700">
                  {index + 1}
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-xl bg-primary-600 px-5 text-sm font-black text-white transition hover:bg-primary-700"
          >
            {isFa ? "متوجه شدم" : "I understand"}
          </button>
        </footer>
      </section>
    </div>
  );
}
