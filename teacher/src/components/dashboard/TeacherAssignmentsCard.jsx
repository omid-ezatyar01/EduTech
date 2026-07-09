import { ClipboardCheck } from "lucide-react";

export default function TeacherAssignmentsCard({ items = [], language }) {
  return (
    <section className="flex h-[360px] w-full flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black text-[#0F172A]">
        {language === "fa" ? "تمرین‌های نیازمند بررسی" : "Assignments To Review"}
      </h3>

      {items.length ? (
        <ul className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pe-1">
          {items.map((item, idx) => (
            <li
              key={item}
              className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5"
            >
              <span className="rounded-lg bg-[#F59E0B]/10 p-2 text-[#F59E0B]">
                <ClipboardCheck size={15} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#0F172A]">{item}</p>
                <p className="text-xs font-semibold text-slate-500">
                  {language === "fa" ? `اولویت ${idx + 1}` : `Priority ${idx + 1}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3 text-sm font-medium text-slate-500">
          {language === "fa" ? "تمرین در انتظار بررسی وجود ندارد." : "No assignments are waiting for review."}
        </p>
      )}
    </section>
  );
}
