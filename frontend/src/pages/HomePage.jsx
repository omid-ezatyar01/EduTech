import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Clock3,
  Eye,
  GraduationCap,
  Heart,
  LayoutDashboard,
  Newspaper,
  Play,
  Radio,
  RefreshCw,
  Route,
  Send,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import CourseCard from "../components/CourseCard.jsx";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";
import SectionTitle from "../components/SectionTitle.jsx";
import { fetchArticles, resolveArticleCoverUrl } from "../../services/articleService.js";
import {
  fetchPublicPlatformStats,
  fetchPublishedCourses,
  fetchStudentEnrollments,
} from "../../services/courseService.js";
import { getAuthUser } from "../../services/portal.js";
import { fetchPublicTeachers } from "../../services/teacherService.js";
import { fetchPublicVideos } from "../../services/videoService.js";
import { resolveAvatarUrl } from "../utils/avatar.js";
import { buildTeacherPath } from "../utils/routePaths.js";

const EXCLUDED_ENROLLMENT_STATUSES = new Set(["cancelled", "canceled", "failed", "rejected", "refunded"]);

const copy = {
  fa: {
    watchVideos: "تماشای ویدیوها",
    explore: "دسترسی سریع",
    exploreTitle: "از کجا می‌خواهید شروع کنید؟",
    exploreText: "کورس، مدرس یا محتوای مناسب خود را بدون اتلاف وقت پیدا کنید.",
    quickLinks: [
      { key: "courses", title: "کورس‌ها", text: "کورس مناسب خود را پیدا کنید", href: "/live-courses" },
      { key: "teachers", title: "مدرسان", text: "با مدرس‌های متخصص آشنا شوید", href: "/teachers" },
      { key: "videos", title: "ویدیوها", text: "نکته‌های آموزشی را تماشا کنید", href: "/videos" },
      { key: "blog", title: "مقاله‌ها", text: "راهنماهای کاربردی را بخوانید", href: "/blog" },
      { key: "roadmaps", title: "نقشه راه", text: "مسیر درست یادگیری را ببینید", href: "/roadmaps" },
    ],
    welcome: "خوش آمدید",
    continueTitle: "یادگیری خود را ادامه دهید",
    continueText: "مستقیم به کورس‌های فعال خود برگردید و از همان‌جایی که بودید ادامه دهید.",
    continueCourse: "ادامه کورس",
    dashboard: "داشبورد من",
    coursesBadge: "کورس‌های برتر",
    allCourses: "مشاهده همه کورس‌ها",
    teachersBadge: "مدرسان ایجوتک",
    teachersTitle: "از مدرس‌های متخصص یاد بگیرید",
    teachersText: "پروفایل مدرس‌ها را ببینید و فرد مناسب برای هدف یادگیری خود را انتخاب کنید.",
    allTeachers: "مشاهده همه مدرسان",
    courses: "کورس",
    students: "شاگرد",
    followers: "دنبال‌کننده",
    videosBadge: "تازه از ویدیوها",
    videosTitle: "یادگیری کوتاه و کاربردی",
    videosText: "محبوب‌ترین ویدیوهای آموزشی مدرس‌ها را در یک نگاه ببینید.",
    allVideos: "مشاهده همه ویدیوها",
    watch: "تماشای ویدیو",
    likes: "پسند",
    articlesBadge: "مجله آموزشی",
    articlesTitle: "مقاله‌های برتر",
    articlesText: "راهنماها و ایده‌هایی برای اینکه بهتر و هدفمندتر یاد بگیرید.",
    allArticles: "مشاهده همه مقاله‌ها",
    read: "مطالعه مقاله",
    minutes: "دقیقه مطالعه",
    views: "بازدید",
    loadError: "بخشی از محتوای صفحه بارگذاری نشد.",
    retry: "تلاش دوباره",
    loading: "در حال آماده‌سازی صفحه اصلی",
    noCourses: "در حال حاضر هیچ کورسی موجود نیست.",
    rank: "رتبه",
  },
  en: {
    watchVideos: "Watch videos",
    explore: "Quick access",
    exploreTitle: "Where would you like to begin?",
    exploreText: "Find the right course, teacher, or learning resource without wasting time.",
    quickLinks: [
      { key: "courses", title: "Courses", text: "Find the right course for you", href: "/live-courses" },
      { key: "teachers", title: "Teachers", text: "Meet expert instructors", href: "/teachers" },
      { key: "videos", title: "Videos", text: "Watch practical learning tips", href: "/videos" },
      { key: "blog", title: "Articles", text: "Read useful learning guides", href: "/blog" },
      { key: "roadmaps", title: "Roadmaps", text: "See the right learning path", href: "/roadmaps" },
    ],
    welcome: "Welcome back",
    continueTitle: "Continue your learning",
    continueText: "Return to your active courses and pick up exactly where you left off.",
    continueCourse: "Continue course",
    dashboard: "My dashboard",
    coursesBadge: "Top courses",
    allCourses: "View all courses",
    teachersBadge: "EduTech teachers",
    teachersTitle: "Learn from expert teachers",
    teachersText: "Explore teacher profiles and choose the right expert for your learning goal.",
    allTeachers: "View all teachers",
    courses: "courses",
    students: "students",
    followers: "followers",
    videosBadge: "Fresh from videos",
    videosTitle: "Short, practical learning",
    videosText: "Discover popular educational videos from EduTech teachers at a glance.",
    allVideos: "View all videos",
    watch: "Watch video",
    likes: "likes",
    articlesBadge: "Learning journal",
    articlesTitle: "Top articles",
    articlesText: "Guides and ideas that help you learn better and with more purpose.",
    allArticles: "View all articles",
    read: "Read article",
    minutes: "min read",
    views: "views",
    loadError: "Some homepage content could not be loaded.",
    retry: "Try again",
    loading: "Preparing the homepage",
    noCourses: "There are no available courses right now.",
    rank: "Rank",
  },
};

