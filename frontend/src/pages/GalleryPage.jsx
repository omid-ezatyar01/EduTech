import { Camera, Images, X, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router";
import {
  fetchGallery,
  resolveGalleryImageUrl,
} from "../../services/galleryService.js";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";

const copy = {
  fa: {
    eyebrow: "لحظه‌های ایجوتک",
    title: "گالری تصاویر",
    intro: "نگاهی به صنف‌ها، رویدادها و فعالیت‌های جامعه آموزشی ایجوتک.",
    all: "همه تصاویر",
    empty: "هنوز تصویری در این دسته منتشر نشده است.",
    loading: "در حال بارگذاری گالری…",
    retry: "تلاش دوباره",
    close: "بستن تصویر",
    view: "مشاهده تصویر",
  },
  en: {
    eyebrow: "EduTech moments",
    title: "Image gallery",
    intro: "Explore classes, events, and activities from the EduTech learning community.",
    all: "All images",
    empty: "No images have been published in this category yet.",
    loading: "Loading gallery…",
    retry: "Try again",
    close: "Close image",
    view: "View image",
  },
};

const categoryLabels = {
  fa: {
    events: "رویدادها",
    classes: "صنف‌ها",
    workshops: "ورکشاپ‌ها",
    graduation: "فراغت",
    community: "جامعه ایجوتک",
    general: "عمومی",
  },
  en: {
    events: "Events",
    classes: "Classes",
    workshops: "Workshops",
    graduation: "Graduation",
    community: "Community",
    general: "General",
  },
};

const localizedTitle = (item, locale) =>
  item?.title?.[locale] || item?.title?.[locale === "fa" ? "en" : "fa"] || "";

export default function GalleryPage({ language = "fa" }) {
  const locale = language === "fa" ? "fa" : "en";
  const text = copy[locale];
  const { category: routeCategory } = useParams();
  const navigate = useNavigate();
  const category = routeCategory || "all";
  const [images, setImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [resolvedCategory, setResolvedCategory] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchGallery({ category, limit: 100 });
      setImages(result.images);
      setCategories(result.meta.categories || []);
      setResolvedCategory(category);
    } catch (err) {
      setError(err.message || text.empty);
      setResolvedCategory(category);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchGallery({ category, limit: 100 })
      .then((result) => {
        if (active) {
          setImages(result.images);
          setCategories(result.meta.categories || []);
          setError("");
          setResolvedCategory(category);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || text.empty);
        setResolvedCategory(category);
      })
      .finally(() => active && setLoading(false));
    window.scrollTo(0, 0);
    return () => {
      active = false;
    };
  }, [category, text.empty]);

  useEffect(() => {
    if (!selected) return undefined;
    const closeOnEscape = (event) => event.key === "Escape" && setSelected(null);
    document.body.classList.add("overflow-hidden");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("overflow-hidden");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selected]);

  const chooseCategory = (value) => {
    setLoading(true);
    navigate(value === "all" ? "/gallery" : `/gallery/${value}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16" dir={locale === "fa" ? "rtl" : "ltr"}>
      <section className="px-4 pt-8 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-[1536px] overflow-hidden rounded-3xl border border-slate-100 bg-white px-5 py-10 text-center shadow-sm sm:px-8 sm:py-14">
          <div className="absolute -start-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="absolute -bottom-28 end-0 h-80 w-80 rounded-full bg-teal-100/70 blur-3xl" />
          <div className="relative mx-auto max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-black text-teal-700">
              <Camera size={17} /> {text.eyebrow}
            </p>
            <h1 className="mt-5 text-3xl font-black text-slate-950 sm:text-5xl">{text.title}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base">{text.intro}</p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1340px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {["all", ...categories].map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => chooseCategory(value)}
              className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-black transition ${
                category === value
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
              }`}
            >
              {value === "all" ? text.all : categoryLabels[locale][value] || value}
            </button>
          ))}
        </div>

        {loading || resolvedCategory !== category ? (
          <FrontendPageLoader label={text.loading} />
        ) : error ? (
          <div className="mt-8 rounded-3xl border border-red-200 bg-white py-16 text-center">
            <p className="font-bold text-red-700">{error}</p>
            <button type="button" onClick={load} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">{text.retry}</button>
          </div>
        ) : images.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <Images className="mx-auto text-slate-300" size={48} />
            <p className="mt-4 font-bold text-slate-500">{text.empty}</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((item) => {
              const title = localizedTitle(item, locale);
              const alt = title || item.category;
              return (
                <button
                  type="button"
                  key={item._id}
                  onClick={() => setSelected(item)}
                  aria-label={`${text.view}: ${alt}`}
                  className="group flex h-full w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-start shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    <img src={resolveGalleryImageUrl(item.image)} alt={alt} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    <span className="absolute end-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-slate-950/65 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"><ZoomIn size={18} /></span>
                  </div>
                  <div className="p-4 sm:px-5">
                    <h2 className="line-clamp-1 font-black text-slate-950">
                      {title || categoryLabels[locale][item.category] || item.category}
                    </h2>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {selected && createPortal(
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-slate-950/95 p-3 backdrop-blur-sm sm:p-5"
          onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-label={text.view}
        >
          <div className="flex shrink-0 justify-end">
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label={text.close}
              className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-900 shadow-lg transition hover:bg-slate-100"
            >
              <X size={21} />
            </button>
          </div>
          <div
            className="flex min-h-0 flex-1 items-center justify-center py-3"
            onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}
          >
            <img
              src={resolveGalleryImageUrl(selected.image)}
              alt={localizedTitle(selected, locale) || selected.category}
              className="block h-auto w-auto max-h-full max-w-full object-contain"
            />
          </div>
          {localizedTitle(selected, locale) && (
            <div className="mx-auto w-full max-w-4xl shrink-0 rounded-2xl bg-white/10 px-4 py-3 text-center text-white backdrop-blur sm:px-6">
              <p className="font-black">{localizedTitle(selected, locale)}</p>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
