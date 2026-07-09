import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

export default function AssignmentFilterTabs({
  tabs,
  activeTab,
  onChange,
  courses = [],
  selectedCourse = "__all_courses__",
  onCourseChange,
  embedded = false,
  language = "fa",
  allCoursesValue = "__all_courses__",
}) {
  const isFa = language === "fa";
  const t = {
    filter: isFa ? "فیلتر" : "Filter",
    byCourse: isFa ? "فیلتر بر اساس کورس" : "Filter by course",
    byStatus: isFa ? "فیلتر بر اساس وضعیت" : "Filter by status",
    all: isFa ? "همه" : "All",
    allCourses: isFa ? "همه کورس‌ها" : "All Courses",
  };
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [openSection, setOpenSection] = useState("");

  const toggleSection = (key) => {
    setOpenSection((prev) => (prev === key ? "" : key));
  };

  return (
    <div
      className={`overflow-hidden ${
        embedded
          ? "rounded-2xl border border-slate-100 bg-slate-50"
          : "rounded-[24px] border border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2 px-2">
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex min-w-max">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onChange(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap px-4 py-4 text-sm font-black transition-colors ${
                    isActive
                      ? "border-b-2 border-primary-600 text-primary-700"
                      : "text-slate-600 hover:text-primary-700"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[10px] ${isActive ? "bg-primary-100 text-primary-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            setIsFilterOpen((prev) => {
              const next = !prev;
              if (!next) setOpenSection("");
              return next;
            })
          }
          className="ms-auto inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
        >
          <SlidersHorizontal size={16} /> {t.filter}
        </button>
      </div>
      {isFilterOpen ? (
        <div className="px-3 pb-3">
          <div className="mt-2 rounded-xl bg-slate-50 p-2.5 sm:p-3">
            <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-white p-2">
                <button
                  type="button"
                  onClick={() => toggleSection("course")}
                  className="flex w-full items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-right"
                >
                  <span className="text-[11px] font-black text-slate-700 sm:text-xs">
                    {t.byCourse}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 sm:text-xs">
                    {selectedCourse === allCoursesValue ? t.allCourses : selectedCourse}
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${
                        openSection === "course" ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </button>
                {openSection === "course" ? (
                  <div className="mt-2 max-h-36 space-y-1 overflow-y-auto pe-1">
                    <button
                      type="button"
                      onClick={() => onCourseChange?.(allCoursesValue)}
                      className={`w-full rounded-md px-3 py-2 text-right text-xs font-bold transition sm:text-sm ${
                        selectedCourse === allCoursesValue
                          ? "bg-primary-100 text-primary-700"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {t.allCourses}
                    </button>
                    {courses.map((course) => {
                      const isActiveCourse = selectedCourse === course;
                      return (
                        <button
                          key={course}
                          type="button"
                          onClick={() => onCourseChange?.(course)}
                          className={`w-full rounded-md px-3 py-2 text-right text-xs font-bold transition sm:text-sm ${
                            isActiveCourse
                              ? "bg-primary-100 text-primary-700"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {course}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg bg-white p-2">
                <button
                  type="button"
                  onClick={() => toggleSection("status")}
                  className="flex w-full items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-right"
                >
                  <span className="text-[11px] font-black text-slate-700 sm:text-xs">
                    {t.byStatus}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 sm:text-xs">
                    {tabs.find((tab) => tab.id === activeTab)?.label || t.all}
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${
                        openSection === "status" ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </button>
                {openSection === "status" ? (
                  <div className="mt-2 max-h-36 space-y-1 overflow-y-auto pe-1">
                    {tabs.map((tab) => {
                      const isActiveStatus = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => onChange(tab.id)}
                          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-bold transition sm:text-sm ${
                            isActiveStatus
                              ? "bg-primary-100 text-primary-700"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span
                            className={`inline-flex min-w-6 items-center justify-center rounded px-1.5 py-0.5 text-[10px] ${
                              isActiveStatus
                                ? "bg-primary-200 text-primary-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
