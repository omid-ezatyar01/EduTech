import {
  X,
  Download,
  FileText,
  PlaySquare,
  Headphones,
  Image as ImageIcon,
  Link2,
} from "lucide-react";

export default function ResourcePreviewModal({
  isOpen,
  onClose,
  resource,
  onDownload,
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "پیش‌نمایش منبع" : "Resource Preview",
    previewUnavailable: isFa
      ? "پیش‌نمایش برای فایل‌های %s فعال نیست"
      : "Preview is not available for %s files",
    downloadHint: isFa
      ? "لطفاً برای مشاهده کامل، فایل را دانلود کنید."
      : "Please download the file to view the full content.",
    close: isFa ? "بستن" : "Close",
    download: isFa ? "دانلود فایل" : "Download File",
  };

  if (!isOpen || !resource) return null;

  const isVideo = resource.type === "MP4" || resource.type === "Video";
  const isAudio = resource.type === "MP3";
  const isImage = resource.type === "PNG";
  const isLink = resource.type === "Link";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl relative animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-xl font-black text-slate-950">{t.title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition bg-slate-50 hover:bg-slate-100 p-2 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-primary-700">
                {resource.title}
              </h3>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {resource.course}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
              {resource.type} • {resource.size}
            </span>
          </div>

          {/* Preview Box Placeholder */}
          <div className="flex h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400">
            {isVideo ? (
              <PlaySquare size={48} className="mb-4 text-blue-300" />
            ) : isAudio ? (
              <Headphones size={48} className="mb-4 text-teal-300" />
            ) : isImage ? (
              <ImageIcon size={48} className="mb-4 text-purple-300" />
            ) : isLink ? (
              <Link2 size={48} className="mb-4 text-emerald-300" />
            ) : (
              <FileText size={48} className="mb-4 text-red-300" />
            )}
            <p className="text-sm font-bold">
              {t.previewUnavailable.replace("%s", resource.type)}
            </p>
            <p className="mt-1 text-xs font-semibold">
              {t.downloadHint}
            </p>
          </div>

          <p className="mt-6 text-sm font-medium leading-7 text-slate-600">
            {resource.description}
          </p>
        </div>

        <div className="flex gap-3 border-t border-slate-100 p-6 bg-slate-50/50">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-white border border-slate-200 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            {t.close}
          </button>
          <button
            onClick={() => {
              onDownload(resource);
              onClose();
            }}
            className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-primary-600 py-3.5 text-sm font-black text-white shadow-glow transition hover:bg-primary-700"
          >
            <Download size={18} /> {t.download}
          </button>
        </div>
      </div>
    </div>
  );
}