const quickIcons = {
  courses: BookOpen,
  teachers: Users,
  videos: Video,
  blog: Newspaper,
  roadmaps: Route,
};

const quickColors = {
  courses: "bg-blue-50 text-blue-700 group-hover:bg-blue-600",
  teachers: "bg-violet-50 text-violet-700 group-hover:bg-violet-600",
  videos: "bg-rose-50 text-rose-700 group-hover:bg-rose-600",
  blog: "bg-amber-50 text-amber-700 group-hover:bg-amber-500",
  roadmaps: "bg-teal-50 text-teal-700 group-hover:bg-teal-600",
};

const localized = (value, locale) => {
  if (typeof value === "string") return value;
  return value?.[locale] || value?.[locale === "fa" ? "en" : "fa"] || "";
};

const hasActiveEnrollmentAccess = (row = {}) => {
  const status = String(row?.enrollmentStatus || "").toLowerCase();
  if (EXCLUDED_ENROLLMENT_STATUSES.has(status) || !["active", "completed"].includes(status)) return false;
  if (String(row?.accessStatus || "").toLowerCase() !== "allowed") return false;
  if (!row?.accessExpiresAt) return true;
  const expiresAt = new Date(row.accessExpiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt > new Date();
};

const activeEnrollments = (rows = []) => rows.filter(hasActiveEnrollmentAccess);

const buildEnrolledCourseIdSet = (rows = []) => new Set(
  activeEnrollments(rows)
    .map((row) => (typeof row?.courseId === "object" ? row.courseId?._id || row.courseId?.id : row?.courseId))
    .filter(Boolean)
    .map(String),
);

const numericValue = (value) => Number(value || 0);
const dateValue = (value) => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};
const stableId = (item) => String(item?._id || item?.id || item?.slug || "");
const compareRankFields = (left, right, fields) => {
  for (const field of fields) {
    const difference = numericValue(field(right)) - numericValue(field(left));
    if (difference) return difference;
  }
  return stableId(left).localeCompare(stableId(right));
};

const rankCourses = (rows = []) => [...rows].sort((left, right) => compareRankFields(left, right, [
  (item) => item.homeRank,
  (item) => item.courseType === "special" ? 1 : 0,
  (item) => item.enrolledStudentsCount,
  (item) => item.rating,
  (item) => item.ratingCount,
  (item) => dateValue(item.createdAt),
]));

