import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  Clock3,
  Code2,
  Compass,
  Languages,
  Route,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

const roadmaps = [
  {
    id: "english",
    category: "languages",
    href: "/roadmaps/english",
    image: "/hero-student.webp",
    stages: 4,
    stageLabels: ["A0 - A1", "A2", "B1 - B2", "C1 - C2"],
    duration: { fa: "۱۲ تا ۱۸ ماه", en: "12 to 18 months" },
    level: { fa: "از مبتدی تا پیشرفته", en: "Beginner to advanced" },
    title: { fa: "نقشه راه زبان انگلیسی", en: "English learning roadmap" },
    description: {
      fa: "مسیر مرحله‌به‌مرحله برای انتخاب کورس درست، ساختن پایه قوی و رسیدن به مکالمه روان.",
      en: "A step-by-step path for choosing the right courses, building strong foundations, and reaching fluency.",
    },
    outcomes: {
      fa: ["شروع از سطح واقعی خودتان", "کورس‌های مناسب هر مرحله", "معیار روشن برای پیشرفت"],
      en: ["Start at your current level", "Courses matched to each stage", "Clear progress checkpoints"],
    },
    keywords: "english language speaking grammar انگلیسی زبان مکالمه گرامر",
  },
];

const copy = {
  fa: {
    eyebrow: "راهنمای مسیر یادگیری",
    title: "برای هدف خود، مسیر روشن بسازید",
    intro: "به‌جای انتخاب تصادفی کورس‌ها، از سطح فعلی خود آغاز کنید و هر مهارت را به ترتیب درست پیش ببرید.",
    publishedCount: "نقشه راه منتشرشده",
    clearStages: "مرحله روشن",
    guidedLearning: "یادگیری هدفمند",
    library: "نقشه‌های راه یادگیری",
    available: "آماده شروع",
    level: "سطح مسیر",
    stages: "مرحله",
    duration: "زمان پیشنهادی",
    open: "شروع نقشه راه",
    preview: "مراحل این مسیر",
    includes: "در این مسیر",
    empty: "نقشه راهی مطابق جستجوی شما پیدا نشد.",
    emptyText: "عبارت دیگری جستجو کنید یا همه دسته‌ها را ببینید.",
    clear: "نمایش همه نقشه‌ها",
    howEyebrow: "ساده و قابل اجرا",
    howTitle: "نقشه راه چگونه کمک می‌کند؟",
    howText: "هر مسیر یادگیری سه پرسش مهم را برای شما پاسخ می‌دهد.",
    howSteps: [
      ["از کجا شروع کنم؟", "سطح فعلی خود را پیدا کنید و از مرحله‌ای آغاز کنید که برای شما مناسب است."],
      ["بعد چه چیزی بخوانم؟", "مراحل و کورس‌ها را با ترتیب درست ببینید و بدون سردرگمی پیش بروید."],
      ["چه زمانی آماده‌ام؟", "با تمرین‌ها و معیار هر مرحله بدانید چه زمانی وارد قدم بعدی شوید."],
    ],
    comingTitle: "مسیرهای بیشتری در راه است",
    comingText: "نقشه‌های راه تکنالوژی و مهارت‌های کاری به‌تدریج به این کتابخانه اضافه می‌شوند.",
    soon: "به‌زودی",
    filters: [
      ["all", "همه مسیرها"],
      ["languages", "زبان‌ها"],
      ["technology", "تکنالوژی"],
      ["career", "کسب‌وکار"],
    ],
  },
  en: {
    eyebrow: "Learning path guides",
    title: "Build a clear path to your goal",
    intro: "Stop choosing courses at random. Start at your current level and learn each skill in the right order.",
    publishedCount: "published roadmap",
    clearStages: "clear stages",
    guidedLearning: "guided learning",
    library: "Learning roadmaps",
    available: "Ready to start",
    level: "Path level",
    stages: "stages",
    duration: "Suggested time",
    open: "Start this roadmap",
    preview: "Path stages",
    includes: "What you get",
    empty: "No roadmap matches your search.",
    emptyText: "Try another phrase or return to all categories.",
    clear: "Show all roadmaps",
    howEyebrow: "Simple and actionable",
    howTitle: "How does a roadmap help?",
    howText: "Each learning path answers three important questions for you.",
    howSteps: [
      ["Where should I begin?", "Identify your current level and begin at the stage that fits you."],
      ["What should I learn next?", "See stages and courses in the right order and move forward without confusion."],
      ["When am I ready?", "Use each stage's practice and checkpoint to know when to continue."],
    ],
    comingTitle: "More paths are on the way",
    comingText: "Technology and career roadmaps will gradually be added to this library.",
    soon: "Coming soon",
    filters: [
      ["all", "All paths"],
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

const howIcons = [Compass, Route, Target];

export default function BlogPage({ language = "fa" }) {
  const locale = language === "fa" ? "fa" : "en";
  const page = copy[locale];
  const DirectionArrow = locale === "fa" ? ArrowLeft : ArrowRight;
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === "fa" ? "fa-AF" : "en-US"),
    [locale],
  );
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const counts = useMemo(() => {
    const result = { all: roadmaps.length, languages: 0, technology: 0, career: 0 };
    roadmaps.forEach((roadmap) => { result[roadmap.category] += 1; });
    return result;
  }, []);

  const visibleRoadmaps = useMemo(() => {
    return roadmaps.filter((roadmap) => {
      const matchesCategory = filter === "all" || roadmap.category === filter;
      return matchesCategory;
    });
  }, [filter]);

  const clearFilters = () => {
    setFilter("all");
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-8 text-slate-950" dir={locale === "fa" ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white px-5 py-10 shadow-sm sm:px-8 sm:py-12 lg:px-12">
          <div className="absolute -start-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="absolute -bottom-24 end-0 h-72 w-72 rounded-full bg-teal-100/70 blur-3xl" />
          <div className="relative mx-auto max-w-4xl text-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-black text-teal-700">
                <Route size={17} />
                {page.eyebrow}
              </p>
              <h1 className={`mx-auto mt-5 w-full text-center font-black leading-[1.3] tracking-tight ${locale === "fa" ? "whitespace-nowrap text-[clamp(1.3rem,6.5vw,3rem)]" : "max-w-2xl text-3xl sm:text-5xl"}`}>{page.title}</h1>
              <p className="mx-auto mt-4 max-w-2xl text-center text-sm font-medium leading-7 text-slate-600 sm:text-base sm:leading-8">{page.intro}</p>
              <div className="mx-auto mt-7 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
                {[
                  [numberFormatter.format(roadmaps.length), page.publishedCount],
                  [numberFormatter.format(roadmaps.reduce((total, item) => total + item.stages, 0)), page.clearStages],
                  ["✓", page.guidedLearning],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white/80 px-2 py-3 text-center shadow-sm backdrop-blur sm:px-4">
                    <p className="text-lg font-black text-primary-700 sm:text-xl">{value}</p>
                    <p className="mt-1 text-[10px] font-bold leading-4 text-slate-500 sm:text-xs">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>
      </div>

      <main className="mx-auto max-w-[1340px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <section aria-labelledby="roadmap-library-title">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2 id="roadmap-library-title" className="text-2xl font-black sm:text-3xl">{page.library}</h2>
            </div>
            <div className="edutech-scrollbar flex max-w-full gap-2 overflow-x-auto pb-2" aria-label={page.library}>
              {page.filters.map(([value, label]) => {
                const Icon = categoryIcons[value];
                const disabled = counts[value] === 0;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setFilter(value)}
                    className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-xs font-black transition ${
                      filter === value
                        ? "border-primary-600 bg-primary-600 text-white shadow-lg shadow-primary-100"
                        : "border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:text-primary-700"
                    } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none`}
                  >
                    <Icon size={15} />
                    {label}
                    {disabled ? <span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] text-slate-400">{page.soon}</span> : <span className={filter === value ? "text-blue-100" : "text-slate-400"}>{numberFormatter.format(counts[value])}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {visibleRoadmaps.length ? (
            <div className="mt-8 grid gap-6">
              {visibleRoadmaps.map((roadmap) => (
                <article key={roadmap.id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)] transition hover:border-primary-200 hover:shadow-[0_22px_50px_rgba(37,99,235,0.12)]">
                  <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
                    <Link to={roadmap.href} className="relative block min-h-64 overflow-hidden bg-slate-200 lg:min-h-[520px]">
                      <img src={roadmap.image} alt={roadmap.title[locale]} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" />
                      <span className="absolute start-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-black text-teal-700 shadow-lg backdrop-blur"><Check size={14} strokeWidth={3} />{page.available}</span>
                      <div className="absolute inset-x-5 bottom-5 text-white">
                        <p className="text-xs font-black text-teal-300">{page.level}</p>
                        <p className="mt-1 text-lg font-black">{roadmap.level[locale]}</p>
                      </div>
                    </Link>

                    <div className="flex flex-col p-5 sm:p-7 lg:p-9">
                      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-primary-700"><BookOpen size={15} />{numberFormatter.format(roadmap.stages)} {page.stages}</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5"><Clock3 size={15} className="text-teal-600" />{roadmap.duration[locale]}</span>
                      </div>
                      <h3 className="mt-5 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{roadmap.title[locale]}</h3>
                      <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base">{roadmap.description[locale]}</p>

                      <div className="mt-6">
                        <p className="text-xs font-black text-slate-500">{page.preview}</p>
                        <div className="relative mt-3 grid grid-cols-4 gap-2 before:absolute before:left-[10%] before:right-[10%] before:top-5 before:h-0.5 before:bg-slate-200 rtl:before:left-[10%] rtl:before:right-[10%]">
                          {roadmap.stageLabels.map((stage, index) => (
                            <div key={stage} className="relative text-center">
                              <span className="relative z-10 mx-auto grid h-10 w-10 place-items-center rounded-full border-4 border-white bg-primary-600 text-xs font-black text-white shadow-sm">{numberFormatter.format(index + 1)}</span>
                              <p className="mt-2 text-[10px] font-black text-slate-600 sm:text-xs">{stage}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs font-black text-slate-500">{page.includes}</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          {roadmap.outcomes[locale].map((outcome) => (
                            <span key={outcome} className="flex items-start gap-2 text-xs font-bold leading-5 text-slate-700"><Check size={14} className="mt-0.5 shrink-0 text-teal-600" strokeWidth={3} />{outcome}</span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-auto pt-7">
                        <Link to={roadmap.href} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-black text-white transition hover:bg-primary-700">
                          {page.open}<DirectionArrow size={17} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center shadow-sm">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Search size={25} /></span>
              <h3 className="mt-4 text-base font-black text-slate-800">{page.empty}</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">{page.emptyText}</p>
              <button type="button" onClick={clearFilters} className="mt-5 inline-flex h-11 items-center rounded-xl bg-primary-600 px-5 text-sm font-black text-white transition hover:bg-primary-700">{page.clear}</button>
            </div>
          )}
        </section>

        <section className="mt-14" aria-labelledby="roadmap-how-title">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-black text-teal-700">{page.howEyebrow}</p>
            <h2 id="roadmap-how-title" className="mt-2 text-2xl font-black sm:text-3xl">{page.howTitle}</h2>
            <p className="mt-3 text-sm font-medium leading-7 text-slate-600 sm:text-base">{page.howText}</p>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {page.howSteps.map(([title, text], index) => {
              const Icon = howIcons[index];
              return (
                <article key={title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center justify-between">
                    <span className={`grid h-12 w-12 place-items-center rounded-2xl ${index === 1 ? "bg-teal-50 text-teal-700" : "bg-primary-50 text-primary-700"}`}><Icon size={23} /></span>
                    <span className="text-3xl font-black text-slate-100">{numberFormatter.format(index + 1)}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm font-medium leading-7 text-slate-600">{text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="mt-8 overflow-hidden rounded-3xl border border-teal-200 bg-gradient-to-r from-teal-50 to-blue-50 p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-teal-700 shadow-sm"><Sparkles size={22} /></span>
              <div><h2 className="text-lg font-black text-slate-950">{page.comingTitle}</h2><p className="mt-1 max-w-3xl text-sm font-medium leading-7 text-slate-600">{page.comingText}</p></div>
            </div>
            <span className="self-start rounded-full border border-teal-200 bg-white px-4 py-2 text-xs font-black text-teal-700 sm:self-auto">{page.soon}</span>
          </div>
        </aside>
      </main>
    </div>
  );
}
