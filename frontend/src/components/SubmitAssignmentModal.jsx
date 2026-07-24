import { X, UploadCloud } from "lucide-react";
import { useState } from "react";
import { compressImageFileToLimit } from "../utils/imageCrop";

const MAX_FILE_BYTES = 1 * 1024 * 1024;
const MAX_RAW_IMAGE_BYTES = 10 * 1024 * 1024;
const ASSIGNMENT_IMAGE_BYTES = 700 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
  "audio/mpeg",
  "audio/wav",
  "video/mp4",
  "video/webm",
]);

export default function SubmitAssignmentModal({
  isOpen,
  onClose,
  assignment,
  onSubmit,
  language = "fa",
}) {
  const [textAnswer, setTextAnswer] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isFa = language === "fa";
  if (!isOpen || !assignment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-[32px] bg-white shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto [direction:ltr]">
        <div className={`p-6 ${isFa ? "text-right" : "text-left"}`} dir={isFa ? "rtl" : "ltr"}>
        <button
          onClick={onClose}
          className="absolute left-6 top-6 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-black text-slate-950 mb-2">
          {isFa ? "ارسال پاسخ تمرین" : "Submit Assignment Response"}
        </h2>
        <p className="text-sm font-bold text-primary-600 mb-6">
          {assignment.title}
        </p>

        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setSubmitting(true);
              const success = await onSubmit(assignment.id, {
                textAnswer: [textAnswer, notes].filter(Boolean).join("\n\n").trim(),
                attachmentUrl: attachmentUrl.trim(),
                submissionFile: selectedFile,
              });
              if (!success) return;
              setTextAnswer("");
              setAttachmentUrl("");
              setNotes("");
              setSelectedFile(null);
              setFileError("");
              onClose();
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 block">
              {isFa ? "متن پاسخ" : "Response Text"}
            </label>
            <textarea
              rows="4"
              value={textAnswer}
              onChange={(event) => setTextAnswer(event.target.value)}
              placeholder={
                isFa
                  ? "پاسخ خود را اینجا بنویسید..."
                  : "Write your response here..."
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-100 resize-none"
            ></textarea>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 block">
              {isFa ? "آپلود فایل" : "Upload File"}
            </label>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-6 transition hover:bg-slate-100 hover:border-primary-400">
              <UploadCloud size={32} className="text-slate-400 mb-2" />
              <span className="text-sm font-bold text-slate-700">
                {isFa ? "برای آپلود فایل کلیک کنید" : "Click to upload a file"}
              </span>
              <span className="mt-1 text-xs font-semibold text-slate-400">
                PDF, DOC, DOCX, TXT, MP3, MP4, WEBM, JPG, PNG, WEBP (Max 1MB)
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.mp3,.wav,.mp4,.webm,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,audio/mpeg,audio/wav,video/mp4,video/webm,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0] || null;
                  event.target.value = "";
                  if (!file) {
                    setSelectedFile(null);
                    setFileError("");
                    return;
                  }
                  if (!ALLOWED_FILE_TYPES.has(String(file.type || "").toLowerCase())) {
                    setSelectedFile(null);
                    setFileError(isFa ? "نوع این فایل پشتیبانی نمی‌شود." : "This file type is not supported.");
                    return;
                  }
                  const isImage = String(file.type || "").startsWith("image/");
                  if (Number(file.size || 0) > (isImage ? MAX_RAW_IMAGE_BYTES : MAX_FILE_BYTES)) {
                    setSelectedFile(null);
                    setFileError(
                      isImage
                        ? isFa ? "حجم تصویر اصلی باید کمتر از ۱۰ مگابایت باشد." : "The source image must be under 10 MB."
                        : isFa ? "حداکثر حجم فایل ۱ مگابایت است." : "Maximum file size is 1 MB.",
                    );
                    return;
                  }
                  if (!isImage) {
                    setSelectedFile(file);
                    setFileError("");
                    return;
                  }
                  try {
                    setFileError(isFa ? "در حال فشرده‌سازی تصویر…" : "Compressing image…");
                    const optimizedFile = await compressImageFileToLimit({
                      file,
                      maxBytes: ASSIGNMENT_IMAGE_BYTES,
                      maxWidth: 1600,
                      maxHeight: 1600,
                      initialQuality: 0.82,
                      baseName: "assignment-image",
                    });
                    setSelectedFile(optimizedFile);
                    setFileError("");
                  } catch {
                    setSelectedFile(null);
                    setFileError(isFa ? "فشرده‌سازی تصویر انجام نشد." : "The image could not be compressed.");
                  }
                }}
              />
            </label>
            {selectedFile ? (
              <p className="mt-2 text-xs font-semibold text-emerald-700">
                {isFa ? "فایل انتخاب شد:" : "Selected file:"} {selectedFile.name} · {(selectedFile.size / 1024).toFixed(0)} KB
              </p>
            ) : null}
            {fileError ? (
              <p className="mt-2 text-xs font-semibold text-rose-700">{fileError}</p>
            ) : null}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 block">
              {isFa ? "توضیحات اضافی (اختیاری)" : "Additional Notes (Optional)"}
            </label>
            <input
              type="url"
              value={attachmentUrl}
              onChange={(event) => setAttachmentUrl(event.target.value)}
              placeholder={
                isFa
                  ? "لینک فایل/مخزن/ویدیو را وارد کنید (اختیاری)"
                  : "Paste file/repository/video URL (optional)"
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 block">
              {isFa ? "یادداشت اضافی (اختیاری)" : "Additional Notes (Optional)"}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                isFa
                  ? "اگر توضیحی دارید بنویسید..."
                  : "Add any extra notes..."
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-slate-100 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
            >
              {isFa ? "لغو" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={submitting || Boolean(fileError)}
              className="flex-1 rounded-xl bg-primary-600 py-3.5 text-sm font-black text-white shadow-glow transition hover:bg-primary-700 hover:-translate-y-0.5"
            >
              {submitting ? (isFa ? "در حال ارسال" : "Submitting") : isFa ? "ارسال تمرین" : "Submit Assignment"}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