const rankTeachers = (rows = []) => [...rows].sort((left, right) => compareRankFields(left, right, [
  (item) => item.homeRank,
  (item) => item.totalStudents,
  (item) => item.followerCount,
  (item) => item.rating,
  (item) => item.publishedCoursesCount,
  (item) => item?.teacherApplication?.yearsExperience,
  (item) => dateValue(item.createdAt),
]));

const rankVideos = (rows = []) => [...rows].sort((left, right) => compareRankFields(left, right, [
  (item) => item.homeRank,
  (item) => item.likeCount,
  (item) => dateValue(item.createdAt),
]));

const rankArticles = (rows = []) => [...rows].sort((left, right) => compareRankFields(left, right, [
  (item) => item.homeRank,
  (item) => item.featured ? 1 : 0,
  (item) => item.viewCount,
  (item) => dateValue(item.publishedAt || item.createdAt),
]));

function RankBadge({ index, page }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black shadow-sm ${index === 0 ? "bg-amber-400 text-amber-950" : index < 3 ? "bg-primary-600 text-white" : "bg-white/95 text-slate-600"}`}>{page.rank} #{index + 1}</span>;
}

function ViewAllLink({ children, isRTL, to }) {
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  return (
    <Link to={to} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-primary-200 hover:text-primary-700">
      {children}<Arrow size={16} />
    </Link>
  );
}

function ContentHeading({ badge, title, text, action }) {
  return (
    <div className="mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-primary-700"><Sparkles size={14} />{badge}</span>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
        <p className="mt-3 leading-7 text-slate-600">{text}</p>
      </div>
      {action}
    </div>
  );
}

function TeacherCard({ teacher, page, numberFormatter, rank }) {
  const professionalTitle = teacher?.teacherApplication?.professionalTitle || teacher?.teacherApplication?.expertiseAreas?.[0] || "EduTech";
  return (
    <Link to={buildTeacherPath(teacher)} className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-xl">
      <div className="mb-4"><RankBadge index={rank} page={page} /></div>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-50 to-teal-50 p-1">
          <img src={teacher.avatar || "/logo.png"} alt={teacher.name || "EduTech"} loading="lazy" onError={(event) => { event.currentTarget.src = "/logo.png"; }} className={`h-full w-full rounded-xl ${teacher.avatar ? "object-cover" : "object-contain p-2"}`} />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black text-slate-950 group-hover:text-primary-700">{teacher.name}</h3>
          <p className="mt-1 line-clamp-1 text-sm font-bold text-slate-500">{professionalTitle}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
        {[
          [teacher.publishedCoursesCount, page.courses],
          [teacher.totalStudents, page.students],
          [teacher.followerCount, page.followers],
        ].map(([value, label]) => <div key={label}><p className="font-black text-slate-900">{numberFormatter.format(Number(value || 0))}</p><p className="mt-1 truncate text-[11px] font-bold text-slate-400">{label}</p></div>)}
      </div>
    </Link>
  );
}

function VideoCard({ video, page, numberFormatter, rank }) {
  return (
    <Link to={`/videos?video=${encodeURIComponent(video._id || "")}`} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50">
        <img src="/logo.png" alt="" className="absolute inset-0 m-auto h-16 w-40 object-contain opacity-70" />
        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt={video.title || ""} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : null}
        <span className="absolute inset-0 grid place-items-center bg-slate-950/10 transition group-hover:bg-slate-950/25"><span className="grid h-14 w-14 place-items-center rounded-full bg-white text-primary-700 shadow-xl"><Play size={24} fill="currentColor" /></span></span>
        <span className="absolute start-3 top-3 rounded-full bg-slate-950/75 px-3 py-1.5 text-[11px] font-black uppercase text-white backdrop-blur">{video.platform}</span>
        <span className="absolute end-3 top-3"><RankBadge index={rank} page={page} /></span>
      </div>
      <div className="p-5">
        <h3 className="line-clamp-2 min-h-14 text-lg font-black leading-7 text-slate-950 group-hover:text-primary-700">{video.title}</h3>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <img src={resolveAvatarUrl(video?.teacher?.avatar) || "/logo.png"} alt="" loading="lazy" onError={(event) => { event.currentTarget.src = "/logo.png"; }} className="h-8 w-8 shrink-0 rounded-full bg-slate-50 object-cover" />
            <span className="truncate text-xs font-black text-slate-600">{video?.teacher?.name || "EduTech"}</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-rose-600"><Heart size={14} />{numberFormatter.format(Number(video.likeCount || 0))} {page.likes}</span>
        </div>
      </div>
    </Link>
  );
}

function ArticleCard({ article, locale, page, numberFormatter, rank }) {
  const title = localized(article.title, locale);
  const image = resolveArticleCoverUrl(article.coverImage);
  const Arrow = locale === "fa" ? ArrowLeft : ArrowRight;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <Link to={`/blog/${article.slug}`} className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50">
        <img src={image || "/logo.png"} alt={title} loading="lazy" onError={(event) => { event.currentTarget.src = "/logo.png"; event.currentTarget.className = "h-full w-full object-contain p-10"; }} className={`h-full w-full transition duration-500 group-hover:scale-105 ${image ? "object-cover" : "object-contain p-10"}`} />
        {article.featured ? <span className="absolute start-3 top-3 rounded-full bg-slate-950/80 px-3 py-1.5 text-xs font-black text-white"><Sparkles size={13} className="me-1 inline" />{locale === "fa" ? "ویژه" : "Featured"}</span> : null}
        <span className="absolute end-3 top-3"><RankBadge index={rank} page={page} /></span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-xl font-black leading-8 text-slate-950 group-hover:text-primary-700"><Link to={`/blog/${article.slug}`}>{title}</Link></h3>
        <p className="mt-3 line-clamp-2 text-sm font-medium leading-7 text-slate-600">{localized(article.excerpt, locale)}</p>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs font-bold text-slate-400">
          <span className="flex flex-wrap gap-3"><span className="inline-flex items-center gap-1"><Clock3 size={14} />{article.estimatedReadMinutes || 1} {page.minutes}</span><span className="inline-flex items-center gap-1"><Eye size={14} />{numberFormatter.format(Number(article.viewCount || 0))}</span></span>
          <Link to={`/blog/${article.slug}`} aria-label={`${page.read}: ${title}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-600 text-white"><Arrow size={16} /></Link>
        </div>
      </div>
    </article>
  );
}

