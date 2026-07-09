import { useState } from "react";
import { X, Download, Share2, Loader2 } from "lucide-react";
import CertificatePreview from "./CertificatePreview.jsx";

export default function CertificateViewModal({
  isOpen,
  onClose,
  certificate,
  onDownload,
  language = "fa",
}) {
  const isFa = language === "fa";
  const isCompleted = certificate?.status === "completed";
  const t = {
    title: isFa ? "مشاهده سرتیفیکیت" : "View Certificate",
    course: isFa ? "کورس" : "Course",
    student: isFa ? "محصل" : "Student",
    issueDate: isFa ? "تاریخ صدور" : "Issue Date",
    verifyCode: isFa ? "کد تایید" : "Verification Code",
    close: isFa ? "بستن" : "Close",
    share: isFa ? "اشتراک‌گذاری" : "Share",
    downloadPdf: isFa ? "دانلود PDF" : "Download PDF",
    shareLocked: isFa
      ? "اشتراک‌گذاری فقط بعد از پایان رسمی کورس فعال می‌شود."
      : "Sharing is available only after the course is officially finished.",
    downloadLocked: isFa
      ? "دانلود فقط بعد از پایان رسمی کورس فعال می‌شود."
      : "Download is available only after the course is officially finished.",
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadClick = async () => {
    if (!isCompleted) return;
    setIsDownloading(true);
    await onDownload(certificate);
    setIsDownloading(false);
    onClose();
  };

  if (!isOpen || !certificate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl duration-200 animate-in zoom-in-95">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-xl font-black text-slate-950">{t.title}</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-50 p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 items-center justify-center overflow-hidden bg-slate-50/50 p-4 md:p-6">
          <div
            className="w-full"
            style={{
              maxWidth: "min(100%, max(250px, calc((95vh - 300px) * 1.414)))",
            }}
          >
            <CertificatePreview certificate={certificate} />
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-4 border-t border-slate-100 bg-white px-6 py-5 sm:grid-cols-4">
          <div>
            <p className="text-[10px] font-bold text-slate-500">{t.course}</p>
            <p className="mt-1 text-xs font-black text-slate-900">
              {certificate.course}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500">{t.student}</p>
            <p className="mt-1 text-xs font-black text-slate-900">
              {certificate.student}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500">{t.issueDate}</p>
            <p className="mt-1 text-xs font-black text-slate-900">
              {certificate.issueDate}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500">{t.verifyCode}</p>
            <p className="mt-1 text-xs font-black text-slate-900" dir="ltr">
              {certificate.certificateId}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col sm:flex-row gap-3 border-t border-slate-100 p-4 sm:p-6">
          <button
            onClick={onClose}
            className="order-last sm:order-first flex-1 rounded-xl bg-slate-100 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
          >
            {t.close}
          </button>
          <div className="flex flex-[2] flex-col sm:flex-row gap-3">
            <button
              disabled={!isCompleted}
              title={!isCompleted ? t.shareLocked : t.share}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-70 ${
                isCompleted
                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  : "border-slate-200 bg-slate-100 text-slate-400"
              }`}
            >
              <Share2 size={18} /> {t.share}
            </button>
            <button
              onClick={handleDownloadClick}
              disabled={isDownloading || !isCompleted}
              title={!isCompleted ? t.downloadLocked : t.downloadPdf}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black shadow-glow transition disabled:opacity-70 disabled:cursor-not-allowed ${
                isCompleted
                  ? "bg-primary-600 text-white hover:bg-primary-700"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {isDownloading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Download size={18} />
              )}{" "}
              {t.downloadPdf}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
