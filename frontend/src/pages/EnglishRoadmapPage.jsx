import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronUp, Clock3,
  Headphones, LayoutGrid, MessageCircle, Mic2, Route, Sparkles, Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPublicCategories, fetchPublishedCourses } from "../../services/courseService.js";
import { buildCoursePath } from "../utils/routePaths.js";

const ENGLISH_TERMS = ["english", "انگلیسی", "انگليسی", "انگليسي"];
const stageIcons = [BookOpen, Headphones, MessageCircle, Target];
const catalogLevels = ["beginner", "beginner", "intermediate", "advanced"];

function buildEnglishCatalogPath(stageIndex) {
  const params = new URLSearchParams({ roadmap: "english" });
  if (Number.isInteger(stageIndex) && catalogLevels[stageIndex]) {
    params.set("level", catalogLevels[stageIndex]);
    params.set("stage", ["A0-A1", "A2", "B1-B2", "C1-C2"][stageIndex]);
  }
  return `/live-courses?${params.toString()}`;
}

const translations = {
  fa: {
    eyebrow: "نقشه راه یادگیری", allRoadmaps: "همه نقشه‌های راه", title: "مسیر درست یادگیری زبان انگلیسی",
    intro: "به‌جای انتخاب تصادفی کورس، از سطح فعلی‌تان آغاز کنید و قدم‌به‌قدم تا مکالمه روان پیش بروید.",
    start: "سطحم را پیدا می‌کنم", courses: "مشاهده همه کورس‌ها",
    finderTitle: "از کدام مرحله شروع کنم؟",
    finderText: "جمله‌ای را انتخاب کنید که وضعیت امروز شما را بهتر بیان می‌کند.",
    recommended: "شروع پیشنهادی شما", pathTitle: "نقشه راه انگلیسی",
    pathText: "هر مرحله را به ترتیب تکمیل کنید؛ کورس‌های مناسب هر سطح در همان مرحله نمایش داده می‌شوند.",
    available: "کورس پیشنهادی", availablePlural: "کورس پیشنهادی", viewCourse: "جزئیات کورس",
    viewLevel: "دیدن کورس‌های این مرحله", loading: "در حال یافتن کورس‌های مناسب...",
    noMatch: "کورس تازه این مرحله به‌زودی معرفی می‌شود.", duration: "زمان پیشنهادی",
    showDetails: "جزئیات این مرحله", hideDetails: "بستن جزئیات",
    topicsTitle: "موضوعات اصلی", practiceTitle: "تمرین پیشنهادی", checkpointTitle: "آماده رفتن به مرحله بعد هستید وقتی که...",
    selectionTitle: "چطور کورس درست را انتخاب کنم؟",
    selectionText: "انتخاب کورس باید بر اساس دسته‌بندی زبان انگلیسی و سطحی باشد که مدرس هنگام ساخت کورس مشخص کرده است.",
    selectionSteps: [
      ["سطح فعلی را مشخص کنید", "با سطح‌سنج بالا نزدیک‌ترین مرحله به توانایی امروزتان را انتخاب کنید."],
      ["کورس همان سطح را بردارید", "کورس‌های مبتدی، متوسط یا پیشرفته همان مرحله را مقایسه کنید."],
      ["با معیار مرحله پیش بروید", "پس از انجام تمرین‌ها و رسیدن به معیار آمادگی، وارد مرحله بعد شوید."],
    ],
    habitTitle: "برنامه هفتگی ساده",
    habitText: "برای نتیجه بهتر، هر هفته این چهار فعالیت را در کنار کورس خود ادامه دهید.",
    habits: [["۳ جلسه", "درس و گرامر"], ["روزانه ۲۰ دقیقه", "شنیدن انگلیسی"], ["۲ تمرین", "مکالمه و تلفظ"], ["۱ مرور", "لغات هفته"]],
    ctaTitle: "برای شروع آماده‌اید؟", ctaText: "سطح مناسب خود را انتخاب کنید و اولین کورس مسیرتان را ببینید.",
    cta: "انتخاب اولین کورس", soon: "زبان‌های بیشتر به‌زودی", english: "انگلیسی",
    choices: [
      "تازه شروع می‌کنم و الفبا یا جمله‌های ساده را نمی‌دانم.",
      "جمله‌های ساده را می‌فهمم، اما صحبت‌کردن برایم دشوار است.",
      "مکالمه روزمره دارم و می‌خواهم دقیق‌تر و روان‌تر صحبت کنم.",
      "روان صحبت می‌کنم و برای کار، تحصیل یا آزمون آماده می‌شوم.",
    ],
    stages: [
      ["01", "آغاز مسیر", "پایه‌های انگلیسی", "A0 - A1", "۲ تا ۳ ماه", "الفبا، تلفظ پایه، واژه‌های روزمره و ساختن نخستین جمله‌ها را یاد بگیرید.", ["الفبا و صداها", "واژگان ضروری", "جمله‌های کوتاه"]],
      ["02", "ساختن اعتمادبه‌نفس", "انگلیسی مقدماتی", "A2", "۳ تا ۴ ماه", "گرامر پایه را تثبیت کنید و درباره زندگی روزمره با اعتمادبه‌نفس صحبت کنید.", ["گرامر کاربردی", "شنیدن مکالمات", "صحبت روزمره"]],
      ["03", "گسترش مهارت‌ها", "مکالمه و ارتباط", "B1 - B2", "۴ تا ۶ ماه", "دایره لغات، شنیدن و مکالمه را برای ارتباط روان در موقعیت‌های واقعی تقویت کنید.", ["مکالمه روان", "درک شنیداری", "نوشتن هدفمند"]],
      ["04", "رسیدن به هدف", "انگلیسی پیشرفته", "C1 - C2", "۶ ماه و بیشتر", "برای محیط حرفه‌ای، تحصیلات عالی و آزمون‌های بین‌المللی آماده شوید.", ["ارتباط حرفه‌ای", "تفکر به انگلیسی", "آمادگی آزمون"]],
    ],
    stageDetails: [
      {
        topics: ["حروف، صداها و تلفظ پایه", "ضمیرها، فعل be و ساخت جمله", "اعداد، ساعت، خانواده و کارهای روزمره", "پرسش و پاسخ‌های بسیار ساده"],
        practice: "روزانه ۱۰ واژه را با صدای بلند تکرار کنید و پنج جمله کوتاه درباره خودتان بسازید.",
        checkpoint: "می‌توانید خود را معرفی کنید، معلومات ساده بدهید و پرسش‌های کوتاه را بفهمید.",
      },
      {
        topics: ["زمان حال، گذشته و آینده ساده", "افعال پرکاربرد و صفت‌ها", "خرید، سفر، صحت و محیط کار", "شنیدن مکالمه‌های کوتاه"],
        practice: "هر هفته یک گفت‌وگوی دو دقیقه‌ای ضبط کنید و یک متن ۸۰ کلمه‌ای بنویسید.",
        checkpoint: "می‌توانید درباره زندگی روزمره پیوسته صحبت کنید و پیام‌ها و مکالمه‌های ساده را بفهمید.",
      },
      {
        topics: ["زمان‌های کامل و جمله‌های شرطی", "افعال عبارتی و ترکیب‌های طبیعی", "بحث، ارائه و بیان نظر", "خواندن و نوشتن متن‌های هدفمند"],
        practice: "دو بار در هفته مکالمه ۱۰ دقیقه‌ای داشته باشید و خلاصه یک پادکست یا مقاله را بنویسید.",
        checkpoint: "می‌توانید بدون آمادگی طولانی گفتگو کنید، نظر خود را توضیح دهید و محتوای عمومی را دنبال کنید.",
      },
      {
        topics: ["واژگان آکادمیک و حرفه‌ای", "لحن، ظرافت معنا و اصطلاحات", "ارائه، مصاحبه و مذاکره", "راهبردهای آزمون IELTS یا TOEFL"],
        practice: "هر هفته یک ارائه یا مقاله کامل آماده کنید و بازخورد دقیق تلفظ و نوشتار بگیرید.",
        checkpoint: "می‌توانید مطالب پیچیده را درک کنید و در محیط تحصیلی یا کاری دقیق، روان و طبیعی ارتباط بگیرید.",
      },
    ],
  },
  en: {
    eyebrow: "Learning roadmap", allRoadmaps: "All roadmaps", title: "Your clear path to English fluency",
    intro: "Stop choosing courses at random. Begin at your current level and move forward one practical step at a time.",
    start: "Find my starting point", courses: "Browse all courses",
    finderTitle: "Where should I begin?", finderText: "Choose the statement that best describes your English today.",
    recommended: "Your recommended start", pathTitle: "English learning roadmap",
    pathText: "Complete each stage in order. Matching courses from the current catalog appear within each stage.",
    available: "recommended course", availablePlural: "recommended courses", viewCourse: "Course details",
    viewLevel: "Explore this stage", loading: "Finding suitable courses...",
    noMatch: "A new course for this stage is coming soon.", duration: "Suggested time",
    showDetails: "Stage details", hideDetails: "Hide details",
    topicsTitle: "Core topics", practiceTitle: "Suggested practice", checkpointTitle: "You are ready to move on when...",
    selectionTitle: "How should I choose the right course?",
    selectionText: "Course selection follows the English subject category and the level chosen by the teacher when creating the course.",
    selectionSteps: [
      ["Identify your current level", "Use the level finder above to choose the stage closest to your ability today."],
      ["Choose a course at that level", "Compare beginner, intermediate, or advanced courses matched to the stage."],
      ["Progress by the checkpoint", "Complete the practice and meet the readiness checkpoint before moving forward."],
    ],
    habitTitle: "A simple weekly routine", habitText: "Keep these four habits alongside your course to make steady progress.",
    habits: [["3 sessions", "Lessons and grammar"], ["20 min daily", "English listening"], ["2 practices", "Speaking and pronunciation"], ["1 review", "Weekly vocabulary"]],
    ctaTitle: "Ready to begin?", ctaText: "Choose the right level and see the first course in your learning path.",
    cta: "Choose my first course", soon: "More languages soon", english: "English",
    choices: [
      "I am completely new and do not know the alphabet or simple sentences.",
      "I understand simple sentences, but speaking is still difficult.",
      "I can handle daily conversations and want to speak more accurately and fluently.",
      "I speak confidently and am preparing for work, study, or an exam.",
    ],
    stages: [
      ["01", "Start here", "English foundations", "A0 - A1", "2 to 3 months", "Learn the alphabet, core sounds, everyday words, and how to build your first sentences.", ["Alphabet and sounds", "Essential vocabulary", "Short sentences"]],
      ["02", "Build confidence", "Elementary English", "A2", "3 to 4 months", "Strengthen basic grammar and speak confidently about familiar, everyday topics.", ["Practical grammar", "Listening basics", "Daily conversation"]],
      ["03", "Expand your skills", "Conversation and communication", "B1 - B2", "4 to 6 months", "Grow your vocabulary, listening, and speaking for fluid communication in real situations.", ["Fluent conversation", "Listening comprehension", "Purposeful writing"]],
      ["04", "Reach your goal", "Advanced English", "C1 - C2", "6+ months", "Prepare for professional settings, higher education, and international exams.", ["Professional English", "Thinking in English", "Exam preparation"]],
    ],
    stageDetails: [
      {
        topics: ["Letters, sounds, and basic pronunciation", "Pronouns, the verb be, and sentence building", "Numbers, time, family, and daily routines", "Very simple questions and answers"],
        practice: "Repeat 10 words aloud each day and build five short sentences about yourself.",
        checkpoint: "You can introduce yourself, share basic information, and understand short questions.",
      },
      {
        topics: ["Simple present, past, and future", "Common verbs and descriptive language", "Shopping, travel, health, and work", "Listening to short conversations"],
        practice: "Record one two-minute conversation and write one 80-word text each week.",
        checkpoint: "You can speak continuously about daily life and understand simple messages and conversations.",
      },
      {
        topics: ["Perfect tenses and conditionals", "Phrasal verbs and natural collocations", "Discussion, presentation, and opinions", "Purposeful reading and writing"],
        practice: "Have two 10-minute conversations each week and summarize a podcast or article.",
        checkpoint: "You can converse without long preparation, explain opinions, and follow general English content.",
      },
      {
        topics: ["Academic and professional vocabulary", "Tone, nuance, and idiomatic language", "Presentations, interviews, and negotiation", "IELTS or TOEFL strategies"],
        practice: "Prepare one complete presentation or essay each week and get focused feedback on pronunciation and writing.",
        checkpoint: "You can understand complex material and communicate precisely and naturally in academic or professional settings.",
      },
    ],
  },
};

