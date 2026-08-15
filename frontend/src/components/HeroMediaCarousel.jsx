import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  fetchPublicHeroMedia,
  resolveHeroMediaLink,
  resolveHeroMediaUrl,
} from "../../services/heroMediaService.js";

const AUTO_ROTATE_DELAY_MS = 4000;
const SWIPE_THRESHOLD_PX = 42;
const IMAGE_PRELOAD_TIMEOUT_MS = 20000;

const preloadImage = (source) =>
  new Promise((resolve) => {
    const image = new window.Image();
    let settled = false;

    const finish = (loaded) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(loaded);
    };

    const timeout = window.setTimeout(
      () => finish(false),
      IMAGE_PRELOAD_TIMEOUT_MS,
    );
    image.onload = () => {
      if (typeof image.decode !== "function") {
        finish(true);
        return;
      }
      image.decode().catch(() => {}).finally(() => finish(true));
    };
    image.onerror = () => finish(false);
    image.src = source;
  });

export default function HeroMediaCarousel({ language = "fa", fallbackAlt = "" }) {
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(null);
  const didSwipe = useRef(false);

  useEffect(() => {
    let active = true;
    fetchPublicHeroMedia()
      .then(async (rows) => {
        const prepared = await Promise.all(
          rows.map(async (row) => {
            const source = resolveHeroMediaUrl(row.mediaUrl);
            return (await preloadImage(source)) ? row : null;
          }),
        );
        if (active) setItems(prepared.filter(Boolean));
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const move = useCallback(
    (direction) => {
      setActiveIndex((current) => {
        if (items.length < 2) return 0;
        return (current + direction + items.length) % items.length;
      });
    },
    [items.length],
  );

  useEffect(() => {
    if (items.length < 2 || isPaused) return undefined;
    const timer = window.setTimeout(() => move(1), AUTO_ROTATE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isPaused, items.length, move]);

  const finishSwipe = (clientX) => {
    if (touchStartX.current === null) return;
    const distance = clientX - touchStartX.current;
    touchStartX.current = null;
    setIsPaused(false);
    didSwipe.current = Math.abs(distance) >= SWIPE_THRESHOLD_PX;
    if (!didSwipe.current) return;
    move(distance < 0 ? 1 : -1);
  };

  if (items.length === 0) {
    return (
      <picture className="block h-full w-full">
        <source srcSet="/hero-student.webp" type="image/webp" />
        <img
          className="h-full w-full object-contain object-center md:object-cover"
          src="/hero-student.png"
          width="1920"
          height="1080"
          fetchPriority="high"
          decoding="async"
          alt={fallbackAlt}
        />
      </picture>
    );
  }

  return (
    <div
      className="relative z-10 h-full w-full touch-pan-y select-none overflow-hidden bg-slate-950"
      role="region"
      aria-roledescription="carousel"
      aria-label={language === "fa" ? "تصاویر تبلیغاتی" : "Advertisement images"}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
        didSwipe.current = false;
        setIsPaused(true);
      }}
      onTouchEnd={(event) => finishSwipe(event.changedTouches[0]?.clientX ?? 0)}
      onTouchCancel={() => {
        touchStartX.current = null;
        setIsPaused(false);
      }}
    >
      {items.map((item, index) => {
        const isActive = index === activeIndex;
        const source = resolveHeroMediaUrl(item.mediaUrl);
        const link = resolveHeroMediaLink(item.linkUrl);
        const imageContent = (
          <>
            <img
              src={source}
              alt=""
              aria-hidden="true"
              draggable="false"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl md:hidden"
            />
            <img
              src={source}
              alt={fallbackAlt}
              draggable="false"
              className="relative h-full w-full object-contain md:object-cover"
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
            />
          </>
        );
        return (
          <div
            key={item._id || source}
            className={`absolute inset-0 transition-all duration-700 ease-out motion-reduce:transition-none ${
              isActive
                ? "z-10 scale-100 opacity-100"
                : "pointer-events-none z-0 scale-[1.018] opacity-0"
            }`}
            aria-hidden={!isActive}
          >
            {link ? (
              <a
                href={link}
                className="relative block h-full w-full cursor-pointer"
                aria-label={fallbackAlt || (language === "fa" ? "باز کردن تبلیغ" : "Open advertisement")}
                onClick={(event) => {
                  if (!didSwipe.current) return;
                  event.preventDefault();
                  didSwipe.current = false;
                }}
              >
                {imageContent}
                <span className="absolute bottom-3 end-3 z-20 inline-flex items-center gap-2 rounded-xl border border-white/35 bg-slate-950/80 px-3.5 py-2 text-xs font-black text-white shadow-lg backdrop-blur-md transition hover:bg-primary-600 sm:bottom-4 sm:end-4 sm:px-4 sm:py-2.5 sm:text-sm">
                  <ExternalLink size={16} aria-hidden="true" />
                  {language === "fa" ? "مشاهده بیشتر" : "Learn more"}
                </span>
              </a>
            ) : imageContent}
          </div>
        );
      })}

      {items.length > 1 ? (
        <div className="absolute inset-x-0 bottom-2.5 z-20 flex justify-center">
          <div className="flex items-center gap-1.5 rounded-full bg-slate-950/35 p-1.5 shadow-lg backdrop-blur-md">
            {items.map((item, index) => (
              <button
                key={item._id || index}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`${language === "fa" ? "نمایش تبلیغ" : "Show advertisement"} ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === activeIndex
                    ? "w-6 bg-white"
                    : "w-1.5 bg-white/55 hover:bg-white/85"
                }`}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
