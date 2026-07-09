import { Search, ChevronDown } from "lucide-react";

export default function ResourceFilterBar({
  language = "fa",
  searchQuery,
  setSearchQuery,
  courseFilter,
  setCourseFilter,
  typeFilter,
  setTypeFilter,
  sortFilter,
  setSortFilter,
  courseOptions,
  typeOptions,
  sortOptions,
}) {
  const isFa = language === "fa";
  const searchPlaceholder = isFa
    ? "جستجو در منابع ..."
    : "Search resources...";
  const normalizedOptions = [courseOptions, typeOptions, sortOptions].map((options) =>
    options.map((opt) =>
      typeof opt === "string" ? { value: opt, label: opt } : opt,
    ),
  );

  return (
    <div className="mb-6 grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto_auto_auto]">
      {/* Search */}
      <div className="relative flex items-center">
        <Search size={18} className="absolute start-4 text-slate-400" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl bg-slate-50 py-3 pe-4 ps-11 text-sm font-semibold outline-none transition focus:bg-white focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Dropdowns */}
      {[
        {
          value: courseFilter,
          setter: setCourseFilter,
          options: normalizedOptions[0],
        },
        { value: typeFilter, setter: setTypeFilter, options: normalizedOptions[1] },
        { value: sortFilter, setter: setSortFilter, options: normalizedOptions[2] },
      ].map((dropdown, idx) => (
        <div className="relative" key={idx}>
          <select
            value={dropdown.value}
            onChange={(e) => dropdown.setter(e.target.value)}
            className="w-full appearance-none rounded-xl bg-slate-50 py-3 pe-10 ps-4 text-sm font-bold text-slate-700 outline-none transition focus:bg-white focus:ring-2 focus:ring-primary-500 md:w-40 cursor-pointer"
          >
            {dropdown.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute end-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        </div>
      ))}
    </div>
  );
}