export default function HomePage({ language, t }) {
  const locale = language === "fa" ? "fa" : "en";
  const page = copy[locale];
  const dir = t.meta.dir;
  const isRTL = dir === "rtl";
  const [featuredCourses, setFeaturedCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [articles, setArticles] = useState([]);
  const [platformStats, setPlatformStats] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [failedSections, setFailedSections] = useState([]);
  const [authUser, setAuthUser] = useState(() => getAuthUser());

  const loadHomeData = useCallback(async () => {
    setLoading(true);
    setFailedSections([]);
    const requests = [
      ["courses", fetchPublishedCourses({ page: 1, limit: 18, sortBy: "popular" })],
      ["stats", fetchPublicPlatformStats()],
      ["teachers", fetchPublicTeachers({ page: 1, limit: 60, sortBy: "experience", sortOrder: "desc" })],
      ["videos", fetchPublicVideos({ feed: "all", platform: "all", sort: "popular", page: 1, limit: 12 })],
      ["articles", fetchArticles({ page: 1, limit: 12, sort: "popular" })],
    ];
    const results = await Promise.allSettled(requests.map(([, request]) => request));
    const failures = [];
    results.forEach((result, index) => {
      const key = requests[index][0];
      if (result.status === "rejected") { failures.push(key); return; }
      const value = result.value;
      if (key === "courses") setFeaturedCourses(rankCourses(Array.isArray(value?.courses) ? value.courses : []).slice(0, 6));
      if (key === "stats") setPlatformStats({ activeCourses: Number(value?.activeCourses || 0), expertTeachers: Number(value?.expertTeachers || 0), happyStudents: Number(value?.happyStudents || 0) });
      if (key === "teachers") setTeachers(rankTeachers(Array.isArray(value?.teachers) ? value.teachers : []).slice(0, 4));
      if (key === "videos") setVideos(rankVideos(Array.isArray(value?.videos) ? value.videos : []).slice(0, 3));
      if (key === "articles") setArticles(rankArticles(Array.isArray(value?.articles) ? value.articles : []).slice(0, 3));
    });
    setFailedSections(failures);
    setLoading(false);
  }, []);

  const loadEnrollments = useCallback(async () => {
    const user = getAuthUser();
    setAuthUser(user);
    if (localStorage.getItem("edutech_auth") !== "true") {
      setEnrollments([]);
      setEnrolledCourseIds(new Set());
      return;
    }
    try {
      const rows = await fetchStudentEnrollments();
      const activeRows = activeEnrollments(rows);
      setEnrollments(activeRows);
      setEnrolledCourseIds(buildEnrolledCourseIdSet(rows));
    } catch {
      setEnrollments([]);
      setEnrolledCourseIds(new Set());
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    const initialLoadTimer = window.setTimeout(() => {
      loadHomeData();
      loadEnrollments();
    }, 0);
    window.addEventListener("auth_change", loadEnrollments);
    window.addEventListener("edutech_data_changed", loadEnrollments);
    return () => {
      window.clearTimeout(initialLoadTimer);
      window.removeEventListener("auth_change", loadEnrollments);
      window.removeEventListener("edutech_data_changed", loadEnrollments);
    };
  }, [loadEnrollments, loadHomeData]);

  const numberFormatter = new Intl.NumberFormat(locale === "fa" ? "fa-AF" : "en-US", { maximumFractionDigits: 0 });
  const stats = [
    ["activeCourses", locale === "fa" ? "کورس فعال" : "Active Courses"],
    ["expertTeachers", locale === "fa" ? "مدرسان متخصص" : "Expert Teachers"],
    ["happyStudents", locale === "fa" ? "شاگردان" : "Students"],
  ];
  const firstEnrollment = enrollments[0];
  const firstCourse = typeof firstEnrollment?.courseId === "object" ? firstEnrollment.courseId : null;
  const firstCoursePath = `/student/course/${encodeURIComponent(firstCourse?.slug || firstCourse?._id || firstCourse?.id || firstEnrollment?._id || "")}`;

  return (
    <>
      <section id="home" className="relative overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#F4FAFF_100%)]">
        <div className="absolute -start-24 top-16 h-72 w-72 rounded-full bg-primary-100/50 blur-3xl" />
        <div className="absolute -end-20 bottom-10 h-64 w-64 rounded-full bg-teal-100/60 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1536px] items-center gap-8 px-4 pb-12 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[0.52fr_0.48fr] lg:px-8 lg:py-14" dir="ltr">
          <div className={`relative z-10 w-full max-w-[650px] text-center ${isRTL ? "mx-auto lg:order-2 lg:justify-self-end" : "mx-auto lg:order-1 lg:justify-self-start"}`} dir={dir}>
            <div className={`inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white px-5 py-2 text-sm font-bold text-primary-700 shadow-sm ${isRTL ? "flex-row-reverse" : ""}`}><Radio size={16} />{t.hero.badge}</div>
            <h1 className="mx-auto mt-7 max-w-3xl whitespace-pre-line text-4xl font-black leading-[1.4] tracking-tight text-slate-950 sm:text-[2.75rem] lg:text-[3.35rem] lg:leading-[1.5]">
              <span className="text-teal-500">{t.hero.titleBefore}</span>{language === "fa" ? " " : "\n"}{t.hero.titleAfter}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">{t.hero.subtitle}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:items-center">
              <Link className="inline-flex h-14 items-center justify-center gap-3 rounded-xl bg-primary-600 px-7 text-base font-extrabold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-100" to="/live-courses"><span>{t.hero.primary}</span><ArrowUpRight size={19} /></Link>
              <Link className="inline-flex h-14 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-7 text-base font-extrabold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:text-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-100" to="/videos"><Play size={18} fill="currentColor" /><span>{page.watchVideos}</span></Link>
            </div>
            <div className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {t.hero.features.map((feature) => <div className="inline-flex min-w-0 items-center justify-center rounded-full border border-slate-100 bg-white px-3 py-2 text-center text-xs font-semibold leading-5 text-slate-700 shadow-sm sm:text-sm" key={feature}>{feature}</div>)}
            </div>
          </div>
          <div className={`relative z-10 w-full max-w-[760px] self-center ${isRTL ? "mx-auto lg:order-1 lg:justify-self-start" : "mx-auto lg:order-2 lg:justify-self-end"}`}>
            <div className={`absolute -bottom-2 h-[45%] w-[34%] rounded-[42%_58%_48%_52%/54%_42%_58%_46%] bg-teal-500/90 ${isRTL ? "right-7" : "left-7"}`} />
            <div className={`absolute top-12 h-[78%] w-[44%] bg-gradient-to-br from-primary-300 to-primary-600 ${isRTL ? "left-0" : "right-0"}`} />
            <div className="relative overflow-hidden bg-transparent lg:min-h-[498px]">
              <picture><source srcSet="/hero-student.webp" type="image/webp" /><img className="relative z-10 h-full min-h-[300px] w-full object-cover object-center lg:min-h-[498px]" src="/hero-student.png" width="806" height="498" fetchPriority="high" decoding="async" alt={t.hero.visualTitle} /></picture>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 bg-white py-8" dir={dir}>
        <div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8">
          {failedSections.length > 0 ? <div className="mb-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center sm:flex-row sm:text-start"><p className="text-sm font-bold text-amber-800">{page.loadError}</p><button type="button" onClick={loadHomeData} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-amber-800 shadow-sm"><RefreshCw size={16} />{page.retry}</button></div> : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map(([key, label]) => <div key={key} className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-center shadow-sm"><p className="text-3xl font-black text-primary-700 sm:text-4xl">{platformStats ? numberFormatter.format(Math.max(0, Math.round(platformStats[key]))) : "—"}</p><p className="mt-2 text-sm font-bold text-slate-500">{label}</p></div>)}
          </div>
        </div>
      </section>

      {authUser ? <section className="bg-slate-50 py-8" dir={dir}><div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8"><div className="relative overflow-hidden rounded-3xl bg-slate-950 px-5 py-7 text-white shadow-xl sm:px-8"><div className="absolute -end-12 -top-20 h-56 w-56 rounded-full bg-primary-500/30 blur-3xl" /><div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><p className="text-sm font-black text-teal-300">{page.welcome}{authUser?.name ? `، ${authUser.name}` : ""}</p><h2 className="mt-2 text-2xl font-black">{firstCourse?.title || page.continueTitle}</h2><p className="mt-2 text-sm font-medium leading-7 text-slate-300">{page.continueText}</p></div><div className="flex flex-col gap-3 sm:flex-row">{firstCourse ? <Link to={firstCoursePath} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950"><Play size={17} fill="currentColor" />{page.continueCourse}</Link> : null}<Link to="/student/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-black text-white hover:bg-white/10"><LayoutDashboard size={17} />{page.dashboard}</Link></div></div></div></div></section> : null}

      <section className="bg-white py-10 md:py-14" dir={dir}>
        <div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8">
          <ContentHeading badge={page.explore} title={page.exploreTitle} text={page.exploreText} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {page.quickLinks.map((item) => { const Icon = quickIcons[item.key]; return <Link key={item.key} to={item.href} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:p-5"><span className={`grid h-11 w-11 place-items-center rounded-xl transition group-hover:text-white ${quickColors[item.key]}`}><Icon size={21} /></span><h3 className="mt-4 font-black text-slate-950">{item.title}</h3><p className="mt-2 hidden text-xs font-semibold leading-6 text-slate-500 sm:block">{item.text}</p></Link>; })}
          </div>
        </div>
      </section>

      <section id="courses" className="bg-white py-12 md:py-16" dir={dir}>
        <div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8">
          <ContentHeading badge={page.coursesBadge} title={t.coursesSection.title} text={t.coursesSection.subtitle} action={<ViewAllLink isRTL={isRTL} to="/live-courses">{page.allCourses}</ViewAllLink>} />
          {loading && featuredCourses.length === 0 ? <FrontendPageLoader label={page.loading} minHeight="min-h-[220px]" /> : featuredCourses.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center"><p className="font-bold text-slate-600">{page.noCourses}</p></div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{featuredCourses.map((course, index) => <div key={course._id || course.id || `${course.title}-${index}`} className="relative"><span className="absolute end-3 top-3 z-20"><RankBadge index={index} page={page} /></span><CourseCard course={course} dir={dir} index={index} labels={t.courseLabels} language={language} isEnrolled={enrolledCourseIds.has(String(course?._id || course?.id || ""))} /></div>)}</div>}
        </div>
      </section>

      {teachers.length > 0 ? <section className="bg-slate-50 py-12 md:py-16" dir={dir}><div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8"><ContentHeading badge={page.teachersBadge} title={page.teachersTitle} text={page.teachersText} action={<ViewAllLink isRTL={isRTL} to="/teachers">{page.allTeachers}</ViewAllLink>} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{teachers.map((teacher, index) => <TeacherCard key={teacher._id} teacher={teacher} page={page} numberFormatter={numberFormatter} rank={index} />)}</div></div></section> : null}

      {videos.length > 0 ? <section className="bg-white py-12 md:py-16" dir={dir}><div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8"><ContentHeading badge={page.videosBadge} title={page.videosTitle} text={page.videosText} action={<ViewAllLink isRTL={isRTL} to="/videos">{page.allVideos}</ViewAllLink>} /><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{videos.map((video, index) => <VideoCard key={video._id} video={video} page={page} numberFormatter={numberFormatter} rank={index} />)}</div></div></section> : null}

      {articles.length > 0 ? <section className="bg-slate-50 py-12 md:py-16" dir={dir}><div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8"><ContentHeading badge={page.articlesBadge} title={page.articlesTitle} text={page.articlesText} action={<ViewAllLink isRTL={isRTL} to="/blog">{page.allArticles}</ViewAllLink>} /><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{articles.map((article, index) => <ArticleCard key={article._id} article={article} locale={locale} page={page} numberFormatter={numberFormatter} rank={index} />)}</div></div></section> : null}

      <section id="about" className="bg-white py-16" dir={dir}><div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8"><SectionTitle title={t.why.title} subtitle={t.why.subtitle} /><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{t.why.benefits.map((benefit) => <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-card" key={benefit.title}><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-50 text-primary-700"><GraduationCap size={21} /></span><h3 className="mt-5 text-lg font-black text-slate-950">{benefit.title}</h3><p className="mt-3 leading-7 text-slate-600">{benefit.text}</p></article>)}</div></div></section>

      <section className="bg-white pb-14 md:pb-20" dir={dir}><div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8"><div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 via-primary-600 to-teal-500 px-5 py-8 text-white shadow-hero sm:px-10 sm:py-12 lg:px-14"><div className="absolute inset-y-0 end-0 w-1/2 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]" /><div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><div className={`mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold ${isRTL ? "flex-row-reverse" : ""}`}><Sparkles size={16} />EduTech</div><h2 className="text-2xl font-black leading-tight sm:text-3xl md:text-4xl">{t.cta.title}</h2><p className="mt-3 text-base leading-7 text-white/85 sm:text-lg sm:leading-8">{t.cta.text}</p></div><div className="flex flex-col gap-3 sm:flex-row"><Link className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-primary-700 transition hover:-translate-y-0.5 sm:px-6 sm:py-4 sm:text-base" to="/live-courses"><BadgeCheck size={19} />{t.cta.primary}</Link><Link className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10 sm:px-6 sm:py-4 sm:text-base" to="/contact"><Send size={18} />{t.cta.secondary}</Link></div></div></div></div></section>
    </>
  );
}
