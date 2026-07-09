import { BarChart3, Eye, MoreVertical } from "lucide-react";

const statusStyles = {
  active: "bg-[#DCFCE7] text-[#10B981]",
  completed: "bg-[#E2E8F0] text-slate-700",
  expired: "bg-[#FEE2E2] text-[#EF4444]",
  draft: "bg-[#DBEAFE] text-[#0B4FD8]",
};

const thumbStyles = {
  mern: "bg-gradient-to-l from-[#111827] to-[#1F2937]",
  api: "bg-gradient-to-l from-[#1E3A8A] to-[#0EA5E9]",
  mongodb: "bg-gradient-to-l from-[#065F46] to-[#10B981]",
  quiz: "bg-gradient-to-l from-[#581C87] to-[#8B5CF6]",
};

export default function TeacherAssignmentCard({ item, onView, onReports, moreOpen, onMoreToggle, onAction }) {
  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm relative">
      <div className="flex items-start gap-3">
        <div className={`h-12 w-12 rounded-xl ${thumbStyles[item.thumbnailType] || thumbStyles.api}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-[#0F172A]">{item.title}</p>
          <p className="mt-1 text-xs text-slate-500">{item.description}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <p>کورس: {item.course}</p>
        <p>نوع: {item.type}</p>
        <p>مهلت: {item.deadline}</p>
        <p>تسلیمی: {item.submitted}</p>
        <p>بررسی شده: {item.reviewed}</p>
        <p>
          <span className={`rounded-full px-2 py-1 font-bold ${statusStyles[item.status] || statusStyles.draft}`}>
            {item.statusLabel}
          </span>
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button type="button" onClick={() => onView(item)} className="rounded-xl border border-[#E2E8F0] py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <Eye size={14} className="mx-auto" />
        </button>
        <button type="button" onClick={() => onReports(item)} className="rounded-xl border border-[#E2E8F0] py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <BarChart3 size={14} className="mx-auto" />
        </button>
        <div className="relative">
          <button type="button" onClick={onMoreToggle} className="w-full rounded-xl border border-[#E2E8F0] py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <MoreVertical size={14} className="mx-auto" />
          </button>
          
          {moreOpen ? (
            <div className="absolute left-0 right-auto bottom-full mb-1 z-[85] w-56 rounded-xl border border-[#E2E8F0] bg-white p-2 shadow-xl">
              {[
                { key: "details", label: "مشاهده جزئیات" },
                { key: "edit", label: "ویرایش تمرین" },
                { key: "review", label: "بررسی تسلیمی‌ها" },
                { key: "report", label: "مشاهده گزارش" },
                { key: "announce", label: "ارسال اعلان" },
                { key: "copy", label: "کپی تمرین" },
                { key: "delete", label: "حذف تمرین" },
              ].map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => onAction(action.key, item)}
                  className="w-full rounded-lg px-3 py-2 text-right text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
