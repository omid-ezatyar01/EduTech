import TeacherClassRow from "./TeacherClassRow";

export default function TeacherClassesTable({ classes, onJoin, onManage, onDetails }) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3 sm:px-5">
        <h3 className="text-base font-extrabold text-[#0F172A]">لیست صنف‌ها</h3>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[920px] w-full text-right">
          <thead className="bg-slate-50/80 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-bold">کورس</th>
              <th className="px-4 py-3 font-bold">موضوع</th>
              <th className="px-4 py-3 font-bold">تاریخ</th>
              <th className="px-4 py-3 font-bold">زمان</th>
              <th className="px-4 py-3 font-bold">شاگردان</th>
              <th className="px-4 py-3 font-bold">وضعیت</th>
              <th className="px-4 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((item) => (
              <TeacherClassRow key={item.id} item={item} onJoin={onJoin} onManage={onManage} onDetails={onDetails} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {classes.map((item) => (
          <TeacherClassRow key={item.id} item={item} mobile onJoin={onJoin} onManage={onManage} onDetails={onDetails} />
        ))}
      </div>

      <div className="border-t border-[#E2E8F0] px-4 py-3 sm:px-5">
        <button type="button" className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-semibold text-[#0B4FD8] hover:border-[#0B4FD8]">
          مشاهده همه صنف‌ها
        </button>
      </div>
    </section>
  );
}