const normalize = (value) => String(value || "").trim().toLowerCase();
const isEnglishText = (value) => ENGLISH_TERMS.some((term) => normalize(value).includes(term));

function getStageIndexes(course) {
  const level = normalize(course?.level);
  if (level === "advanced") return [3];
  if (level === "intermediate") return [2];
  return [0, 1];
}

export default function EnglishRoadmapPage({ language = "fa" }) {
  const page = translations[language === "fa" ? "fa" : "en"];
  const DirectionArrow = language === "fa" ? ArrowLeft : ArrowRight;
  const [selectedStage, setSelectedStage] = useState(0);
  const [expandedStages, setExpandedStages] = useState(() => new Set([0]));
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCourses() {
      try {
        const [result, categories] = await Promise.all([
          fetchPublishedCourses({ page: 1, limit: 100, sortBy: "popular", sortOrder: "desc" }),
          fetchPublicCategories().catch(() => []),
        ]);
        if (cancelled) return;
        const rows = Array.isArray(categories) ? categories : [];
        const englishIds = new Set(rows.filter((item) => isEnglishText(item?.name)).map((item) => String(item?._id || item?.id || "")));
        let changed = true;
        while (changed) {
          changed = false;
          rows.forEach((item) => {
            const parentId = String(item?.parent?._id || item?.parent || "");
            const id = String(item?._id || item?.id || "");
            if (englishIds.has(parentId) && !englishIds.has(id)) { englishIds.add(id); changed = true; }
          });
        }
        const courseRows = Array.isArray(result?.courses) ? result.courses : [];
        setCourses(courseRows.filter((course) => {
          const categoryId = String(course?.categoryId || course?.category?._id || "");
          const subcategoryId = String(course?.subcategoryId || course?.subcategory?._id || "");
          return englishIds.has(categoryId) || englishIds.has(subcategoryId);
        }));
      } catch { if (!cancelled) setCourses([]); }
      finally { if (!cancelled) setLoading(false); }
    }
    loadCourses();
    return () => { cancelled = true; };
  }, []);

  const coursesByStage = useMemo(() => {
    const grouped = [[], [], [], []];
    courses.forEach((course) => {
      getStageIndexes(course).forEach((stageIndex) => grouped[stageIndex].push(course));
    });
    return grouped;
  }, [courses]);

  const chooseStage = (index) => {
    setSelectedStage(index);
    setExpandedStages((previous) => new Set(previous).add(index));
    window.setTimeout(() => document.getElementById(`roadmap-stage-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
  };

  const toggleStageDetails = (index) => {
    setExpandedStages((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-10 pt-8 text-slate-950">
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6 lg:px-8">
      <section className="relative isolate min-h-[400px] overflow-hidden rounded-3xl bg-slate-950 sm:min-h-[420px]">
        <img src="/hero-student.png" alt="" className="absolute inset-0 h-full w-full object-cover object-[62%_center] opacity-75 sm:object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/20 rtl:bg-gradient-to-l" />
        <div className="relative mx-auto flex min-h-[400px] max-w-[1340px] items-center px-5 py-12 sm:min-h-[420px] sm:px-8 lg:px-12">
          <div className="max-w-2xl text-white">
            <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link to="/roadmaps" className="inline-flex items-center gap-2 text-xs font-black text-slate-200 transition hover:text-white">
                <LayoutGrid size={16} />{page.allRoadmaps}
              </Link>
              <span className="inline-flex items-center gap-2 text-sm font-black text-teal-300"><Route size={18} />{page.eyebrow}</span>
            </div>
            <h1 className="max-w-xl text-4xl font-black leading-[1.25] sm:text-5xl lg:text-6xl">{page.title}</h1>
            <p className="mt-5 max-w-xl text-base font-medium leading-8 text-slate-200 sm:text-lg">{page.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => document.getElementById("level-finder")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="inline-flex h-12 items-center gap-2 rounded-lg bg-teal-500 px-5 text-sm font-black text-white transition hover:bg-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-300/40">
                {page.start}<ChevronDown size={17} />
              </button>
              <Link to={buildEnglishCatalogPath()} className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/35 bg-white/10 px-5 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/20">
                {page.courses}<DirectionArrow size={17} />
              </Link>
            </div>
          </div>
        </div>
      </section>
      </div>

      <section id="level-finder" className="scroll-mt-24 border-b border-slate-200 py-10 sm:py-14">
        <div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                <span className="inline-flex h-9 items-center gap-2 rounded-md bg-primary-600 px-4 text-xs font-black text-white"><span className="text-base">EN</span>{page.english}</span>
                <span className="px-3 text-xs font-bold text-slate-400">{page.soon}</span>
              </div>
              <h2 className="text-2xl font-black sm:text-3xl">{page.finderTitle}</h2>
              <p className="mt-2 text-sm font-medium leading-7 text-slate-600 sm:text-base">{page.finderText}</p>
            </div>
            <div className="inline-flex items-center gap-3 border-s-4 border-teal-500 ps-4">
              <div><p className="text-xs font-black text-slate-500">{page.recommended}</p><p className="mt-1 text-lg font-black text-primary-700">{page.stages[selectedStage][2]}</p></div>
              <span className="rounded-md bg-primary-50 px-3 py-2 text-sm font-black text-primary-700">{page.stages[selectedStage][3]}</span>
            </div>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {page.choices.map((choice, index) => (
              <button key={choice} type="button" onClick={() => chooseStage(index)} className={`flex min-h-20 items-start gap-3 rounded-lg border p-4 text-start text-sm font-bold leading-6 transition focus:outline-none focus:ring-4 focus:ring-primary-100 ${selectedStage === index ? "border-primary-500 bg-primary-50 text-primary-900 shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-primary-200"}`}>
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${selectedStage === index ? "border-primary-600 bg-primary-600 text-white" : "border-slate-300 text-transparent"}`}><Check size={14} strokeWidth={3} /></span>{choice}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl"><p className="text-sm font-black text-teal-700">{page.eyebrow}</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">{page.pathTitle}</h2><p className="mt-3 text-base font-medium leading-8 text-slate-600">{page.pathText}</p></div>
          <div className="relative mt-10 space-y-6 before:absolute before:bottom-8 before:start-[27px] before:top-8 before:w-px before:bg-slate-200 sm:before:start-[39px]">
            {page.stages.map(([number, label, title, level, duration, description, skills], index) => {
              const Icon = stageIcons[index];
              const stageCourses = coursesByStage[index].slice(0, 2);
              const selected = selectedStage === index;
              const details = page.stageDetails[index];
              const detailsExpanded = expandedStages.has(index);
              return (
                <article id={`roadmap-stage-${index}`} key={number} className="relative grid grid-cols-[56px_minmax(0,1fr)] gap-4 scroll-mt-32 sm:grid-cols-[80px_minmax(0,1fr)] sm:gap-6">
                  <div className={`relative z-10 grid h-14 w-14 place-items-center rounded-lg border-4 border-white shadow-sm sm:h-20 sm:w-20 ${selected ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600"}`}><Icon size={26} /></div>
                  <div className={`overflow-hidden rounded-lg border bg-white ${selected ? "border-primary-300 shadow-soft" : "border-slate-200"}`}>
                    <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_220px]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black text-teal-700">{number} · {label}</span><span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{level}</span></div>
                        <h3 className="mt-3 text-xl font-black sm:text-2xl">{title}</h3><p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-600">{description}</p>
                        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">{skills.map((skill) => <span key={skill} className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 sm:text-sm"><Check size={15} className="text-teal-600" strokeWidth={3} />{skill}</span>)}</div>
                        <button
                          type="button"
                          onClick={() => toggleStageDetails(index)}
                          aria-expanded={detailsExpanded}
                          className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700 transition hover:border-primary-200 hover:text-primary-700"
                        >
                          {detailsExpanded ? page.hideDetails : page.showDetails}
                          {detailsExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>
                      <div className="border-t border-slate-100 pt-5 lg:border-s lg:border-t-0 lg:ps-6 lg:pt-0">
                        <p className="text-xs font-black text-slate-500">{page.duration}</p><p className="mt-2 inline-flex items-center gap-2 text-sm font-black"><Clock3 size={16} className="text-primary-600" />{duration}</p>
                        <p className="mt-5 text-xs font-black text-slate-500">{stageCourses.length} {stageCourses.length === 1 ? page.available : page.availablePlural}</p>
                      </div>
                    </div>
                    {detailsExpanded ? (
                      <div className="grid gap-px border-t border-slate-200 bg-slate-200 md:grid-cols-3">
                        <div className="bg-white p-5 sm:p-6">
                          <p className="text-xs font-black text-primary-700">{page.topicsTitle}</p>
                          <ul className="mt-3 space-y-2.5">
                            {details.topics.map((topic) => (
                              <li key={topic} className="flex items-start gap-2 text-xs font-bold leading-5 text-slate-700 sm:text-sm">
                                <Check size={14} className="mt-0.5 shrink-0 text-teal-600" strokeWidth={3} />
                                {topic}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-white p-5 sm:p-6">
                          <p className="text-xs font-black text-primary-700">{page.practiceTitle}</p>
                          <p className="mt-3 text-sm font-medium leading-7 text-slate-600">{details.practice}</p>
                        </div>
                        <div className="bg-teal-50 p-5 sm:p-6">
                          <p className="text-xs font-black text-teal-800">{page.checkpointTitle}</p>
                          <p className="mt-3 text-sm font-bold leading-7 text-teal-950">{details.checkpoint}</p>
                        </div>
                      </div>
                    ) : null}
                    <div className="border-t border-slate-100 bg-slate-50 p-4 sm:px-7 sm:py-5">
                      {loading ? <p className="text-sm font-bold text-slate-500">{page.loading}</p> : stageCourses.length ? (
                        <><div className="grid gap-3 lg:grid-cols-2">{stageCourses.map((course) => (
                          <Link key={course._id || course.id} to={buildCoursePath(course)} className="group flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-primary-300 hover:shadow-sm">
                            <div className="h-14 w-16 shrink-0 overflow-hidden rounded-md bg-primary-50">{course.thumbnail ? <img src={course.thumbnail} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-primary-600"><BookOpen size={21} /></span>}</div>
                            <div className="min-w-0 flex-1"><p className="truncate text-sm font-black group-hover:text-primary-700">{course.title}</p><p className="mt-1 text-xs font-bold text-slate-500">{page.viewCourse}</p></div><DirectionArrow size={17} className="shrink-0 text-slate-400 group-hover:text-primary-600" />
                          </Link>
                        ))}</div><Link to={buildEnglishCatalogPath(index)} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-primary-700 hover:text-primary-600">{page.viewLevel}<DirectionArrow size={16} /></Link></>
                      ) : <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold text-slate-500">{page.noMatch}</p><Link to={buildEnglishCatalogPath(index)} className="inline-flex items-center gap-2 text-sm font-black text-primary-700 hover:text-primary-600">{page.viewLevel}<DirectionArrow size={16} /></Link></div>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 py-12 sm:py-14">
        <div className="mx-auto grid max-w-[1340px] gap-8 px-4 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-8">
          <div>
            <p className="text-sm font-black text-teal-700">{page.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{page.selectionTitle}</h2>
            <p className="mt-3 text-sm font-medium leading-7 text-slate-600">{page.selectionText}</p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 md:grid-cols-3">
            {page.selectionSteps.map(([title, text], index) => (
              <div key={title} className="bg-white p-5 sm:p-6">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-primary-50 text-sm font-black text-primary-700">{index + 1}</span>
                <h3 className="mt-4 text-sm font-black text-slate-950">{title}</h3>
                <p className="mt-2 text-xs font-medium leading-6 text-slate-600 sm:text-sm">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-12 sm:py-14">
        <div className="mx-auto grid max-w-[1340px] gap-8 px-4 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-center lg:px-8">
          <div><div className="grid h-11 w-11 place-items-center rounded-lg bg-teal-100 text-teal-700"><Sparkles size={22} /></div><h2 className="mt-4 text-2xl font-black sm:text-3xl">{page.habitTitle}</h2><p className="mt-3 text-sm font-medium leading-7 text-slate-600">{page.habitText}</p></div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-4">
            {page.habits.map(([value, label], index) => { const HabitIcon = [BookOpen, Headphones, Mic2, Check][index]; return <div key={label} className="min-h-36 bg-white p-4 sm:p-5"><HabitIcon size={21} className="text-primary-600" /><p className="mt-5 text-base font-black">{value}</p><p className="mt-1 text-xs font-bold leading-5 text-slate-500">{label}</p></div>; })}
          </div>
        </div>
      </section>

      <div className="mx-auto mt-8 max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <section className="rounded-3xl bg-primary-700 py-10 text-white sm:py-12"><div className="mx-auto flex max-w-[1340px] flex-col gap-6 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12"><div><h2 className="text-2xl font-black sm:text-3xl">{page.ctaTitle}</h2><p className="mt-2 text-sm font-medium leading-7 text-blue-100 sm:text-base">{page.ctaText}</p></div><Link to={buildEnglishCatalogPath(selectedStage)} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-white px-5 text-sm font-black text-primary-700 transition hover:bg-teal-50 lg:self-auto">{page.cta}<DirectionArrow size={17} /></Link></div></section>
      </div>
    </div>
  );
}
