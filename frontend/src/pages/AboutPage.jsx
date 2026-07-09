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
} from "lucide-react";
import { fetchPublicPlatformStats } from "../../services/courseService.js";

const pageData = {
  fa: {
    breadcrumbs: ["خانه", "درباره ما"],
    hero: {
      title: "درباره ایجوتک",
      subtitle: "با یادگیری آنلاین، مهارت واقعی، آینده بهتر",
      description:
        "ایجوتک یک پلتفرم آموزشی آنلاین است که شاگردان را در کورس‌های آنلاین و تعاملی با استادان متخصص وصل می‌کند. هدف ما این است که آموزش آنلاین را ساده، عملی، قابل اعتماد و نزدیک به نیازهای واقعی شاگردان بسازیم.",
      btn: "مشاهده کورس‌های آنلاین",
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
      title: "About EduTech",
      subtitle: "Live learning, real skills, better future",
      description:
        "EduTech is an online education platform that connects students with expert instructors through live and interactive classes. Our goal is to make online learning simple, practical, reliable, and connected to real student needs.",
      btn: "View Live Courses",
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
  const logoSrc = isFa ? "/logo.png" : "/logo-en.png";
  const [platformStats, setPlatformStats] = useState({
    activeCourses: 0,
    expertTeachers: 0,
    happyStudents: 0,
    satisfactionRate: 0,
  });

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
        setPlatformStats({
          activeCourses: 0,
          expertTeachers: 0,
          happyStudents: 0,
          satisfactionRate: 0,
        });
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
        const rawValue = Number(platformStats?.[stat.key] || 0);
        const numeric = Math.max(0, Math.round(rawValue));
        const renderedValue =
          stat.key === "satisfactionRate"
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

  return (
    <div
      className="min-h-screen bg-slate-50 pb-10 pt-8 font-sans text-slate-900"
      dir={dir}
    >
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_12px_35px_rgba(15,23,42,0.03)] lg:p-16">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-teal-50/60 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-primary-50/60 blur-3xl" />
          <div className="relative z-10 grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h1 className="text-4xl font-black text-slate-950 md:text-5xl lg:text-6xl">
                {data.hero.title.replace(isFa ? "ایجوتک" : "EduTech", "")}{" "}
                <span className="text-teal-500">
                  {isFa ? "ایجوتک" : "EduTech"}
                </span>
              </h1>
              <p className="mt-4 text-xl font-black text-primary-600">
                {data.hero.subtitle}
              </p>
              <p className="mt-6 text-lg font-medium leading-8 text-slate-600">
                {data.hero.description}
              </p>
            </div>
            <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-sm lg:min-h-[420px]">
              <img
                src={logoSrc}
                alt={isFa ? "لوگوی ایجوتک" : "EduTech logo"}
                className="h-auto max-h-[260px] w-full max-w-[520px] object-contain lg:max-h-[340px]"
              />
            </div>
          </div>
        </section>

        {/* Why EduTech */}
        <section className="mt-16">
          <h2 className="mb-8 text-center text-3xl font-black text-slate-950">
            {data.why.title}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {data.why.cards.map((card, idx) => {
              const Icon = whyIcons[idx];
              return (
                <div
                  className="flex flex-col items-center text-center rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary-100 hover:shadow-md"
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

        {/* Stats */}
        <section className="mt-16 rounded-[32px] border border-slate-200 bg-white py-12 shadow-sm">
          <div className="grid grid-cols-2 gap-8 divide-slate-100 md:grid-cols-4 md:divide-x md:divide-x-reverse">
            {resolvedStats.map((stat, idx) => (
              <div className="text-center px-4" key={idx}>
                <p className="text-4xl font-black text-primary-700">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Mission & Vision & Values */}
        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {[data.mission, data.vision].map((item, idx) => (
              <div
                className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm"
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
          <div className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm">
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

        {/* Team Section */}
        <section className="mt-16 mb-12 text-center">
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
      </div>

    </div>
  );
}
