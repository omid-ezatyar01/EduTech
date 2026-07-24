import { Check, Loader2, Minus, Move, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  clampCropPosition,
  compressImageFileToLimit,
  cropImageFile,
  getCoverCropBounds,
  loadImageDimensions,
} from "../utils/imageCrop";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export default function ProfileImageCropModal({
  open,
  file,
  language = "fa",
  onClose,
  onApply,
}) {
  const frameRef = useRef(null);
  const dragStateRef = useRef(null);
  const [imageMeta, setImageMeta] = useState({ width: 0, height: 0 });
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isFa = language === "fa";
  const t = {
    title: isFa ? "تنظیم عکس پروفایل" : "Adjust profile image",
    subtitle: isFa
      ? "جای تصویر را تنظیم کنید تا عکس پروفایل دقیق و مرتب نمایش داده شود."
      : "Adjust the image position so your profile photo looks clean and centered.",
    move: isFa ? "جابه‌جایی" : "Move",
    zoom: isFa ? "بزرگ‌نمایی" : "Zoom",
    cancel: isFa ? "انصراف" : "Cancel",
    apply: isFa ? "استفاده از این برش" : "Use this crop",
    loading: isFa ? "در حال آماده‌سازی تصویر" : "Preparing image",
    failed: isFa ? "آماده‌سازی تصویر انجام نشد." : "Unable to prepare the image.",
    helper: isFa
      ? "بخش داخل دایره همان بخشی است که در پروفایل دیده می‌شود."
      : "The part inside the circle is what will appear in your profile.",
  };

  useEffect(() => {
    if (!open || !(file instanceof File)) return undefined;
    let active = true;
    const objectUrl = URL.createObjectURL(file);
    const resetFrame = window.requestAnimationFrame(() => {
      if (!active) return;
      setLoadingMeta(true);
      setError("");
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setPreviewUrl(objectUrl);
    });

    loadImageDimensions(file)
      .then((meta) => {
        if (!active) return;
        setImageMeta(meta);
      })
      .catch(() => {
        if (!active) return;
        setError(t.failed);
      })
      .finally(() => {
        if (active) setLoadingMeta(false);
      });

    return () => {
      active = false;
      window.cancelAnimationFrame(resetFrame);
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, open, t.failed]);

  useEffect(() => {
    if (!open || !frameRef.current || typeof ResizeObserver === "undefined") return undefined;
    const element = frameRef.current;
    const updateSize = () => {
      const size = Math.min(element.clientWidth || 0, 340);
      setFrameSize({ width: size, height: size });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  const bounds = useMemo(
    () =>
      getCoverCropBounds({
        imageWidth: imageMeta.width,
        imageHeight: imageMeta.height,
        frameWidth: frameSize.width || 1,
        frameHeight: frameSize.height || 1,
        zoom,
      }),
    [frameSize.height, frameSize.width, imageMeta.height, imageMeta.width, zoom],
  );

  const clampedPosition = useMemo(
    () => clampCropPosition(position, bounds),
    [bounds, position],
  );

  const handlePointerDown = (event) => {
    if (!previewUrl || loadingMeta || saving) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: clampedPosition.x,
      initialY: clampedPosition.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(
      clampCropPosition(
        {
          x: drag.initialX + (event.clientX - drag.startX),
          y: drag.initialY + (event.clientY - drag.startY),
        },
        bounds,
      ),
    );
  };

  const handlePointerUp = (event) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  const handleZoomChange = (nextZoom) => {
    const safeZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(nextZoom || 1)));
    const nextBounds = getCoverCropBounds({
      imageWidth: imageMeta.width,
      imageHeight: imageMeta.height,
      frameWidth: frameSize.width || 1,
      frameHeight: frameSize.height || 1,
      zoom: safeZoom,
    });
    setZoom(safeZoom);
    setPosition((prev) => clampCropPosition(prev, nextBounds));
  };

  const handleApply = async () => {
    if (!(file instanceof File) || saving || loadingMeta) return;
    try {
      setSaving(true);
      setError("");
      const croppedFile = await cropImageFile({
        file,
        imageWidth: imageMeta.width,
        imageHeight: imageMeta.height,
        frameWidth: frameSize.width || 320,
        frameHeight: frameSize.height || 320,
        position: clampedPosition,
        zoom,
        targetWidth: 800,
        targetHeight: 800,
        baseName: "profile-avatar",
      });
      const optimizedFile = await compressImageFileToLimit({
        file: croppedFile,
        maxBytes: 350 * 1024,
        maxWidth: 800,
        maxHeight: 800,
        initialQuality: 0.8,
        baseName: "profile-avatar",
      });
      onApply?.(optimizedFile);
    } catch {
      setError(t.failed);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !(file instanceof File)) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-4">
      <div
        className="w-full max-w-2xl rounded-t-[28px] bg-white shadow-2xl sm:rounded-[30px]"
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
          <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,#f8fafc,#eef2ff)] p-4 sm:p-6">
            <div ref={frameRef} className="mx-auto w-full max-w-[340px]">
              <div className="relative aspect-square overflow-hidden rounded-[30px] bg-slate-900 shadow-[0_24px_55px_rgba(15,23,42,0.18)]">
                {previewUrl ? (
                  <div
                    className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  >
                    <img
                      src={previewUrl}
                      alt="Profile crop preview"
                      draggable="false"
                      className="absolute left-1/2 top-1/2 max-w-none select-none"
                      style={{
                        width: `${bounds.renderedWidth}px`,
                        height: `${bounds.renderedHeight}px`,
                        transform: `translate(calc(-50% + ${clampedPosition.x}px), calc(-50% + ${clampedPosition.y}px))`,
                        userSelect: "none",
                      }}
                    />
                  </div>
                ) : null}

                <div className="pointer-events-none absolute inset-0 rounded-[30px] border-[14px] border-white/55" />
                <div className="pointer-events-none absolute inset-[10%] rounded-full border-2 border-white/95 shadow-[0_0_0_999px_rgba(15,23,42,0.24)]" />

                {(loadingMeta || saving) ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-black text-slate-800 shadow-lg">
                      <Loader2 size={16} className="animate-spin" />
                      {loadingMeta ? t.loading : t.apply}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="inline-flex items-center gap-2 text-sm font-black text-slate-700">
              <Move size={16} className="text-primary-600" />
              {t.move}
            </div>
            <p className="text-xs font-semibold text-slate-500">{t.helper}</p>

            <div className="inline-flex items-center gap-2 text-sm font-black text-slate-700">
              <Plus size={16} className="text-primary-600" />
              {t.zoom}
            </div>
            <div className="flex items-center gap-3">
              <Minus size={16} className="text-slate-400" />
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(event) => handleZoomChange(event.target.value)}
                className="h-2 w-full cursor-pointer accent-primary-600"
              />
              <Plus size={16} className="text-slate-400" />
              <span className="min-w-14 text-center text-sm font-black text-slate-700" dir="ltr">
                {Math.round(zoom * 100)}%
              </span>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
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
              disabled={saving || loadingMeta}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-black text-white shadow-lg shadow-primary-100 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {t.apply}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
