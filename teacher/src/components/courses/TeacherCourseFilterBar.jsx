import { formatCategoryPathLabel } from "../../utils/categoryTree";

export default function TeacherCourseFilterBar({
  search,
  setSearch,
  category,
  setCategory,
  status,
  setStatus,
  language,
  isRTL,
  categories = [],
}) {
  const statuses = [
    { value: "all", labelFa: "همه وضعیت‌ها", labelEn: "All statuses" },
    { value: "class_started", labelFa: "صنف شروع شد", labelEn: "Class started" },
    { value: "class_ended", labelFa: "صنف پایان یافت", labelEn: "Class ended" },
    { value: "cancellation_pending", labelFa: "درخواست لغو در انتظار", labelEn: "Cancellation pending" },
    { value: "cancelled", labelFa: "لغو شده", labelEn: "Cancelled" },
    { value: "published", labelFa: "منتشر شده", labelEn: "Published" },
    { value: "approved", labelFa: "تایید شده", labelEn: "Approved" },
    { value: "pending", labelFa: "در انتظار", labelEn: "Pending" },
    { value: "draft", labelFa: "پیش‌نویس", labelEn: "Draft" },
    { value: "rejected", labelFa: "رد شده", labelEn: "Rejected" },
  ];
  const categoryOptions = Array.from(
    new Map(
      (Array.isArray(categories) ? categories : [])
        .map((item) => [String(item?._id || "").trim(), item])
        .filter(([id]) => Boolean(id)),
    ).values(),
  ).sort((left, right) =>
    formatCategoryPathLabel(left).localeCompare(formatCategoryPathLabel(right), language === "fa" ? "fa" : "en"),
  );
  const hasActiveFilters = search.trim() || category !== "all" || status !== "all";

  return (
    <section className="mt-5 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={language === "fa" ? "جستجو در کورس‌ها" : "Search courses"}
          className={`h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0B4FD8] focus:bg-white focus:ring-4 focus:ring-[#0B4FD8]/10 ${isRTL ? "text-right" : "text-left"}`}
        />

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={`h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0B4FD8] focus:bg-white focus:ring-4 focus:ring-[#0B4FD8]/10 ${isRTL ? "text-right" : "text-left"}`}
        >
          <option value="all">{language === "fa" ? "همه دسته‌بندی‌ها" : "All Categories"}</option>
          {categoryOptions.map((item) => (
            <option key={item._id} value={item._id}>
              {formatCategoryPathLabel(item)}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={`h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0B4FD8] focus:bg-white focus:ring-4 focus:ring-[#0B4FD8]/10 ${isRTL ? "text-right" : "text-left"}`}
        >
          {statuses.map((item) => (
            <option key={item.value} value={item.value}>
              {language === "fa" ? item.labelFa : item.labelEn}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            setSearch("");
            setCategory("all");
            setStatus("all");
          }}
          disabled={!hasActiveFilters}
          className="h-11 rounded-xl border border-[#E2E8F0] bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {language === "fa" ? "پاک‌کردن فیلتر" : "Clear filters"}
        </button>
      </div>
    </section>
  );
}
