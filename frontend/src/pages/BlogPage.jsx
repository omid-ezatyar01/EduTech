import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Clock3,
  Code2,
  Languages,
  Route,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const roadmaps = [
  {
    id: "english",
    category: "languages",
    href: "/blog/english",
    image: "/hero-student.png",
    stages: 4,
    duration: { fa: "۱۲ تا ۱۸ ماه", en: "12 to 18 months" },
    level: { fa: "از مبتدی تا پیشرفته", en: "Beginner to advanced" },
    title: { fa: "نقشه راه زبان انگلیسی", en: "English learning roadmap" },
    description: {
      fa: "مسیر مرحله‌به‌مرحله برای انتخاب کورس درست، ساختن پایه قوی و رسیدن به مکالمه روان.",
      en: "A step-by-step path for choosing the right courses, building strong foundations, and reaching fluency.",
    },
    keywords: "english language speaking grammar انگلیسی زبان مکالمه گرامر",
  },
];

const copy = {
  fa: {
    eyebrow: "راهنمای مسیر یادگیری",
    title: "نقشه راه مهارت‌های شما",
    intro: "هدف خود را انتخاب کنید و کورس‌ها را به ترتیب درست پیش ببرید؛ هر نقشه راه، نقطه شروع و قدم بعدی را روشن می‌کند.",
    search: "جستجوی نقشه راه...",
    library: "همه نقشه‌های راه",
    libraryText: "یک مسیر را انتخاب کنید و یادگیری هدفمند را آغاز کنید.",
    available: "منتشر شده", level: "سطح مسیر",
    stages: "مرحله",
    duration: "مدت پیشنهادی",
    open: "مشاهده نقشه راه",
    empty: "نقشه راهی با این جستجو پیدا نشد.",
    clear: "پاک‌کردن جستجو",
    comingTitle: "این کتابخانه در حال رشد است",
    comingText: "نقشه‌های راه تازه برای مهارت‌ها و موضوعات بیشتر به این صفحه اضافه می‌شوند.",
    filters: [
      ["all", "همه"],
      ["languages", "زبان‌ها"],
      ["technology", "تکنالوژی"],
      ["career", "کسب‌وکار"],
    ],
  },
  en: {
    eyebrow: "Learning path guides",
    title: "Roadmaps for your next skill",
    intro: "Choose a goal and take courses in the right order. Each roadmap makes your starting point and next step clear.",
    search: "Search roadmaps...",
    library: "All learning roadmaps",
    libraryText: "Choose a path and begin learning with purpose.",
    available: "Published", level: "Path level",
    stages: "stages",
    duration: "Suggested time",
    open: "View roadmap",
    empty: "No roadmap matches this search.",
    clear: "Clear search",
    comingTitle: "This library is growing",
    comingText: "New roadmaps for more skills and subjects will be added here over time.",
    filters: [
      ["all", "All"],
      ["languages", "Languages"],
      ["technology", "Technology"],
      ["career", "Business"],
    ],
  },
};

const categoryIcons = {
  all: Route,
  languages: Languages,
  technology: Code2,
  career: BriefcaseBusiness,
};

export default function BlogPage({ language = "fa" }) {
  const locale = language === "fa" ? "fa" : "en";
  const page = copy[locale];
  const DirectionArrow = locale === "fa" ? ArrowLeft : ArrowRight;
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const counts = useMemo(() => {
    const result = { all: roadmaps.length, languages: 0, technology: 0, career: 0 };
    roadmaps.forEach((roadmap) => { result[roadmap.category] += 1; });
    return result;
  }, []);

  const visibleRoadmaps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return roadmaps.filter((roadmap) => {
      const matchesCategory = filter === "all" || roadmap.category === filter;
      const searchable = `${roadmap.title.fa} ${roadmap.title.en} ${roadmap.description.fa} ${roadmap.description.en} ${roadmap.keywords}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [filter, query]);

  const clearFilters = () => {
    setFilter("all");
    setQuery("");
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-10 pt-8 text-slate-950">
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-8 sm:py-10 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 text-sm font-black text-teal-700">
                <Route size={18} />
                {page.eyebrow}
              </div>
              <h1 className="mt-4 text-3xl font-black leading-[1.35] sm:text-4xl lg:text-5xl">{page.title}</h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base">{page.intro}</p>
            </div>
            <label className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-500 transition focus-within:border-primary-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary-100">
              <Search size={19} className="shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={page.search}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
          </div>
        </header>
      </div>

      <main className="mx-auto max-w-[1340px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-black sm:text-3xl">{page.library}</h2>
            <p className="mt-2 text-sm font-medium text-slate-600 sm:text-base">{page.libraryText}</p>
          </div>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label={page.library}>
            {page.filters.map(([value, label]) => {
              const Icon = categoryIcons[value];
              const disabled = counts[value] === 0;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setFilter(value)}
                  className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-black transition ${
                    filter === value
                      ? "border-primary-600 bg-primary-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:text-primary-700"
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  <Icon size={15} />
                  {label}
                  <span className={filter === value ? "text-blue-100" : "text-slate-400"}>{counts[value]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {visibleRoadmaps.length ? (
          <div className={`mt-8 grid gap-5 ${visibleRoadmaps.length === 1 ? "mx-auto max-w-5xl" : "md:grid-cols-2 xl:grid-cols-3"}`}>
            {visibleRoadmaps.map((roadmap) => (
              <article key={roadmap.id} className={`group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-primary-200 hover:shadow-soft ${visibleRoadmaps.length === 1 ? "min-h-[430px] md:grid md:min-h-[330px] md:grid-cols-[0.95fr_1.05fr]" : "min-h-[430px]"}`}>
                <Link to={roadmap.href} className={`relative block aspect-[16/9] overflow-hidden bg-slate-200 ${visibleRoadmaps.length === 1 ? "md:aspect-auto md:h-full" : ""}`}>
                  <img src={roadmap.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute start-4 top-4 rounded-md bg-white px-3 py-1.5 text-xs font-black text-teal-700 shadow-sm">{page.available}</span>
                </Link>
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><BookOpen size={15} className="text-primary-600" />{roadmap.stages} {page.stages}</span>
                    <span className="inline-flex items-center gap-1.5"><Clock3 size={15} className="text-primary-600" />{roadmap.duration[locale]}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-black text-slate-950 sm:text-2xl">{roadmap.title[locale]}</h3>
                  <p className="mt-3 text-sm font-medium leading-7 text-slate-600">{roadmap.description[locale]}</p>
                  <div className="mt-auto flex items-end justify-between gap-4 border-t border-slate-100 pt-5">
                    <div><p className="text-xs font-bold text-slate-400">{page.level}</p><p className="mt-1 text-xs font-black text-slate-700">{roadmap.level[locale]}</p></div>
                    <Link to={roadmap.href} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-xs font-black text-white transition hover:bg-primary-700">
                      {page.open}<DirectionArrow size={15} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
            <Search size={25} className="mx-auto text-slate-400" />
            <p className="mt-4 text-sm font-black text-slate-700">{page.empty}</p>
            <button type="button" onClick={clearFilters} className="mt-4 text-sm font-black text-primary-700 hover:text-primary-600">{page.clear}</button>
          </div>
        )}

        <aside className="mt-8 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700"><Route size={21} /></span>
            <div><h2 className="text-base font-black text-slate-950">{page.comingTitle}</h2><p className="mt-1 text-sm font-medium leading-6 text-slate-600">{page.comingText}</p></div>
          </div>
        </aside>
      </main>
    </div>
  );
}
