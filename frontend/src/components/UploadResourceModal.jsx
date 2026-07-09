import { X, UploadCloud, Info } from "lucide-react";

export default function UploadResourceModal({
  isOpen,
  onClose,
  courses,
  onSubmit,
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "آپلود منبع جدید" : "Upload New Resource",
    course: isFa ? "کورس" : "Course",
    resourceType: isFa ? "نوع منبع" : "Resource Type",
    resourceTitle: isFa ? "عنوان منبع" : "Resource Title",
    resourceTitlePlaceholder: isFa ? "عنوان فایل را وارد کنید" : "Enter file title",
    uploadDropzone: isFa
      ? "برای آپلود فایل کلیک کنید یا فایل را اینجا بکشید"
      : "Click to upload or drag and drop your file here",
    uploadNote: isFa
      ? "آپلود منابع توسط شاگرد ممکن است نیاز به تایید استاد داشته باشد."
      : "Student uploads may require teacher approval.",
    submit: isFa ? "آپلود فایل" : "Upload File",
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
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
            onClose();
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-2 block">
                {t.course}
              </label>
              <select className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500">
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
                {t.resourceType}
              </label>
              <select className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500">
                {["PDF", "MP4", "MP3", "PNG", "DOCX"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 block">
              {t.resourceTitle}
            </label>
            <input
              type="text"
              placeholder={t.resourceTitlePlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500"
            />
          </div>

          <div>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-8 transition hover:border-primary-400 hover:bg-slate-100">
              <UploadCloud size={32} className="text-slate-400 mb-3" />
              <span className="text-sm font-bold text-slate-700">
                {t.uploadDropzone}
              </span>
              <input type="file" className="hidden" />
            </label>
          </div>
          <p className="flex items-center gap-2 text-[11px] font-bold text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-100">
            <Info size={14} /> {t.uploadNote}
          </p>
          <button
            type="submit"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-4 text-sm font-black text-white shadow-glow transition hover:bg-primary-700 hover:-translate-y-0.5"
          >
            <UploadCloud size={18} /> {t.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
