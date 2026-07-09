export default function CourseFilterTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden mb-6">
      <div className="flex overflow-x-auto px-2 scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap px-5 py-4 text-sm font-black transition-colors ${
                isActive
                  ? "border-b-2 border-primary-600 text-primary-700"
                  : "text-slate-600 hover:text-primary-700"
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[10px] ${
                  isActive
                    ? "bg-primary-100 text-primary-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
