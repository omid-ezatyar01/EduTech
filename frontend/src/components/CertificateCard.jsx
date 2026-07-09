import { useEffect, useState } from "react";
import { Eye, Download, Loader2 } from "lucide-react";
import CertificatePreview from "./CertificatePreview.jsx";

const getInitials = (value = "") => {
  const words = String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "NA";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
};

export default function CertificateCard({
  certificate,
  onView,
  onDownload,
  language = "fa",
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const isCompleted = certificate.status === "completed";
  const isFa = language === "fa";
  const teacherName = String(certificate.teacher || "").trim() || (isFa ? "استاد" : "Teacher");
  const teacherInitials = getInitials(teacherName);
  const hasTeacherAvatar = Boolean(String(certificate.teacherAvatar || "").trim()) && !avatarFailed;
  const t = {
    preview: isFa ? "پیش‌نمایش" : "Preview",
    teacher: isFa ? "استاد" : "Teacher",
    issueDate: isFa ? "تاریخ دریافت" : "Issue Date",
    progress: isFa ? "پیشرفت کورس" : "Course Progress",
    download: isFa ? "دانلود" : "Download",
  };

  useEffect(() => {
    setAvatarFailed(false);
  }, [certificate?.id, certificate?.teacherAvatar]);

  const handleDownloadClick = async () => {
    setIsDownloading(true);
    await onDownload(certificate);
    setIsDownloading(false);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary-100 hover:shadow-md">
      {/* Preview */}
      <div className="relative w-full rounded-xl overflow-hidden mb-5">
        <CertificatePreview certificate={certificate} />
        <span
          className={`absolute right-3 top-3 inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-black shadow-sm ${
            isCompleted ? "bg-green-500 text-white" : "bg-amber-500 text-white"
          }`}
        >
          {certificate.statusLabel}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1">
        <h3 className="text-lg font-black text-slate-950">
          {certificate.course}
        </h3>
        <div className="mt-4 flex items-center gap-2">
          {hasTeacherAvatar ? (
            <img
              src={certificate.teacherAvatar}
              alt={teacherName}
              className="h-6 w-6 rounded-full border border-slate-200 object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div className="grid h-6 w-6 place-items-center rounded-full border border-slate-200 bg-slate-100 text-[9px] font-black text-slate-700">
              {teacherInitials}
            </div>
          )}
          <p className="text-xs font-bold text-slate-600">
            {t.teacher}: <span className="text-slate-900">{teacherName}</span>
          </p>
        </div>

        {isCompleted ? (
          <p className="mt-3 text-xs font-bold text-slate-500">
            {t.issueDate}:{" "}
            <span className="text-slate-900">{certificate.issueDate}</span>
          </p>
        ) : (
          <div className="mt-4 w-full">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold">
              <span className="text-slate-500">{t.progress}</span>
              <span className="text-primary-600">{certificate.progress}٪</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-purple-500"
                style={{ width: `${certificate.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-5">
        {/* Preview button is now always visible */}
        <button
          onClick={() => onView(certificate)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-100 hover:text-primary-600"
        >
          <Eye size={16} /> {t.preview}
        </button>

        {isCompleted ? (
          <button
            onClick={handleDownloadClick}
            disabled={isDownloading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-500 py-2.5 text-xs font-black text-white shadow-glow transition hover:bg-teal-600 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}{" "}
            {t.download}
          </button>
        ) : null}
      </div>
    </div>
  );
}
