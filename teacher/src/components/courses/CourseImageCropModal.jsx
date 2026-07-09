import { Check, Image, Loader2, Minus, Move, Plus, Scan, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  cropFittedImageRegionFile,
  fitImageFile,
  loadImageDimensions,
} from "../../utils/imageCrop";

const MIN_CROP_SIZE = 0.05;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 };

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function CourseImageCropModal({
  open,
  file,
  language = "fa",
  onClose,
  onApply,
}) {
  const frameRef = useRef(null);
  const dragStateRef = useRef(null);
  const [mode, setMode] = useState("fit");
  const [previewUrl, setPreviewUrl] = useState("");
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState(FULL_CROP);
  const [zoom, setZoom] = useState(1);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isFa = language === "fa";
  const t = {
    title: isFa ? "تنظیم تصویر کورس" : "Adjust course image",
    subtitle: isFa
      ? "تصویر اصلی را کامل نگه دارید یا هر بخش دلخواه را از چهار طرف برش دهید."
      : "Keep the complete original or crop any area from every side.",
    fit: isFa ? "نمایش کامل تصویر" : "Use full image",
    fitHelp: isFa
      ? "تصویر اصلی بدون هیچ برشی استفاده می‌شود."
      : "The original image is used without any cropping.",
    crop: isFa ? "برش تصویر اصلی" : "Crop original image",
    cropHelp: isFa
      ? "خطوط یا گوشه‌های قاب را بکشید؛ داخل قاب را برای جابه‌جایی بکشید."
      : "Drag any edge or corner; drag inside the box to move it.",
    zoom: isFa ? "زوم بخش انتخاب‌شده" : "Selection zoom",
    cancel: isFa ? "انصراف" : "Cancel",
    apply: isFa ? "استفاده از این تصویر" : "Use this image",
    loading: isFa ? "در حال آماده‌سازی تصویر..." : "Preparing image",
    failed: isFa ? "آماده‌سازی تصویر انجام نشد." : "Unable to prepare the image.",
    exactSize: isFa ? "اندازه دقیق تصویر کورس" : "Exact course image size",
    exactSizeHelp: isFa
      ? "۱۲۰۰ × ۶۷۵ پیکسل (نسبت ۱۶:۹). اگر تصویر را با همین اندازه بسازید، به برش یا تنظیم نیاز ندارد."
      : "1200 × 675 pixels (16:9). Images created at this exact size need no fitting or cropping.",
  };

  useEffect(() => {
    if (!open || !(file instanceof File)) return undefined;
    let active = true;
    const objectUrl = URL.createObjectURL(file);
    const frameId = window.requestAnimationFrame(() => {
      if (!active) return;
      setMode("fit");
      setPreviewUrl(objectUrl);
      setCrop(FULL_CROP);
      setZoom(1);
      setLoadingMeta(true);
      setError("");
    });

    loadImageDimensions(file)
      .then(() => {})
      .catch(() => {
        if (active) setError(t.failed);
      })
      .finally(() => {
        if (active) setLoadingMeta(false);
      });

    return () => {
      active = false;
      window.cancelAnimationFrame(frameId);
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, open, t.failed]);

  useEffect(() => {
    if (!open || !frameRef.current || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const frame = frameRef.current;
    const updateSize = () =>
      setFrameSize({ width: frame.clientWidth || 0, height: frame.clientHeight || 0 });
    const frameId = window.requestAnimationFrame(updateSize);
    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [open]);

  const displayedImage = {
    width: Math.max(1, frameSize.width),
    height: Math.max(1, frameSize.height),
    left: 0,
    top: 0,
  };

  const selectMode = (nextMode) => {
    setMode(nextMode);
    setCrop(FULL_CROP);
    setZoom(1);
  };

  const handleCropPointerDown = (event, action) => {
    if (mode !== "crop" || saving || loadingMeta) return;
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = {
      pointerId: event.pointerId,
      action,
      startX: event.clientX,
      startY: event.clientY,
      crop,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleCropPointerMove = (event) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.startX) / Math.max(1, displayedImage.width);
    const dy = (event.clientY - drag.startY) / Math.max(1, displayedImage.height);
    const original = drag.crop;
    let next = { ...original };

    if (drag.action === "move") {
      next.x = clamp(original.x + dx, 0, 1 - original.width);
      next.y = clamp(original.y + dy, 0, 1 - original.height);
    } else {
      if (drag.action.includes("w")) {
        next.x = clamp(
          original.x + dx,
          0,
          original.x + original.width - MIN_CROP_SIZE,
        );
        next.width = original.x + original.width - next.x;
      }
      if (drag.action.includes("e")) {
        next.width = clamp(
          original.width + dx,
          MIN_CROP_SIZE,
          1 - original.x,
        );
      }
      if (drag.action.includes("n")) {
        next.y = clamp(
          original.y + dy,
          0,
          original.y + original.height - MIN_CROP_SIZE,
        );
        next.height = original.y + original.height - next.y;
      }
      if (drag.action.includes("s")) {
        next.height = clamp(
          original.height + dy,
          MIN_CROP_SIZE,
          1 - original.y,
        );
      }
    }

    setCrop(next);
    setZoom(
      clamp(
        1 / Math.sqrt(Math.max(MIN_CROP_SIZE, next.width * next.height)),
        MIN_ZOOM,
        MAX_ZOOM,
      ),
    );
  };

  const handleCropPointerUp = (event) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleZoomChange = (value) => {
    const nextZoom = clamp(Number(value) || 1, MIN_ZOOM, MAX_ZOOM);
    const requestedScale = zoom / nextZoom;
    const appliedScale = Math.min(
      requestedScale,
      1 / crop.width,
      1 / crop.height,
    );
    const nextWidth = clamp(crop.width * appliedScale, MIN_CROP_SIZE, 1);
    const nextHeight = clamp(crop.height * appliedScale, MIN_CROP_SIZE, 1);
    const centerX = crop.x + crop.width / 2;
    const centerY = crop.y + crop.height / 2;
    const next = {
      x: clamp(centerX - nextWidth / 2, 0, 1 - nextWidth),
      y: clamp(centerY - nextHeight / 2, 0, 1 - nextHeight),
      width: nextWidth,
      height: nextHeight,
    };
    setCrop(next);
    setZoom(nextZoom);
  };

  const handleApply = async () => {
    if (!(file instanceof File) || saving || loadingMeta) return;
    try {
      setSaving(true);
      setError("");
      const preparedFile =
        mode === "crop"
          ? await cropFittedImageRegionFile({
              file,
              crop,
              targetWidth: 1200,
              targetHeight: 675,
            })
          : await fitImageFile({
              file,
              targetWidth: 1200,
              targetHeight: 675,
            });
      onApply?.(preparedFile);
    } catch {
      setError(t.failed);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !(file instanceof File)) return null;

  const cropStyle = {
    left: `${displayedImage.left + crop.x * displayedImage.width}px`,
    top: `${displayedImage.top + crop.y * displayedImage.height}px`,
    width: `${crop.width * displayedImage.width}px`,
    height: `${crop.height * displayedImage.height}px`,
  };
  const handles = [
    { action: "nw", className: "start-1 top-1 cursor-nwse-resize" },
    { action: "n", className: "start-1/2 top-1 -translate-x-1/2 cursor-ns-resize" },
    { action: "ne", className: "end-1 top-1 cursor-nesw-resize" },
    { action: "e", className: "end-1 top-1/2 -translate-y-1/2 cursor-ew-resize" },
    { action: "se", className: "bottom-1 end-1 cursor-nwse-resize" },
    { action: "s", className: "bottom-1 start-1/2 -translate-x-1/2 cursor-ns-resize" },
    { action: "sw", className: "bottom-1 start-1 cursor-nesw-resize" },
    { action: "w", className: "start-1 top-1/2 -translate-y-1/2 cursor-ew-resize" },
  ];

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-[#0F172A]/70 p-0 sm:items-center sm:p-4">
      <div
        className="max-h-[100dvh] w-full max-w-4xl overflow-y-auto rounded-t-[28px] bg-white shadow-2xl sm:max-h-[95vh] sm:rounded-[32px]"
        dir={isFa ? "rtl" : "ltr"}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
          <div>
            <h3 className="text-lg font-black text-slate-950">{t.title}</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "fit", icon: Image, label: t.fit, help: t.fitHelp },
              { value: "crop", icon: Scan, label: t.crop, help: t.cropHelp },
            ].map((option) => {
              const Icon = option.icon;
              const selected = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectMode(option.value)}
                  className={`rounded-2xl border p-3 text-start transition sm:p-4 ${
                    selected
                      ? "border-[#0B4FD8] bg-blue-50 text-[#0B4FD8]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-black">
                    <Icon size={18} />
                    {option.label}
                  </span>
                  <span className="mt-1 hidden text-xs font-semibold leading-5 text-slate-500 sm:block">
                    {option.help}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="text-sm font-black text-blue-950">{t.exactSize}</span>
            <span className="text-xs font-bold leading-5 text-blue-800" dir={isFa ? "rtl" : "ltr"}>
              {t.exactSizeHelp}
            </span>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,#f8fafc,#e2e8f0)] p-3 sm:p-5">
            <div
              ref={frameRef}
              className="relative mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-[24px] bg-slate-50 shadow-[0_20px_50px_rgba(15,23,42,0.18)]"
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Course image preview"
                  className="h-full w-full select-none object-contain"
                  draggable="false"
                />
              ) : null}

              {previewUrl && mode === "crop" ? (
                <div
                  className="absolute touch-none border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.62)]"
                  style={cropStyle}
                  onPointerMove={handleCropPointerMove}
                  onPointerUp={handleCropPointerUp}
                  onPointerCancel={handleCropPointerUp}
                >
                  <button
                    type="button"
                    aria-label={t.cropHelp}
                    className="absolute inset-0 cursor-move bg-transparent"
                    onPointerDown={(event) => handleCropPointerDown(event, "move")}
                    onPointerMove={handleCropPointerMove}
                    onPointerUp={handleCropPointerUp}
                    onPointerCancel={handleCropPointerUp}
                  >
                    <Move
                      size={22}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow"
                    />
                  </button>
                  {handles.map((handle) => (
                    <button
                      key={handle.action}
                      type="button"
                      aria-label={`${t.crop} ${handle.action}`}
                      className={`absolute z-10 h-5 w-5 rounded-full border-2 border-[#0B4FD8] bg-white shadow ${handle.className}`}
                      onPointerDown={(event) => handleCropPointerDown(event, handle.action)}
                      onPointerMove={handleCropPointerMove}
                      onPointerUp={handleCropPointerUp}
                      onPointerCancel={handleCropPointerUp}
                    />
                  ))}
                </div>
              ) : null}

              {loadingMeta || saving ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-black text-slate-800 shadow-lg">
                    <Loader2 size={16} className="animate-spin" />
                    {loadingMeta ? t.loading : t.apply}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {mode === "crop" ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold leading-6 text-slate-600">{t.cropHelp}</p>
              <div className="flex items-center gap-3">
                <Minus size={16} className="text-slate-400" />
                <input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => handleZoomChange(event.target.value)}
                  className="h-2 w-full cursor-pointer accent-[#0B4FD8]"
                  aria-label={t.zoom}
                />
                <Plus size={16} className="text-slate-400" />
                <span className="min-w-14 text-center text-sm font-black text-slate-700" dir="ltr">
                  {Math.round(zoom * 100)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <Image size={20} className="shrink-0 text-emerald-700" />
              <p className="text-sm font-semibold leading-6 text-emerald-800">{t.fitHelp}</p>
            </div>
          )}

          <div className="flex flex-col justify-end gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={loadingMeta || saving || !previewUrl}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B4FD8] px-5 text-sm font-black text-white transition hover:bg-[#0942b6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {t.apply}
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
