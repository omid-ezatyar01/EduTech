import { CalendarCheck, ClipboardPlus, Download } from "lucide-react";

const actions = [
  {
    key: "createAssignment",
    label: "ایجاد تمرین",
    icon: ClipboardPlus,
    className: "bg-[#DCFCE7] text-[#10B981]",
  },
  {
    key: "attendanceReport",
    label: "گزارش حضور",
    icon: CalendarCheck,
    className: "bg-[#FEF3C7] text-[#F59E0B]",
  },
  {
    key: "downloadList",
    label: "دانلود لیست شاگردان",
    icon: Download,
    className: "bg-[#EDE9FE] text-[#8B5CF6]",
  },
];

export default function StudentQuickActionsCard({ onAction }) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <h3 className="text-base font-extrabold text-slate-900">اقدامات سریع</h3>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => onAction(action.key)}
            className={`flex items-center gap-2 rounded-xl px-3 py-3 text-right text-sm font-semibold transition hover:brightness-95 ${action.className}`}
          >
            <action.icon size={16} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
