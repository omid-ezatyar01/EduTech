import { formatUsd } from "../../services/purchaseService.js";

export default function FinancialSummaryCard({
  paidAmount = 0,
  pendingAmount = 0,
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "خلاصه مالی" : "Financial Summary",
    subtitle: isFa ? "بر اساس داده واقعی" : "Based on real data",
    netPaid: isFa ? "خالص پرداخت موفق" : "Net successful payment",
    paid: isFa ? "پرداخت موفق" : "Successful Payments",
    pending: isFa ? "در انتظار" : "Pending",
  };

  const netTotal = Math.max(0, paidAmount);
  const ringTotal = Math.max(1, paidAmount + pendingAmount);
  const ringRadius = 80;
  const ringStroke = 20;
  const circleSize = 192;
  const circleCenter = circleSize / 2;
  const circumference = 2 * Math.PI * ringRadius;

  const paidOffset = circumference * (1 - paidAmount / ringTotal);
  const pendingOffset = circumference * (1 - pendingAmount / ringTotal);

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-black text-slate-950">{t.title}</h3>
      <p className="text-xs font-bold text-slate-500 mt-1">{t.subtitle}</p>

      <div className="relative mx-auto mt-6 flex h-56 w-56 items-center justify-center sm:h-60 sm:w-60">
        <svg
          viewBox={`0 0 ${circleSize} ${circleSize}`}
          className="absolute inset-0 h-full w-full -rotate-90 transform"
          aria-hidden="true"
        >
          <circle
            cx={circleCenter}
            cy={circleCenter}
            r={ringRadius}
            className="stroke-slate-100"
            strokeWidth={ringStroke}
            fill="none"
          />
          <circle
            cx={circleCenter}
            cy={circleCenter}
            r={ringRadius}
            className="stroke-primary-500"
            strokeWidth={ringStroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={paidOffset}
          />
          <circle
            cx={circleCenter}
            cy={circleCenter}
            r={ringRadius}
            className="stroke-teal-500"
            strokeWidth={ringStroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={pendingOffset}
          />
        </svg>
        <div className="text-center">
          <span className="text-2xl font-black text-slate-900" dir="ltr">
            {formatUsd(netTotal, language)}
          </span>
          <p className="text-[10px] font-bold text-slate-500 mt-1">
            {t.netPaid}
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-bold text-slate-700">
            <span className="h-3 w-3 rounded-full bg-primary-500"></span>{t.paid}
          </span>
          <span className="font-black text-slate-900" dir="ltr">
            {formatUsd(paidAmount, language)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-bold text-slate-700">
            <span className="h-3 w-3 rounded-full bg-teal-500"></span>{t.pending}
          </span>
          <span className="font-black text-slate-900" dir="ltr">
            {formatUsd(pendingAmount, language)}
          </span>
        </div>
      </div>
    </div>
  );
}
