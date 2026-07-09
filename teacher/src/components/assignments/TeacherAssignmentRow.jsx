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

export default function TeacherAssignmentRow({ item, onView, onReports, moreOpen, onMoreToggle, onAction }) {
  return (
    <tr className="border-b border-[#E2E8F0] text-sm hover:bg-slate-50/70">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg ${thumbStyles[item.thumbnailType] || thumbStyles.api}`} />
          <div>
            <p className="font-bold text-slate-900">{item.title}</p>
            <p className="text-xs text-slate-500">{item.description}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-700">{item.course}</td>
      <td className="px-4 py-3 text-slate-700">{item.type}</td>
      <td className="px-4 py-3">
        <p className="text-slate-700">{item.deadline}</p>
        <p className="text-xs text-slate-500">{item.deadlineNote}</p>
      </td>
      <td className="px-4 py-3 text-slate-700">{item.submitted}</td>
      <td className="px-4 py-3 text-slate-700">{item.reviewed}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[item.status] || statusStyles.draft}`}>
          {item.statusLabel}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onView(item)} className="rounded-lg p-2 text-slate-500 hover:bg-[#0B4FD8]/10 hover:text-[#0B4FD8]">
            <Eye size={15} />
          </button>
          <button type="button" onClick={() => onReports(item)} className="rounded-lg p-2 text-slate-500 hover:bg-[#0B4FD8]/10 hover:text-[#0B4FD8]">
            <BarChart3 size={15} />
          </button>
          <div className="relative">
            <button type="button" onClick={onMoreToggle} className="rounded-lg p-2 text-slate-500 hover:bg-[#0B4FD8]/10 hover:text-[#0B4FD8]">
              <MoreVertical size={15} />
            </button>
            
            {moreOpen ? (
              <div className="absolute left-0 right-auto top-full mt-1 z-[85] w-56 rounded-xl border border-[#E2E8F0] bg-white p-2 shadow-xl">
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
      </td>
    </tr>
  );
}
