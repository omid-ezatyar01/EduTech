import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Radio,
  Send,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import CourseCard from "../components/CourseCard.jsx";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";
import SectionTitle from "../components/SectionTitle.jsx";
import {
  fetchPublicPlatformStats,
  fetchPublishedCourses,
  fetchStudentEnrollments,
} from "../../services/courseService.js";

const EXCLUDED_ENROLLMENT_STATUSES = new Set(["cancelled", "canceled", "failed", "rejected", "refunded"]);

const hasActiveEnrollmentAccess = (row = {}) => {
  const status = String(row?.enrollmentStatus || "").toLowerCase();
  if (EXCLUDED_ENROLLMENT_STATUSES.has(status)) return false;
  if (!["active", "completed"].includes(status)) return false;
  if (String(row?.accessStatus || "").toLowerCase() !== "allowed") return false;
  if (!row?.accessExpiresAt) return true;
  const expiresAt = new Date(row.accessExpiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt > new Date();
};

const buildEnrolledCourseIdSet = (rows = []) => {
  const ids = new Set();
  rows.forEach((row) => {
    if (!hasActiveEnrollmentAccess(row)) return;

    const course = row?.courseId;
    const courseId =
      typeof course === "object"
        ? course?._id || course?.id
        : course;

    if (courseId) ids.add(String(courseId));
  });
  return ids;
};

export default function HomePage({ language, t }) {
  const dir = t.meta.dir;
  const isRTL = dir === "rtl";
  const [featuredCourses, setFeaturedCourses] = useState([]);
  const [loadingFeaturedCourses, setLoadingFeaturedCourses] = useState(true);
  const [platformStats, setPlatformStats] = useState({
    activeCourses: 0,
    expertTeachers: 0,
    happyStudents: 0,
  });
  const [enrolledCourseIds, setEnrolledCourseIds] = useState(() => new Set());
  const noCoursesText =
    language === "fa"
      ? "در حال حاضر هیچ کورسی موجود نیست."
      : "There are no available courses right now.";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const loadEnrollments = useCallback(async (mountedRef) => {
    if (localStorage.getItem("edutech_auth") !== "true") {
      if (!mountedRef || mountedRef.current) {
        setEnrolledCourseIds(new Set());
      }
      return;
    }

    try {
      const rows = await fetchStudentEnrollments();
      if (mountedRef && !mountedRef.current) return;
      setEnrolledCourseIds(buildEnrolledCourseIdSet(rows));
    } catch {
      if (mountedRef && !mountedRef.current) return;
      setEnrolledCourseIds(new Set());
    }
  }, []);

  useEffect(() => {
    const mountedRef = { current: true };

    const loadHomeData = async () => {
      try {
        setLoadingFeaturedCourses(true);
        const [coursesResult, statsResult] = await Promise.all([
          fetchPublishedCourses({ page: 1, limit: 6, sortBy: "popular" }),
          fetchPublicPlatformStats(),
        ]);

        if (!mountedRef.current) return;

        setFeaturedCourses(Array.isArray(coursesResult?.courses) ? coursesResult.courses : []);
        setPlatformStats({
          activeCourses: Number(statsResult?.activeCourses || 0),
          expertTeachers: Number(statsResult?.expertTeachers || 0),
          happyStudents: Number(statsResult?.happyStudents || 0),
        });
      } catch {
        if (!mountedRef.current) return;
        setFeaturedCourses([]);
        setPlatformStats({
          activeCourses: 0,
          expertTeachers: 0,
          happyStudents: 0,
        });
      } finally {
        if (mountedRef.current) {
          setLoadingFeaturedCourses(false);
        }
      }
    };

    loadHomeData();
    loadEnrollments(mountedRef);

    const handleEnrollmentRefresh = () => {
      loadEnrollments(mountedRef);
    };

    window.addEventListener("auth_change", handleEnrollmentRefresh);
    window.addEventListener("edutech_data_changed", handleEnrollmentRefresh);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("auth_change", handleEnrollmentRefresh);
      window.removeEventListener("edutech_data_changed", handleEnrollmentRefresh);
    };
  }, [loadEnrollments]);

  const numberFormatter = new Intl.NumberFormat(language === "fa" ? "fa-AF" : "en-US", {
    maximumFractionDigits: 0,
  });

  const homeStats = [
    {
      key: "activeCourses",
      label: language === "fa" ? "کورس فعال" : "Active Courses",
      value: numberFormatter.format(Math.max(0, Math.round(platformStats.activeCourses))),
    },
    {
      key: "expertTeachers",
      label: language === "fa" ? "مدرسان متخصص" : "Expert Teachers",
      value: numberFormatter.format(Math.max(0, Math.round(platformStats.expertTeachers))),
    },
    {
      key: "happyStudents",
      label: language === "fa" ? "شاگردان" : "Students",
      value: numberFormatter.format(Math.max(0, Math.round(platformStats.happyStudents))),
    },
  ];

  return (
    <>
      <section
        id="home"
        className="relative overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FBFF_100%)]"
      >
        <div className="absolute inset-x-0 bottom-0 h-28 bg-white" />

        <div
          className="relative mx-auto grid max-w-[1536px] items-center gap-10 px-4 pb-10 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[0.52fr_0.48fr] lg:px-8 lg:pb-0 lg:pt-0"
          dir="ltr"
        >
          {/* TEXT SIDE */}
          <div
            className={`relative z-10 w-full max-w-[620px] pb-6 text-center lg:mx-0 lg:py-20 ${
              isRTL
                ? "mx-auto lg:order-2 lg:justify-self-end"
                : "mx-auto lg:order-1 lg:justify-self-start"
            }`}
            dir={dir}
          >
            <div
              className={`inline-flex items-center gap-2 rounded-full border border-slate-100 bg-white px-5 py-2 text-sm font-bold text-primary-600 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ${
                isRTL ? "flex-row-reverse" : ""
              }`}
            >
              <Radio size={16} />
              {t.hero.badge}
            </div>

            <h1 className="mx-auto mt-7 max-w-3xl whitespace-pre-line text-4xl font-black leading-[1.4] lg:leading-[1.55] tracking-tight text-slate-950 sm:text-[2.75rem] lg:text-[3.25rem]">
              {language === "fa" ? (
                <>
                  <span className="text-teal-500">{t.hero.titleBefore}</span>{" "}
                  {t.hero.titleAfter}
                </>
              ) : (
                <>
                  <span className="text-teal-500">{t.hero.titleBefore}</span>
                  {"\n"}
                  {t.hero.titleAfter}
                </>
              )}
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
              {t.hero.subtitle}
            </p>

            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row sm:items-center">
              <Link
                className="inline-flex h-14 items-center justify-center gap-3 rounded-lg bg-primary-600 px-7 text-base font-extrabold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-100"
                to="/live-courses"
                dir={dir}
              >
                <span>{t.hero.primary}</span>
                <ArrowUpRight size={19} />
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {t.hero.features.map((feature) => {
                return (
                  <div
                    className={`inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-full border border-slate-100 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)] ${
                      isRTL ? "flex-row-reverse" : ""
                    }`}
                    key={feature}
                  >
                    <span className="text-center leading-6">{feature}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* IMAGE SIDE */}
          <div
            className={`relative z-10 w-full max-w-[760px] self-center lg:mx-0 lg:max-w-none ${
              isRTL
                ? "mx-auto lg:order-1 lg:justify-self-start"
                : "mx-auto lg:order-2 lg:justify-self-end"
            }`}
          >
            <div
              className={`absolute -bottom-2 h-[45%] w-[34%] rounded-[42%_58%_48%_52%/54%_42%_58%_46%] bg-teal-500/90 blur-[1px] ${
                isRTL ? "right-7" : "left-7"
              }`}
            />

            <div
              className={`absolute top-12 h-[78%] w-[44%] bg-gradient-to-br from-primary-300 to-primary-600 ${
                isRTL ? "left-0" : "right-0"
              }`}
            />

            <div className="relative overflow-hidden bg-transparent lg:min-h-[498px]">
              <img
                className="relative z-10 h-full min-h-[300px] w-full object-cover object-center lg:min-h-[498px]"
                src="/hero-student.png"
                alt={t.hero.visualTitle}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 bg-white pb-3 pt-8 md:pt-10" dir={dir}>
        <div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[28px] bg-white p-6 sm:p-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {homeStats.map((stat) => (
                <div
                  key={stat.key}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-5 text-center shadow-sm"
                >
                  <p className="text-3xl font-black text-primary-700 sm:text-4xl">{stat.value}</p>
                  <p className="mt-2 text-sm font-bold text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="courses"
        className="relative z-20 -mt-1 rounded-t-[24px] bg-white py-8 md:py-10"
        dir={dir}
      >
        <div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8">
          <div className="relative mb-8 text-center md:mb-10">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-amber-700">
              <Sparkles size={15} />
              {language === "fa" ? "کورس‌های برتر" : "Top Courses"}
            </span>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-[2rem]">
              {t.coursesSection.title}
            </h2>

            <p className="mx-auto mt-4 max-w-2xl leading-8 text-slate-600">
              {t.coursesSection.subtitle}
            </p>
          </div>

          {loadingFeaturedCourses ? (
            <FrontendPageLoader
              label={language === "fa" ? "در حال بارگذاری کورس‌ها" : "Loading courses"}
              minHeight="min-h-[220px]"
            />
          ) : featuredCourses.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <p className="text-base font-bold text-slate-600">{noCoursesText}</p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {featuredCourses.map((course, index) => (
                <div key={course._id || course.id || `${course.title}-${index}`}>
                  <CourseCard
                    course={course}
                    dir={dir}
                    index={index}
                    labels={t.courseLabels}
                    language={language}
                    isEnrolled={enrolledCourseIds.has(String(course?._id || course?.id || ""))}
                  />
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      <section id="about" className="bg-white py-20" dir={dir}>
        <div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8">
          <SectionTitle title={t.why.title} subtitle={t.why.subtitle} />

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {t.why.benefits.map((benefit) => {
              return (
                <article
                  className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-card"
                  key={benefit.title}
                >
                  <h3 className="text-lg font-black text-slate-950">
                    {benefit.title}
                  </h3>

                  <p className="mt-3 leading-7 text-slate-600">
                    {benefit.text}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white pb-14 md:pb-20" dir={dir}>
        <div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-primary-700 via-primary-600 to-teal-500 px-5 py-8 text-white shadow-hero sm:px-10 sm:py-12 lg:px-14">
            <div className="absolute inset-y-0 end-0 w-1/2 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]" />

            <div className="relative z-10 flex flex-col gap-5 sm:gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
              <div className="max-w-2xl">
                <div
                  className={`mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold ${
                    isRTL ? "flex-row-reverse" : ""
                  }`}
                >
                  <Sparkles size={16} />
                  {language === "fa" ? "ایجوتک" : "EduTech"}
                </div>

                <h2 className="text-2xl font-black leading-tight sm:text-3xl md:text-4xl">
                  {t.cta.title}
                </h2>

                <p className="mt-3 text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
                  {t.cta.text}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  className={`inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-primary-700 transition hover:-translate-y-0.5 sm:px-6 sm:py-4 sm:text-base ${
                    isRTL ? "flex-row-reverse" : ""
                  }`}
                  to="/live-courses"
                >
                  <BadgeCheck size={19} />
                  {t.cta.primary}
                </Link>

                <Link
                  className={`inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 sm:px-6 sm:py-4 sm:text-base ${
                    isRTL ? "flex-row-reverse" : ""
                  }`}
                  to="/contact"
                >
                  <Send size={18} />
                  {t.cta.secondary}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
