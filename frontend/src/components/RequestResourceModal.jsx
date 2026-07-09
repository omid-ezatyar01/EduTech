import { X, Send } from "lucide-react";

export default function RequestResourceModal({
  isOpen,
  onClose,
  courses,
  onSubmit,
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "درخواست منبع جدید" : "Request New Resource",
    relatedCourse: isFa ? "کورس مربوطه" : "Related Course",
    selectCourse: isFa ? "انتخاب کورس" : "Select course",
    resourceTitle: isFa ? "عنوان منبع" : "Resource Title",
    resourceTitlePlaceholder: isFa
      ? "نام منبع مورد نیاز را بنویسید"
      : "Write the name of the resource you need",
    description: isFa ? "توضیحات" : "Description",
    descriptionPlaceholder: isFa
      ? "توضیح دهید چه منبعی نیاز دارید..."
      : "Describe which resource you need...",
    submit: isFa ? "ارسال درخواست" : "Submit Request",
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute left-6 top-6 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-black text-slate-950 mb-6">{t.title}</h2>

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
            onClose();
          }}
        >
          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 block">
              {t.relatedCourse}
            </label>
            <select className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500">
              <option value="" disabled hidden>
                {t.selectCourse}
              </option>
              {courses
                .filter((c) => c.value !== "__all_courses__")
                .map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 block">
              {t.resourceTitle}
            </label>
            <input
              type="text"
              placeholder={t.resourceTitlePlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 block">
              {t.description}
            </label>
            <textarea
              rows="4"
              placeholder={t.descriptionPlaceholder}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            ></textarea>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-4 text-sm font-black text-white shadow-glow transition hover:bg-teal-700 hover:-translate-y-0.5"
            >
              <Send size={18} className="pe-0.5" /> {t.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
