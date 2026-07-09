import { Search, ChevronDown } from "lucide-react";

export default function PaymentFilterBar({
  language = "fa",
  tabs,
  activeTab,
  onTabChange,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  statusOptions,
  dateFilter,
  setDateFilter,
  dateOptions,
}) {
  const isFa = language === "fa";
  const searchPlaceholder = isFa ? "جستجو در پرداخت‌ها ..." : "Search payments...";
  const normalizedOptions = [statusOptions, dateOptions].map((options) =>
    options.map((opt) => (typeof opt === "string" ? { value: opt, label: opt } : opt)),
  );

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      {/* Tabs Row */}
      <div className="flex overflow-x-auto border-b border-slate-100 scrollbar-hide pb-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-black transition-colors ${isActive ? "border-b-2 border-primary-600 text-primary-700" : "text-slate-600 hover:text-primary-700"}`}
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

      {/* Filters Row */}
      <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
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

        {[
          {
            value: statusFilter,
            setter: setStatusFilter,
            options: normalizedOptions[0],
          },
          { value: dateFilter, setter: setDateFilter, options: normalizedOptions[1] },
        ].map((dropdown, idx) => (
          <div className="relative" key={idx}>
            <select
              value={dropdown.value}
              onChange={(e) => dropdown.setter(e.target.value)}
              className="w-full appearance-none rounded-xl bg-slate-50 py-3 pe-10 ps-4 text-sm font-bold text-slate-700 outline-none transition focus:bg-white focus:ring-2 focus:ring-primary-500 md:w-48 cursor-pointer"
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
    </div>
  );
}
