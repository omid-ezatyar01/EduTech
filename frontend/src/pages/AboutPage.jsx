import { useEffect, useMemo, useState } from "react";
import {
  Award,
  MonitorPlay,
  CheckCircle2,
  Headphones,
  FileBadge,
  Wrench,
  Heart,
  TrendingUp,
  Lightbulb,
  UserRound,
  ArrowUpRight,
  BookOpen,
  PlayCircle,
  Route,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router";
import { fetchPublicPlatformStats } from "../../services/courseService.js";

const pageData = {
  fa: {
    breadcrumbs: ["خانه", "درباره ما"],
    hero: {
      eyebrow: "آکادمی آنلاین ایجوتک",
      title: "درباره ایجوتک",
      subtitle: "با یادگیری آنلاین، مهارت واقعی، آینده بهتر",
      description:
        "ایجوتک یک پلتفرم آموزشی آنلاین است که شاگردان را در کورس‌های آنلاین و تعاملی با استادان متخصص وصل می‌کند. هدف ما این است که آموزش آنلاین را ساده، عملی، قابل اعتماد و نزدیک به نیازهای واقعی شاگردان بسازیم.",
      btn: "مشاهده کورس‌های آنلاین",
      secondaryBtn: "آشنایی با مدرسان",
    },
    why: {
      title: " چرا ایجوتک؟",
      cards: [
        {
          title: "مدرسان متخصص",
          text: "همراه با استادان مجرب و حرفه‌ای در هر زمینه",
        },
        {
          title: "کلاس‌های آنلاین و تعاملی",
          text: "یادگیری مستقیم در صنف‌های آنلاین از طریق Google Meet",
        },
        {
          title: "یادگیری موثر",
          text: "تمرین عملی، پروژه واقعی و بازخورد مستمر",
        },
        {
          title: "پشتیبانی و راهنما",
          text: "تیم پشتیبانی همیشه در کنار شما است",
        },
        {
          title: "سرتیفیکیت معتبر",
          text: "بعد از تکمیل کورس سرتیفیکیت دریافت کنید",
        },
      ],
    },
    stats: [
      { key: "activeCourses", label: "کورس فعال" },
      { key: "expertTeachers", label: "مدرسان متخصص" },
      { key: "happyStudents", label: "شاگردان" },
      { key: "satisfactionRate", label: "رضایت شاگردان" },
    ],
    mission: {
      title: "ماموریت ما",
      text: "ارائه آموزش‌های آنلاین، با کیفیت و دسترس‌پذیر برای توانمندسازی افراد و ساختن آینده‌ای بهتر.",
    },
    vision: {
      title: "چشم‌انداز ما",
      text: "تبدیل شدن به معتبرترین پلتفرم آموزشی آنلاین برای یادگیری مهارت‌های کاربردی در منطقه.",
    },
    valuesTitle: "ارزش‌های ما",
    values: [
      "یادگیری عملی",
      "صداقت در آموزش",
      "رشد شاگردان",
      "نوآوری در یادگیری",
    ],
    journey: {
      title: "ایجوتک چگونه به شما کمک می‌کند؟",
      text: "از انتخاب مسیر تا تمرین و پیشرفت، ابزارها و همراهی مورد نیاز شما را یک‌جا فراهم می‌کنیم.",
      steps: [
        { title: "مسیر خود را پیدا کنید", text: "کورس، مدرس یا نقشه راه مناسب هدف خود را انتخاب کنید." },
        { title: "مستقیم یاد بگیرید", text: "در کلاس‌های آنلاین شرکت کنید و از محتوای آموزشی استفاده کنید." },
        { title: "تمرین کنید و رشد کنید", text: "با تمرین، بازخورد و پیگیری پیشرفت، مهارت واقعی بسازید." },
      ],
    },
    team: {
      title: "تیم ما",
      text: "ما یک تیم پرانرژی از مدرسان، متخصصان آموزش و توسعه‌دهندگان هستیم که برای رشد شما کار می‌کنیم.",
      members: [
        { name: "امید عزت یار", role: "مدیر عمومی", url: "https://omidezatyar.info" },
        { name: "عزت الله حیدری", role: "استاد گرافیک دیزاین" },
        { name: "علی رضایی", role: "استاد برنامه‌نویسی" },
        { name: "مهدی حسینی", role: "پشتیبانی" },
      ],
    },
    cta: {
      title: "آماده شروع یادگیری هستید؟",
      text: "در یکی از کورس‌های آنلاین ایجوتک ثبت‌نام کنید و مسیر یادگیری خود را آغاز کنید.",
      primaryBtn: "مشاهده کورس‌ها",
      secondaryBtn: "تماس با ما",
    },
  },
  en: {
    breadcrumbs: ["Home", "About Us"],
    hero: {
      eyebrow: "EduTech online academy",
      title: "About EduTech",
      subtitle: "Live learning, real skills, better future",
      description:
        "EduTech is an online education platform that connects students with expert instructors through live and interactive classes. Our goal is to make online learning simple, practical, reliable, and connected to real student needs.",
      btn: "View Live Courses",
      secondaryBtn: "Meet Our Teachers",
    },
    why: {
      title: "Why EduTech?",
      cards: [
        {
          title: "Expert Instructors",
          text: "Learn with experienced and professional instructors",
        },
        {
          title: "Live Interactive Classes",
          text: "Learn directly in live classes through Google Meet",
        },
        {
          title: "Effective Learning",
          text: "Practice, real projects, and continuous feedback",
        },
        {
          title: "Support and Guidance",
          text: "Our support team is always with you",
        },
        {
          title: "Certificate",
          text: "Receive a certificate after completing your course",
        },
      ],
    },
    stats: [
      { key: "activeCourses", label: "Active Courses" },
      { key: "expertTeachers", label: "Expert Teachers" },
      { key: "happyStudents", label: "Students" },
      { key: "satisfactionRate", label: "Student Satisfaction" },
    ],
    mission: {
      title: "Our Mission",
      text: "To provide live, high-quality, and accessible education that empowers people and helps build a better future.",
    },
    vision: {
      title: "Our Vision",
      text: "To become the most trusted online learning platform for practical skills in the region.",
    },
    valuesTitle: "Our Values",
    values: [
      "Practical Learning",
      "Honest Teaching",
      "Student Growth",
      "Learning Innovation",
    ],
    journey: {
      title: "How EduTech supports your learning",
      text: "From choosing a path to practicing and progressing, we bring the tools and guidance you need into one place.",
      steps: [
        { title: "Find your path", text: "Choose the right course, teacher, or roadmap for your goal." },
        { title: "Learn directly", text: "Join online classes and use practical educational content." },
        { title: "Practice and grow", text: "Build real skills through practice, feedback, and progress tracking." },
      ],
    },
    team: {
      title: "Our Team",
      text: "We are an energetic team of instructors, education experts, and developers working for your growth.",
      members: [
        { name: "Omid Ezatyar", role: "General Manager", url: "https://omidezatyar.info" },
        { name: "Ezatullah Haidari", role: "Graphic Design Instructor" },
        { name: "Ali Rezaei", role: "Programming Instructor" },
        { name: "Mehdi Hosseini", role: "Support" },
      ],
    },
    cta: {
      title: "Ready to start learning?",
      text: "Join one of EduTech’s live courses and start your learning journey.",
      primaryBtn: "View Courses",
      secondaryBtn: "Contact Us",
    },
  },
};

export default function AboutPage({ language = "fa" }) {
  const isFa = language === "fa";
  const dir = isFa ? "rtl" : "ltr";
  const data = pageData[language] || pageData["fa"];
  const logoSrc = "/logo.png";
  const [platformStats, setPlatformStats] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadPlatformStats = async () => {
      try {
        const stats = await fetchPublicPlatformStats();
        if (!mounted) return;
        setPlatformStats({
          activeCourses: stats.activeCourses,
          expertTeachers: stats.expertTeachers,
          happyStudents: stats.happyStudents,
          satisfactionRate: Math.min(100, Math.max(0, stats.satisfactionRate)),
        });
      } catch {
        if (!mounted) return;
        setPlatformStats(null);
      }
    };

    loadPlatformStats();

    return () => {
      mounted = false;
    };
  }, []);

  const statsFormatter = useMemo(
    () =>
      new Intl.NumberFormat(language === "fa" ? "fa-AF" : "en-US", {
        maximumFractionDigits: 0,
      }),
    [language],
  );

  const resolvedStats = useMemo(
    () =>
      data.stats.map((stat) => {
        const hasValue = platformStats && Number.isFinite(Number(platformStats?.[stat.key]));
        const rawValue = Number(platformStats?.[stat.key] || 0);
        const numeric = Math.max(0, Math.round(rawValue));
        const renderedValue = !hasValue || (stat.key === "satisfactionRate" && numeric === 0)
          ? "—"
          : stat.key === "satisfactionRate"
            ? language === "fa"
              ? `%${statsFormatter.format(numeric)}`
              : `${statsFormatter.format(numeric)}%`
            : statsFormatter.format(numeric);

        return {
          ...stat,
          value: renderedValue,
        };
      }),
    [data.stats, language, platformStats, statsFormatter],
  );

  const whyIcons = [Award, MonitorPlay, CheckCircle2, Headphones, FileBadge];
  const valueIcons = [Wrench, Heart, TrendingUp, Lightbulb];
  const journeyIcons = [Route, PlayCircle, TrendingUp];

  return (
    <div
      className="min-h-screen bg-slate-50 pb-10 pt-8 font-sans text-slate-900"
      dir={dir}
    >
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8 lg:p-12">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-teal-50/60 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-primary-50/60 blur-3xl" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div className="text-center lg:text-start">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-2 text-xs font-black text-primary-700"><Sparkles size={14} />{data.hero.eyebrow}</span>
              <h1 className="mt-5 text-3xl font-black text-slate-950 sm:text-4xl lg:text-5xl">
                {data.hero.title.replace(isFa ? "ایجوتک" : "EduTech", "")}{" "}
                <span className="text-teal-500">
                  {isFa ? "ایجوتک" : "EduTech"}
                </span>
              </h1>
              <p className="mt-3 text-lg font-black text-primary-600 sm:text-xl">
                {data.hero.subtitle}
              </p>
              <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base sm:leading-8 lg:mx-0">
                {data.hero.description}
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link to="/live-courses" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-black text-white shadow-glow transition hover:bg-primary-700">{data.hero.btn}<ArrowUpRight size={17} /></Link>
                <Link to="/teachers" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-primary-200 hover:text-primary-700"><UsersRound size={17} />{data.hero.secondaryBtn}</Link>
              </div>
            </div>
            <div className="relative flex min-h-[190px] items-center justify-center overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-white via-primary-50/50 to-teal-50 p-6 shadow-sm sm:min-h-[240px] lg:min-h-[300px]">
              <img
                src={logoSrc}
                alt={isFa ? "لوگوی ایجوتک" : "EduTech logo"}
                width="512"
                height="220"
                decoding="async"
                className="h-auto max-h-[150px] w-full max-w-[420px] object-contain sm:max-h-[190px]"
              />
            </div>
          </div>
        </section>

        <section className="mt-12 sm:mt-16">
          <h2 className="mb-8 text-center text-3xl font-black text-slate-950">
            {data.why.title}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {data.why.cards.map((card, idx) => {
              const Icon = whyIcons[idx];
              return (
                <div
                  className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:border-primary-100 hover:shadow-md"
                  key={idx}
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                    <Icon size={28} />
                  </div>
                  <h3 className="font-black text-slate-900">{card.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
                    {card.text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-12 rounded-[32px] border border-slate-200 bg-white py-8 shadow-sm sm:mt-16 sm:py-10">
          <div className="grid grid-cols-2 gap-y-8 divide-slate-100 md:grid-cols-4 md:divide-x md:divide-x-reverse">
            {resolvedStats.map((stat, idx) => (
              <div className="text-center px-4" key={idx}>
                <p className="text-3xl font-black text-primary-700 sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-6 sm:mt-16 lg:grid-cols-2">
          <div className="space-y-6">
            {[data.mission, data.vision].map((item, idx) => (
              <div
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
                key={idx}
              >
                <h3 className="text-2xl font-black text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-4 text-lg font-medium leading-8 text-slate-600">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h3 className="text-2xl font-black text-slate-950 mb-6">
              {data.valuesTitle}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {data.values.map((val, idx) => {
                const Icon = valueIcons[idx];
                return (
                  <div
                    className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 transition hover:bg-primary-50 hover:text-primary-700"
                    key={idx}
                  >
                    <Icon className="text-primary-600" size={24} />
                    <span className="font-bold text-slate-800">{val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-12 overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-primary-50/40 to-teal-50/60 p-6 text-slate-950 shadow-sm sm:mt-16 sm:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-2 text-xs font-black text-primary-700"><BookOpen size={15} />EduTech</span><h2 className="mt-4 text-2xl font-black sm:text-3xl">{data.journey.title}</h2><p className="mt-3 text-sm font-medium leading-7 text-slate-600 sm:text-base">{data.journey.text}</p></div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {data.journey.steps.map((step, index) => { const Icon = journeyIcons[index]; return <article key={step.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-md"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon size={21} /></span><span className="grid h-10 min-w-10 place-items-center rounded-xl bg-primary-50 px-2 text-xl font-black text-primary-700">{statsFormatter.format(index + 1)}</span></div><h3 className="mt-5 text-lg font-black text-slate-950">{step.title}</h3><p className="mt-2 text-sm font-medium leading-7 text-slate-600">{step.text}</p></article>; })}
          </div>
        </section>

        <section className="mb-12 mt-12 text-center sm:mt-16">
          <h2 className="text-3xl font-black text-slate-950">
            {data.team.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium leading-8 text-slate-600">
            {data.team.text}
          </p>
          <div className="mt-10 grid justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {data.team.members.map((member, idx) => (
              <div
                className="w-full max-w-[260px] rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                key={idx}
              >
                <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-primary-100 text-slate-400">
                  <UserRound size={40} />
                </div>
                <h4 className="font-black text-slate-900">
                  {member.url ? (
                    <a
                      href={member.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition hover:text-primary-700 hover:underline"
                    >
                      {member.name}
                    </a>
                  ) : (
                    member.name
                  )}
                </h4>
                <p className="mt-1 text-sm font-bold text-primary-600">
                  {member.role}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mb-8 overflow-hidden rounded-[32px] bg-gradient-to-br from-primary-700 via-primary-600 to-teal-500 p-6 text-white shadow-hero sm:p-10">
          <div className="absolute -end-20 -top-24 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl"><h2 className="text-2xl font-black sm:text-3xl">{data.cta.title}</h2><p className="mt-3 text-sm font-medium leading-7 text-white/85 sm:text-base">{data.cta.text}</p></div>
            <div className="flex flex-col gap-3 sm:flex-row"><Link to="/live-courses" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-primary-700"><BookOpen size={17} />{data.cta.primaryBtn}</Link><Link to="/contact" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/35 px-5 text-sm font-black text-white transition hover:bg-white/10">{data.cta.secondaryBtn}</Link></div>
          </div>
        </section>
      </div>

    </div>
  );
}
