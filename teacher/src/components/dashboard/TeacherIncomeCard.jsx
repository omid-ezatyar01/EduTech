import { useEffect, useState } from "react";

const formatUsd = (value, language = "fa") => {
  const amount = Number(value || 0);
  const amountLabel = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${amountLabel} ${language === "fa" ? "دالر" : "USD"}`;
};
const DEFAULT_MONTHLY_GOAL_USD = 1500;
const MAX_MONTHLY_GOAL_USD = 1000000;
const normalizeGoalValue = (value) => {
  const numeric = Number(String(value ?? "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(numeric)) return DEFAULT_MONTHLY_GOAL_USD;
  return Math.max(0, Math.min(MAX_MONTHLY_GOAL_USD, Math.round(numeric)));
};

export default function TeacherIncomeCard({
  language,
  monthIncome = 0,
  monthlyGoal = DEFAULT_MONTHLY_GOAL_USD,
  onMonthlyGoalChange,
}) {
  const safeIncome = Math.max(0, Number(monthIncome || 0));
  const targetIncome = normalizeGoalValue(monthlyGoal);
  const [draftGoal, setDraftGoal] = useState(String(targetIncome));
  const achievedIncome = Math.min(safeIncome, targetIncome);
  const remainingIncome = Math.max(0, targetIncome - achievedIncome);
  const progressPercent = targetIncome > 0 ? Math.round((achievedIncome / targetIncome) * 100) : 0;

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const achievedArc = circumference * (progressPercent / 100);
  const remainingArc = Math.max(0, circumference - achievedArc);

  useEffect(() => {
    const timer = setTimeout(() => setDraftGoal(String(targetIncome)), 0);
    return () => clearTimeout(timer);
  }, [targetIncome]);

  const handleGoalSave = () => {
    const nextGoal = normalizeGoalValue(draftGoal);
    setDraftGoal(String(nextGoal));
    if (typeof onMonthlyGoalChange === "function") {
      onMonthlyGoalChange(nextGoal);
    }
  };

  const rows = [
    { labelFa: "درآمد این ماه", labelEn: "This Month", value: formatUsd(safeIncome, language), color: "text-[#0B4FD8]" },
    { labelFa: "هدف ماه", labelEn: "Monthly Goal", value: formatUsd(targetIncome, language), color: "text-[#0F172A]" },
    { labelFa: "باقی‌مانده تا هدف", labelEn: "Remaining To Goal", value: formatUsd(remainingIncome, language), color: "text-[#F59E0B]" },
  ];

  return (
    <section className="flex h-[360px] w-full flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black text-[#0F172A]">
        {language === "fa" ? "خلاصه درآمد" : "Income Summary"}
      </h3>
      <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
        <p className="text-xs font-bold text-slate-600">
          {language === "fa" ? "تنظیم هدف ماهانه (دالر)" : "Set monthly goal (USD)"}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={MAX_MONTHLY_GOAL_USD}
            step={100}
            value={draftGoal}
            onChange={(event) => setDraftGoal(event.target.value)}
            onBlur={handleGoalSave}
            className="h-10 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-bold text-slate-700"
            dir="ltr"
          />
          <button
            type="button"
            onClick={handleGoalSave}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#0B4FD8] px-3 text-xs font-black text-white"
          >
            {language === "fa" ? "ذخیره هدف" : "Save Goal"}
          </button>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pe-1">
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <div className="grid gap-4 sm:grid-cols-[120px_1fr] sm:items-center">
            <div className="relative mx-auto h-28 w-28">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="60" cy="60" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="12" />
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="#0B4FD8"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${achievedArc} ${remainingArc}`}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <p className="text-lg font-black text-[#0F172A]">{progressPercent}%</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0B4FD8]" />
                <p className="font-semibold text-slate-600">
                  {language === "fa" ? "درآمد ثبت‌شده" : "Recorded Income"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E2E8F0]" />
                <p className="font-semibold text-slate-600">
                  {language === "fa" ? "باقی‌مانده تا هدف" : "Remaining To Goal"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {rows.map((item) => (
            <div key={item.labelFa} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-3 py-2.5">
              <p className="text-sm font-bold text-slate-600">{language === "fa" ? item.labelFa : item.labelEn}</p>
              <p className={`text-sm font-black ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
