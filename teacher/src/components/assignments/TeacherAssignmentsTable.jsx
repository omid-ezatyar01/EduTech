import { useState } from "react";
import TeacherAssignmentCard from "./TeacherAssignmentCard";
import TeacherAssignmentRow from "./TeacherAssignmentRow";

export default function TeacherAssignmentsTable({ items, view, onView, onReports, onAction }) {
  const [openMenuId, setOpenMenuId] = useState(null);

  const handleMoreToggle = (id) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const handleAction = (key, item) => {
    setOpenMenuId(null);
    onAction(key, item);
  };

  if (view === "grid") {
    return (
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <TeacherAssignmentCard 
            key={item.id} 
            item={item} 
            onView={onView} 
            onReports={onReports} 
            moreOpen={openMenuId === item.id}
            onMoreToggle={() => handleMoreToggle(item.id)}
            onAction={handleAction}
          />
        ))}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[1120px] w-full text-right">
          <thead className="bg-slate-50/80 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-bold">تمرین / پروژه</th>
              <th className="px-4 py-3 font-bold">کورس</th>
              <th className="px-4 py-3 font-bold">نوع</th>
              <th className="px-4 py-3 font-bold">مهلت تحویل</th>
              <th className="px-4 py-3 font-bold">تسلیمی</th>
              <th className="px-4 py-3 font-bold">بررسی شده</th>
              <th className="px-4 py-3 font-bold">وضعیت</th>
              <th className="px-4 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <TeacherAssignmentRow 
                key={item.id} 
                item={item} 
                onView={onView} 
                onReports={onReports} 
                moreOpen={openMenuId === item.id}
                onMoreToggle={() => handleMoreToggle(item.id)}
                onAction={handleAction}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {items.map((item) => (
          <TeacherAssignmentCard 
            key={item.id} 
            item={item} 
            onView={onView} 
            onReports={onReports} 
            moreOpen={openMenuId === item.id}
            onMoreToggle={() => handleMoreToggle(item.id)}
            onAction={handleAction}
          />
        ))}
      </div>

      <footer className="border-t border-[#E2E8F0] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-slate-600">نمایش 1 تا 4 از 4 تمرین</p>
          <div className="flex items-center gap-1 text-xs sm:text-sm">
            <button type="button" className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-slate-600">قبلی</button>
            <button type="button" className="rounded-lg bg-[#0B4FD8] px-3 py-1.5 font-bold text-white">1</button>
            <button type="button" className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-slate-600">بعدی</button>
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-slate-600 sm:text-sm">
            <span>آیتم در صفحه:</span>
            <select className="rounded-lg border border-[#E2E8F0] px-2 py-1">
              <option>10</option>
            </select>
          </div>
        </div>
      </footer>
    </section>
  );
}
