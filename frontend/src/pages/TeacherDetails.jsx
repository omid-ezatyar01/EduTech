import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  MessageCircle,
  PlayCircle,
  UsersRound,
  Smile,
  LineChart,
  UserRound,
  Sparkles,
  CalendarDays,
  CircleHelp,
  BookOpen,
  Clock3,
  Eye,
  Video,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import TeacherHero from "../components/TeacherHero.jsx";
import TeacherStats from "../components/TeacherStats.jsx";
import CourseCard from "../components/CourseCard.jsx";
import SkillBadge from "../components/SkillBadge.jsx";
import ProgressSkill from "../components/ProgressSkill.jsx";
import TeacherScheduleTable from "../components/TeacherScheduleTable.jsx";
import FAQAccordion from "../components/FAQAccordion.jsx";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";
import {
  fetchPublicTeacherById,
  getCachedPublicTeacherById,
} from "../../services/teacherService.js";
import { fetchStudentEnrollments } from "../../services/courseService.js";
import { buildTeacherPath, extractRouteIdentifier } from "../utils/routePaths.js";
import {
  getLocalizedRequestErrorMessage,
  isUnauthorizedError,
} from "../../services/http.js";
import { applySeo } from "../seo/useSeo.js";
import { getToken } from "../../services/portal.js";
import { fetchTeacherFollowStatus, followTeacher, unfollowTeacher } from "../../services/teacherSocialService.js";
import { enableEduTechPushNotifications } from "../../services/pushNotifications.js";
import { fetchPublicVideos } from "../../services/videoService.js";
import { fetchArticles, resolveArticleCoverUrl } from "../../services/articleService.js";

const PANEL_COLLAPSED_HEIGHT = 580;

const localizedArticleText = (value, language) =>
  value?.[language] || value?.[language === "fa" ? "en" : "fa"] || "";

function formatContentDate(value, isFa) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(isFa ? "fa-AF" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function normalizeTeacherSeoText(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateTeacherSeoText(value, maxLength) {
  const normalized = normalizeTeacherSeoText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function resolveCourseId(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    return String(value._id || value.id || "").trim();
  }
  return "";
}

function hasActiveEnrollmentAccess(row = {}) {
  const status = String(row?.enrollmentStatus || "").toLowerCase();
  if (!["active", "completed"].includes(status)) return false;
  if (String(row?.accessStatus || "").toLowerCase() !== "allowed") return false;
  if (!row?.accessExpiresAt) return true;
  const expiresAt = new Date(row.accessExpiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt > new Date();
}

function getYouTubeEmbedUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    let videoId = "";

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname.startsWith("/shorts/")) {
        videoId = url.pathname.split("/").filter(Boolean)[1] || "";
      } else if (url.pathname.startsWith("/embed/")) {
        videoId = url.pathname.split("/").filter(Boolean)[1] || "";
      } else {
        videoId = url.searchParams.get("v") || "";
      }
    }

    const cleanId = String(videoId || "").replace(/[^a-zA-Z0-9_-]/g, "");
    return cleanId ? `https://www.youtube.com/embed/${cleanId}` : "";
  } catch {
    return "";
  }
}

function getMeetingTypeLabel(type, isFa = true) {
  if (type === "zoom") return "Zoom";
  if (type === "physical") return isFa ? "حضوری" : "In Person";
  if (type === "recorded") return isFa ? "ضبط‌شده" : "Recorded";
  return "Google Meet";
}

const pageData = {
  fa: {
    breadcrumbs: ["خانه", "مدرسان", "سارا احمدی"],
    hero: {
      name: "سارا احمدی",
      role: "استاد مکالمه انگلیسی",
      bio: "سارا احمدی بیش از ۵ سال تجربه تدریس زبان انگلیسی دارد و تمرکز او روی مکالمه عملی، تقویت اعتماد به نفس، Listening و اصلاح تلفظ شاگردان است.",
      btnViewCourses: "مشاهده کورس‌های استاد",
      btnContact: "تماس با استاد",
      btnShare: "اشتراک‌گذاری پروفایل",
      onlineBadge: "آنلاین",
    },
    stats: [
      { label: "امتیاز", value: "هنوز امتیازی نیست" },
      { label: "مجموع شاگردان", value: "۸۰۰" },
      { label: "کورس‌های فعال", value: "۴" },
      { label: "سال تجربه", value: "۵" },
    ],
    tabs: [
      "درباره استاد",
      "مهارت‌ها",
      "تقسیم اوقات",
      "سوالات",
    ],
    sections: {
      aboutTitle: "درباره استاد",
      aboutText:
        "سارا احمدی یکی از استادان باتجربه ایجوتک در بخش مکالمه انگلیسی است. روش تدریس او عملی، ساده و تعاملی است. در صنف‌های او شاگردان فقط قواعد یاد نمی‌گیرند، بلکه صحبت می‌کنند، تمرین می‌کنند و اشتباهات خود را اصلاح می‌کنند.",
      teachingStyles: [
        { title: "تدریس عملی", text: "تمرکز روی تمرین واقعی و مکالمه روزمره" },
        { title: "صنف تعاملی", text: "پرسش و پاسخ، تمرین گروهی و Role Play" },
        { title: "روش ساده و دوستانه", text: "توضیح ساده برای شاگردان مبتدی" },
        {
          title: "پیگیری پیشرفت",
          text: "بررسی سطح و پیشرفت شاگردان در طول کورس",
        },
      ],
      skillsTitle: "مهارت‌ها و تخصص‌ها",
      skills: [],
      progressSkills: [
        { name: "مکالمه", percentage: 95 },
        { name: "شنیداری", percentage: 90 },
        { name: "تلفظ", percentage: 92 },
        { name: "گرامر", percentage: 85 },
      ],
      coursesTitle: "کورس‌های این استاد",
      courses: [
        {
          title: "مکالمه انگلیسی",
          level: "همه سطوح",
          duration: "۲ ماه",
          schedule: "دوشنبه، چهارشنبه، جمعه",
          time: "18:00 - 19:30",
          seats: "12 / 30",
          price: "29 دالر",
          liveLabel: "آنلاین",
          btnRegister: "ثبت نام",
          btnDetails: "مشاهده جزئیات",
        },
        {
          title: "انگلیسی تجاری",
          level: "متوسط",
          duration: "۲ ماه",
          schedule: "سه‌شنبه، پنجشنبه",
          time: "19:00 - 20:30",
          seats: "8 / 25",
          price: "39 دالر",
          liveLabel: "آنلاین",
          btnRegister: "ثبت نام",
          btnDetails: "مشاهده جزئیات",
        },
        {
          title: "تلفظ و مکالمه",
          level: "همه سطوح",
          duration: "۱.۵ ماه",
          schedule: "شنبه، دوشنبه",
          time: "18:30 - 20:00",
          seats: "10 / 20",
          price: "25 دالر",
          liveLabel: "آنلاین",
          btnRegister: "ثبت نام",
          btnDetails: "مشاهده جزئیات",
        },
        {
          title: "آمادگی آیلتس",
          level: "پیشرفته",
          duration: "۳ ماه",
          schedule: "یکشنبه، سه‌شنبه، پنجشنبه",
          time: "20:00 - 21:30",
          seats: "6 / 20",
          price: "59 دالر",
          liveLabel: "آنلاین",
          btnRegister: "ثبت نام",
          btnDetails: "مشاهده جزئیات",
        },
      ],
      scheduleTitle: "تقسیم اوقات هفتگی استاد",
      scheduleLabels: {
        day: "روز",
        course: "کورس",
        time: "وقت",
        status: "حالت",
      },
      schedule: [
        {
          day: "دوشنبه",
          course: "English Conversation",
          time: "18:00 - 19:30",
          status: "پیش‌رو",
        },
        {
          day: "سه‌شنبه",
          course: "Business English",
          time: "19:00 - 20:30",
          status: "پیش‌رو",
        },
        {
          day: "چهارشنبه",
          course: "English Conversation",
          time: "18:00 - 19:30",
          status: "پیش‌رو",
        },
        {
          day: "پنجشنبه",
          course: "Business English",
          time: "19:00 - 20:30",
          status: "پیش‌رو",
        },
        {
          day: "جمعه",
          course: "English Conversation",
          time: "18:00 - 19:30",
          status: "پیش‌رو",
        },
      ],
      scheduleNote:
        "لینک Google Meet برای شاگردان ثبت‌نام‌شده از داخل داشبورد قابل دسترس است.",
      endedCoursesTitle: "کورس‌های پایان‌یافته این استاد",
      endedCoursesEmpty: "این استاد هنوز کورس پایان‌یافته‌ای برای نمایش ندارد.",
      reviewsTitle: "نظریات شاگردان",
      reviews: [],
      faqTitle: "سوالات رایج درباره استاد",
      faqs: [
        {
          q: "آیا استاد با شاگردان مبتدی هم کار می‌کند؟",
          a: "بلی، این استاد تجربه کار با شاگردان مبتدی تا متوسط را دارد.",
        },
        {
          q: "آیا می‌توانم قبل از ثبت‌نام مشوره بگیرم؟",
          a: "بلی، می‌توانید از طریق دکمه تماس با استاد یا تماس با مشاور درخواست مشوره کنید.",
        },
        {
          q: "صنف‌ها در کجا برگزار می‌شود؟",
          a: "صنف‌ها به صورت آنلاین در Google Meet برگزار می‌شود.",
        },
        {
          q: "آیا این استاد کورس خصوصی هم دارد؟",
          a: "در صورت موجود بودن وقت، امکان کورس خصوصی یا 1-on-1 وجود دارد.",
        },
      ],
    },
    sidebar: {
      contactTitle: "تماس با استاد",
      responseTime: "معمولاً در ۲۴ ساعت پاسخ می‌دهد",
      btnSendMessage: "ارسال پیام",
      btnRequestConsultation: "درخواست مشاوره",
      btnViewCourses: "مشاهده کورس‌ها",
      quickInfoTitle: "معلومات سریع",
      quickInfo: [
        { label: "زبان", value: "فارسی، انگلیسی" },
        { label: "حالت تدریس", value: " آنلاین" },
        { label: "پلتفرم", value: "Google Meet" },
        { label: "اوقات فراغت", value: "عصرها و آخر هفته" },
      ],
      featuredTitle: "کورس پیشنهادی استاد",
      featuredCourse: {
        title: "مکالمه انگلیسی",
        level: "همه سطوح",
        price: "29 دالر",
        duration: "۲ ماه",
        schedule: "دوشنبه، چهارشنبه، جمعه",
        time: "18:00 - 19:30",
        btnRegister: "ثبت‌نام حالا",
      },
      shareTitle: "اشتراک‌گذاری پروفایل",
      copyLink: "کاپی لینک",
      achievementsTitle: "دستاوردها و سرتیفیکیت‌ها",
      achievements: [
        "استاد تاییدشده زبان انگلیسی",
        "آموزش بیش از ۸۰۰ شاگرد",
        "۵ سال تجربه تدریس",
      ],
    },
  },
  en: {
    breadcrumbs: ["Home", "Teachers", "Sara Ahmadi"],
    hero: {
      name: "Sara Ahmadi",
      role: "English Conversation Instructor",
      bio: "Sara Ahmadi has over 5 years of experience teaching English, focusing on practical conversation, confidence building, listening, and pronunciation improvement.",
      btnViewCourses: "View Teacher Courses",
      btnContact: "Contact Teacher",
      btnShare: "Share Profile",
      onlineBadge: "Online",
    },
    stats: [
      { label: "Rating", value: "No ratings yet" },
      { label: "Total Learners", value: "800" },
      { label: "Active Courses", value: "4" },
      { label: "Years Experience", value: "5" },
    ],
    tabs: ["About Teacher", "Skills", "Schedule", "FAQ"],
    sections: {
      aboutTitle: "About Teacher",
      aboutText:
        "Sara Ahmadi is one of EduTech’s experienced English conversation instructors. Her teaching method is practical, simple, and interactive. In her classes, students do not only learn rules; they speak, practice, and correct their mistakes.",
      teachingStyles: [
        {
          title: "Practical Teaching",
          text: "Focusing on real practice and daily conversation",
        },
        {
          title: "Interactive Class",
          text: "Q&A, group practice, and Role Play",
        },
        {
          title: "Friendly Method",
          text: "Simple explanations for beginner students",
        },
        {
          title: "Progress Tracking",
          text: "Monitoring students' level and progress throughout the course",
        },
      ],
      skillsTitle: "Skills & Expertise",
      skills: [],
      progressSkills: [
        { name: "Speaking", percentage: 95 },
        { name: "Listening", percentage: 90 },
        { name: "Pronunciation", percentage: 92 },
        { name: "Grammar", percentage: 85 },
      ],
      coursesTitle: "Teacher's Courses",
      courses: [
        {
          title: "English Conversation",
          level: "All Levels",
          duration: "2 Months",
          schedule: "Mon, Wed, Fri",
          time: "18:00 - 19:30",
          seats: "12 / 30",
          price: "29 USD",
          liveLabel: "Live",
          btnRegister: "Register",
          btnDetails: "View Details",
        },
        {
          title: "Business English",
          level: "Intermediate",
          duration: "2 Months",
          schedule: "Tue, Thu",
          time: "19:00 - 20:30",
          seats: "8 / 25",
          price: "39 USD",
          liveLabel: "Live",
          btnRegister: "Register",
          btnDetails: "View Details",
        },
        {
          title: "Pronunciation & Speaking",
          level: "All Levels",
          duration: "1.5 Months",
          schedule: "Sat, Mon",
          time: "18:30 - 20:00",
          seats: "10 / 20",
          price: "25 USD",
          liveLabel: "Live",
          btnRegister: "Register",
          btnDetails: "View Details",
        },
        {
          title: "IELTS Preparation",
          level: "Advanced",
          duration: "3 Months",
          schedule: "Sun, Tue, Thu",
          time: "20:00 - 21:30",
          seats: "6 / 20",
          price: "59 USD",
          liveLabel: "Live",
          btnRegister: "Register",
          btnDetails: "View Details",
        },
      ],
      scheduleTitle: "Teacher Weekly Schedule",
      scheduleLabels: {
        day: "Day",
        course: "Course",
        time: "Time",
        status: "Status",
      },
      schedule: [
        {
          day: "Monday",
          course: "English Conversation",
          time: "18:00 - 19:30",
          status: "Upcoming",
        },
        {
          day: "Tuesday",
          course: "Business English",
          time: "19:00 - 20:30",
          status: "Upcoming",
        },
        {
          day: "Wednesday",
          course: "English Conversation",
          time: "18:00 - 19:30",
          status: "Upcoming",
        },
        {
          day: "Thursday",
          course: "Business English",
          time: "19:00 - 20:30",
          status: "Upcoming",
        },
        {
          day: "Friday",
          course: "English Conversation",
          time: "18:00 - 19:30",
          status: "Upcoming",
        },
      ],
      scheduleNote:
        "Google Meet links are available inside the dashboard for enrolled students.",
      endedCoursesTitle: "Ended Courses By This Teacher",
      endedCoursesEmpty: "This teacher does not have ended courses to show yet.",
      reviewsTitle: "Student Reviews",
      reviews: [],
      faqTitle: "Frequently Asked Questions",
      faqs: [
        {
          q: "Does the teacher work with beginners?",
          a: "Yes, this teacher has experience working with beginner to intermediate students.",
        },
        {
          q: "Can I get consultation before registration?",
          a: "Yes, you can use the contact teacher or advisor button before enrolling.",
        },
        {
          q: "Where are the classes held?",
          a: "Classes are held live on Google Meet.",
        },
        {
          q: "Does this teacher offer private classes?",
          a: "Private or 1-on-1 classes may be available depending on schedule.",
        },
      ],
    },
    sidebar: {
      contactTitle: "Contact Teacher",
      responseTime: "Usually responds within 24 hours",
      btnSendMessage: "Send Message",
      btnRequestConsultation: "Request Consultation",
      btnViewCourses: "View Courses",
      quickInfoTitle: "Quick Info",
      quickInfo: [
        { label: "Language", value: "Persian, English" },
        { label: "Teaching Mode", value: "Live Online" },
        { label: "Platform", value: "Google Meet" },
        { label: "Availability", value: "Evenings and weekends" },
      ],
      featuredTitle: "Featured Course",
      featuredCourse: {
        title: "English Conversation",
        level: "All Levels",
        price: "29 USD",
        duration: "2 Months",
        schedule: "Mon, Wed, Fri",
        time: "18:00 - 19:30",
        btnRegister: "Register Now",
      },
      shareTitle: "Share Profile",
      copyLink: "Copy Link",
      achievementsTitle: "Achievements & Certificates",
      achievements: [
        "Certified English Instructor",
        "800+ Students Trained",
        "5 Years Teaching Experience",
      ],
    },
  },
};

export default function TeacherDetails({ language = "fa" }) {
  const { id } = useParams();
  const teacherIdParam = extractRouteIdentifier(id);
  const navigate = useNavigate();
  const isFa = language === "fa";
  const dir = isFa ? "rtl" : "ltr";
  const baseData = pageData[language] || pageData["fa"];
  const cachedTeacher = getCachedPublicTeacherById(teacherIdParam);
  const [activeTab, setActiveTab] = useState(0);
  const [expandedPanels, setExpandedPanels] = useState({});
  const [panelOverflow, setPanelOverflow] = useState({});
  const [teacher, setTeacher] = useState(() => cachedTeacher);
  const [loading, setLoading] = useState(() => !cachedTeacher);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState(() => new Set());
  const [sectionRowNav, setSectionRowNav] = useState({});
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [teacherContent, setTeacherContent] = useState({ videos: [], articles: [], videoTotal: 0, articleTotal: 0 });
  const [teacherContentLoading, setTeacherContentLoading] = useState(false);
  const panelRefs = useRef({});
  const sectionRowRefs = useRef({});
  const courseCardLabels = useMemo(
    () => ({ details: isFa ? "جزئیات بیشتر" : "More details" }),
    [isFa],
  );
  const pageNumberFormatter = useMemo(
    () => new Intl.NumberFormat(isFa ? "fa-AF" : "en-US"),
    [isFa],
  );
  const tabIcons = [UserRound, Sparkles, CalendarDays, CircleHelp];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    let mounted = true;

    const loadTeacher = async () => {
      try {
        const initialTeacher = getCachedPublicTeacherById(teacherIdParam);
        if (initialTeacher) {
          setTeacher(initialTeacher);
          setLoading(false);
        } else {
          setTeacher(null);
          setLoading(true);
        }
        setError("");
        setNotFound(false);
        const row = initialTeacher || await fetchPublicTeacherById(teacherIdParam);
        if (!mounted) return;
        if (!row) {
          setError(isFa ? "استاد یافت نشد." : "Teacher not found.");
          setNotFound(true);
          setTeacher(null);
          return;
        }
        const canonicalPath = buildTeacherPath(row);
        if (canonicalPath !== `/teacher/${id}`) {
          navigate(canonicalPath, { replace: true });
        }
        setTeacher(row);
      } catch (err) {
        if (!mounted) return;
        const teacherWasNotFound =
          Number(err?.status) === 404 ||
          /teacher not found/i.test(String(err?.message || ""));
        setNotFound(teacherWasNotFound);
        setError(
          teacherWasNotFound
            ? isFa
              ? "این استاد یافت نشد یا پروفایل او دیگر منتشر نیست."
              : "This teacher was not found or their profile is no longer published."
            : getLocalizedRequestErrorMessage(
                err,
                isFa ? "fa" : "en",
                "دریافت معلومات استاد ناموفق بود.",
                "Failed to load teacher details.",
              ),
        );
        setTeacher(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadTeacher();

    return () => {
      mounted = false;
    };
  }, [id, navigate, teacherIdParam, isFa]);

  useEffect(() => {
    if (!teacher?._id || !getToken()) return undefined;
    let active = true;
    fetchTeacherFollowStatus(teacher._id).then((status) => {
      if (!active) return;
      setFollowing(Boolean(status.following));
      setFollowerCount(Number(status.followerCount || 0));
    }).catch(() => {});
    return () => { active = false; };
  }, [teacher?._id, teacher?.followerCount]);

  useEffect(() => {
    let active = true;
    if (!teacher?._id) {
      queueMicrotask(() => {
        if (active) setTeacherContent({ videos: [], articles: [], videoTotal: 0, articleTotal: 0 });
      });
      return () => { active = false; };
    }
    queueMicrotask(() => {
      if (active) setTeacherContentLoading(true);
    });
    Promise.all([
      fetchPublicVideos({ teacherId: teacher._id, sort: "newest", page: 1, limit: 3 })
        .catch(() => ({ videos: [], meta: {} })),
      fetchArticles({ authorId: teacher._id, sort: "latest", page: 1, limit: 3 })
        .catch(() => ({ articles: [], meta: {} })),
    ]).then(([videoResult, articleResult]) => {
      if (!active) return;
      setTeacherContent({
        videos: videoResult.videos || [],
        articles: articleResult.articles || [],
        videoTotal: Number(videoResult.meta?.total || videoResult.videos?.length || 0),
        articleTotal: Number(articleResult.meta?.total || articleResult.articles?.length || 0),
      });
    }).finally(() => {
      if (active) setTeacherContentLoading(false);
    });
    return () => { active = false; };
  }, [teacher?._id]);

  const handleToggleFollow = async () => {
    if (!getToken()) { navigate("/login"); return; }
    if (!teacher?._id || followBusy) return;
    if (!following) {
      const message = isFa
        ? "با دنبال کردن این استاد، هنگام انتشار ویدیوی جدید از او اعلان دریافت می‌کنید. آیا می‌خواهید ادامه دهید؟"
        : "By following this teacher, you will receive notifications when they publish a new video. Do you want to continue?";
      if (!window.confirm(message)) return;
    }
    setFollowBusy(true);
    try {
      if (!following) await enableEduTechPushNotifications({ forcePrompt: true }).catch(() => false);
      const status = following ? await unfollowTeacher(teacher._id) : await followTeacher(teacher._id);
      setFollowing(Boolean(status.following));
      setFollowerCount(Number(status.followerCount || 0));
    } catch (err) { setError(err.message || (isFa ? "درخواست انجام نشد." : "Request failed.")); }
    finally { setFollowBusy(false); }
  };

  useEffect(() => {
    if (loading) return undefined;

    const timer = window.setTimeout(() => {
      if (teacher) {
        const canonicalPath = buildTeacherPath(teacher);
        const teacherName = normalizeTeacherSeoText(teacher.name) ||
          (isFa ? "مدرس ایجوتک" : "EduTech Teacher");
        const professionalTitle = normalizeTeacherSeoText(
          teacher.professionalTitle || teacher.headline || teacher.specialty,
        );
        const fallbackDescription = isFa
          ? `پروفایل، تخصص و دوره‌های ${teacherName} را در ایجوتک ببینید.`
          : `View ${teacherName}'s profile, expertise, and courses at EduTech Academy.`;
        const description = truncateTeacherSeoText(
          teacher.bio || professionalTitle || fallbackDescription,
          160,
        );

        applySeo({
          pathname: `/teacher/${id}`,
          language: isFa ? "fa" : "en",
          overrides: {
            canonicalPath,
            title: `${teacherName} | ${isFa ? "مدرس ایجوتک" : "EduTech Teacher"}`,
            description,
            image: teacher.avatar || "/logo.png",
            imageAlt: teacherName,
            keywords: [
              teacherName,
              professionalTitle,
              ...(Array.isArray(teacher.skills) ? teacher.skills : []),
            ].filter(Boolean),
            robots: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
            shouldIndex: true,
          },
          additionalStructuredData: [
            {
              "@type": "Person",
              name: teacherName,
              description,
              image: teacher.avatar || undefined,
              jobTitle: professionalTitle || undefined,
              url: `https://edutech.study${canonicalPath}`,
              worksFor: {
                "@type": "EducationalOrganization",
                name: "EduTech Academy",
                url: "https://edutech.study",
              },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: isFa ? "خانه" : "Home",
                  item: "https://edutech.study/",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: isFa ? "مدرسان" : "Teachers",
                  item: "https://edutech.study/teachers",
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: teacherName,
                  item: `https://edutech.study${canonicalPath}`,
                },
              ],
            },
          ],
        });
        return;
      }

      if (!teacher) {
        applySeo({
          pathname: `/teacher/${id}`,
          language: isFa ? "fa" : "en",
          overrides: {
            title: notFound
              ? isFa
                ? "استاد یافت نشد | ایجوتک"
                : "Teacher Not Found | EduTech"
              : isFa
                ? "پروفایل استاد در دسترس نیست | ایجوتک"
                : "Teacher Profile Unavailable | EduTech",
            description: notFound
              ? isFa
                ? "این پروفایل مدرس وجود ندارد یا دیگر در ایجوتک منتشر نیست."
                : "This teacher profile does not exist or is no longer published on EduTech."
              : isFa
                ? "این پروفایل مدرس در حال حاضر در دسترس نیست."
                : "This teacher profile is temporarily unavailable.",
            robots: "noindex, nofollow",
            shouldIndex: false,
          },
        });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [id, isFa, loading, notFound, teacher]);

  useEffect(() => {
    let mounted = true;

    const loadEnrollments = async () => {
      if (localStorage.getItem("edutech_auth") !== "true") {
        setEnrolledCourseIds(new Set());
        return;
      }

      try {
        const rows = await fetchStudentEnrollments();
        if (!mounted) return;

        const nextIds = new Set();
        rows.forEach((enrollment) => {
          if (!hasActiveEnrollmentAccess(enrollment)) return;
          const courseId = resolveCourseId(enrollment?.courseId);
          if (courseId) nextIds.add(courseId);
        });
        setEnrolledCourseIds(nextIds);
      } catch (err) {
        if (!mounted) return;
        if (isUnauthorizedError(err)) {
          setEnrolledCourseIds(new Set());
          return;
        }
        setEnrolledCourseIds(new Set());
      }
    };

    loadEnrollments();

    const handleDataChanged = () => {
      loadEnrollments();
    };

    window.addEventListener("edutech_data_changed", handleDataChanged);

    return () => {
      mounted = false;
      window.removeEventListener("edutech_data_changed", handleDataChanged);
    };
  }, []);

  const data = useMemo(() => {
    if (!teacher) return baseData;

    const locale = isFa ? "fa-AF" : "en-US";
    const numberFormatter = new Intl.NumberFormat(locale);
    const levelLabel = (level) => {
      if (!isFa) {
        if (level === "beginner") return "Beginner";
        if (level === "intermediate") return "Intermediate";
        if (level === "advanced") return "Advanced";
        return "All Levels";
      }
      if (level === "beginner") return "مبتدی";
      if (level === "intermediate") return "متوسط";
      if (level === "advanced") return "پیشرفته";
      return "همه سطوح";
    };

    const normalizeList = (rows = []) =>
      [...new Set((Array.isArray(rows) ? rows : []).map((item) => String(item || "").trim()).filter(Boolean))];
    const hiddenSkillValues = new Set([
      "wwws",
      "intermediate",
      "beginner",
      "advanced",
      "english",
      "مبتدی",
      "متوسط",
      "پیشرفته",
    ]);
    const isDisplayableSkillValue = (value = "") => {
      const normalized = String(value || "").trim();
      if (!normalized) return false;
      if (hiddenSkillValues.has(normalized.toLowerCase())) return false;
      if (normalized.startsWith("/uploads/")) return false;
      if (/^https?:\/\//i.test(normalized)) return false;
      if (/\.pdf($|\?)/i.test(normalized)) return false;
      return true;
    };

    const teacherApplication = teacher?.teacherApplication || {};
    const appStatus = String(teacherApplication?.status || "").toLowerCase();
    const formProfessionalTitle = String(teacherApplication?.professionalTitle || "").trim();
    const formEducation = String(teacherApplication?.education || "").trim();
    const formIntroVideoUrl = String(teacherApplication?.introVideoUrl || "").trim();
    const formCourseIntroVideoUrls = normalizeList(
      teacherApplication?.courseIntroVideoUrls || [],
    ).slice(0, 8);
    const rawYearsExperience = Number(teacherApplication?.yearsExperience);
    const formYearsExperience = Number.isFinite(rawYearsExperience)
      ? Math.max(0, Math.round(rawYearsExperience))
      : 0;
    const formExpertiseAreas = normalizeList(teacherApplication?.expertiseAreas || []);
    const formCertifications = normalizeList(teacherApplication?.certifications || []);
    const formLanguages = normalizeList(teacherApplication?.languages || []);
    const formSkillRatings = (Array.isArray(teacherApplication?.skillRatings)
      ? teacherApplication.skillRatings
      : [])
      .map((item) => ({
        name: String(item?.name || "").trim(),
        percentage: Math.max(0, Math.min(100, Math.round(Number(item?.percentage || 0)))),
      }))
      .filter((item) => item.name && Number.isFinite(item.percentage));

    const publishedCourses = Array.isArray(teacher.publishedCourses)
      ? teacher.publishedCourses.filter((course) => !course?.classEndedAt)
      : [];
    const endedCourses = Array.isArray(teacher.endedCourses) ? teacher.endedCourses : [];

    const mappedCourses = publishedCourses.map((course) => {
      const maxStudents = Number(course.maxStudents || 0);
      const enrolled = Number(course.enrolledStudentsCount || 0);
      const remaining = Math.max(0, maxStudents - enrolled);

      return {
        ...course,
        _id: course._id || course.id,
        id: course.id || course._id,
        maxStudents,
        enrolledStudentsCount: enrolled,
        seats: maxStudents > 0 ? `${numberFormatter.format(remaining)} / ${numberFormatter.format(maxStudents)}` : numberFormatter.format(remaining),
        rating: Number(course.rating || 0),
        ratingCount: Math.max(0, Number(course.ratingCount || 0)),
        teacherId: String(teacher?._id || teacherIdParam || ""),
        teacher: teacher?.name || (isFa ? "مدرس" : "Instructor"),
        teacherName: teacher?.name || (isFa ? "مدرس" : "Instructor"),
        teacherAvatar: teacher?.avatar || "",
        liveLabel: isFa ? "آنلاین" : "Live",
        btnRegister: isFa ? "ثبت نام" : "Register",
        btnDetails: isFa ? "مشاهده جزئیات" : "View Details",
      };
    });

    const scheduleRows = publishedCourses
      .flatMap((course) =>
        (Array.isArray(course.scheduleRows) ? course.scheduleRows : []).map((slot) => ({
          day: slot?.day || "-",
          course: course.title || "-",
          time: `${slot?.startTime || "-"} - ${slot?.endTime || "-"}`,
          status: isFa ? "پیش‌رو" : "Upcoming",
        })),
      )
      .slice(0, 12);

    const languages = [
      ...new Set(publishedCourses.map((course) => course.language).filter(Boolean)),
    ];
    const meetingTypes = [
      ...new Set(publishedCourses.map((course) => getMeetingTypeLabel(course.meetingType, isFa)).filter(Boolean)),
    ];
    const teacherLanguages = normalizeList([...formLanguages, ...languages]);
    const totalCourses = Math.max(1, publishedCourses.length);

    const levelCounts = publishedCourses.reduce((acc, course) => {
      const key = levelLabel(course.level);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const languageCounts = publishedCourses.reduce((acc, course) => {
      const key = course.language;
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const meetingCounts = publishedCourses.reduce((acc, course) => {
      const key = getMeetingTypeLabel(course.meetingType, isFa);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const progressFromMap = (inputMap) =>
      Object.entries(inputMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
          name,
          percentage: Math.max(10, Math.round((count / totalCourses) * 100)),
        }))
        .filter((item) => isDisplayableSkillValue(item.name));

    const backendProgressSkills = [
      ...progressFromMap(levelCounts),
      ...progressFromMap(languageCounts),
      ...progressFromMap(meetingCounts),
    ]
      .filter((item, idx, arr) => arr.findIndex((row) => row.name === item.name) === idx)
      .slice(0, 4);
    const teacherDefinedProgressSkills = formSkillRatings
      .filter((item) => isDisplayableSkillValue(item.name))
      .slice(0, 12);

    const backendTeachingStyles = isFa
      ? [
          {
            title: "تحصیلات",
            text: formEducation || "معلومات موجود نیست",
          },
          {
            title: "حوزه تخصص",
            text: formExpertiseAreas.length ? formExpertiseAreas.join("، ") : "معلومات موجود نیست",
          },
          {
            title: "تجربه تدریس",
            text: formYearsExperience > 0 ? `${numberFormatter.format(formYearsExperience)} سال` : "معلومات موجود نیست",
          },
          {
            title: "زبان‌های تدریس",
            text: teacherLanguages.length ? teacherLanguages.join("، ") : "معلومات موجود نیست",
          },
        ]
      : [
          {
            title: "Education",
            text: formEducation || "Not available",
          },
          {
            title: "Expertise Areas",
            text: formExpertiseAreas.length ? formExpertiseAreas.join(", ") : "Not available",
          },
          {
            title: "Teaching Experience",
            text: formYearsExperience > 0 ? `${numberFormatter.format(formYearsExperience)} years` : "Not available",
          },
          {
            title: "Teaching Languages",
            text: teacherLanguages.length ? teacherLanguages.join(", ") : "Not available",
          },
        ];

    const featuredCourse = mappedCourses[0] || baseData.sidebar.featuredCourse;
    const teacherBioText = typeof teacher.bio === "string" ? teacher.bio.trim() : "";
    const fallbackAboutFromForm = isFa
      ? [
          formProfessionalTitle ? `${teacher.name || "این استاد"} به‌عنوان ${formProfessionalTitle} فعالیت دارد.` : "",
          formEducation ? `تحصیلات: ${formEducation}.` : "",
          formExpertiseAreas.length ? `حوزه‌های تخصص: ${formExpertiseAreas.join("، ")}.` : "",
          `سابقه تدریس: ${numberFormatter.format(formYearsExperience)} سال.`,
        ]
          .filter(Boolean)
          .join(" ")
      : [
          formProfessionalTitle ? `${teacher.name || "This teacher"} works as ${formProfessionalTitle}.` : "",
          formEducation ? `Education: ${formEducation}.` : "",
          formExpertiseAreas.length ? `Expertise areas: ${formExpertiseAreas.join(", ")}.` : "",
          `Teaching experience: ${numberFormatter.format(formYearsExperience)} years.`,
        ]
          .filter(Boolean)
          .join(" ");
    const fallbackBioText = isFa
      ? "این استاد هنوز بیوگرافی خود را ثبت نکرده است."
      : "This teacher has not added a biography yet.";
    const resolvedBioText = teacherBioText || fallbackAboutFromForm || fallbackBioText;

    const skillBadges = normalizeList([
      ...formExpertiseAreas,
      ...teacherLanguages,
      ...formCertifications,
      ...teacherDefinedProgressSkills.map((item) => item.name),
    ])
      .filter((item) => isDisplayableSkillValue(item))
      .slice(0, 20);

    const dynamicFaqs = isFa
      ? [
          {
            q: "این استاد چه زبان‌هایی را تدریس می‌کند؟",
            a: teacherLanguages.length
              ? `زبان‌های تدریس: ${teacherLanguages.join("، ")}.`
              : "زبان‌های تدریس هنوز ثبت نشده است.",
          },
          {
            q: "تجربه و تحصیلات استاد چگونه است؟",
            a: `${formEducation ? `تحصیلات: ${formEducation}. ` : ""}سابقه تدریس: ${numberFormatter.format(formYearsExperience)} سال.`,
          },
          {
            q: "چند کورس و چند شاگرد فعال دارد؟",
            a: `${numberFormatter.format(Number(teacher.publishedCoursesCount || 0))} کورس منتشرشده و ${numberFormatter.format(Number(teacher.totalStudents || 0))} شاگرد.`,
          },
          {
            q: "حالت برگزاری صنف‌ها چگونه است؟",
            a: meetingTypes.length
              ? `صنف‌ها به این حالت‌ها برگزار می‌شود: ${meetingTypes.join("، ")}.`
              : "اطلاعات حالت تدریس هنوز ثبت نشده است.",
          },
        ]
      : [
          {
            q: "Which languages does this teacher teach?",
            a: teacherLanguages.length
              ? `Teaching languages: ${teacherLanguages.join(", ")}.`
              : "Teaching languages are not listed yet.",
          },
          {
            q: "What are the teacher's education and experience?",
            a: `${formEducation ? `Education: ${formEducation}. ` : ""}Teaching experience: ${numberFormatter.format(formYearsExperience)} years.`,
          },
          {
            q: "How many courses and students does this teacher have?",
            a: `${numberFormatter.format(Number(teacher.publishedCoursesCount || 0))} published courses and ${numberFormatter.format(Number(teacher.totalStudents || 0))} students.`,
          },
          {
            q: "How are the classes delivered?",
            a: meetingTypes.length
              ? `Classes are delivered via: ${meetingTypes.join(", ")}.`
              : "Teaching mode information is not available yet.",
          },
        ];

    return {
      ...baseData,
      breadcrumbs: [baseData.breadcrumbs[0], baseData.breadcrumbs[1], teacher.name || baseData.breadcrumbs[2]],
      hero: {
        ...baseData.hero,
        name: teacher.name || baseData.hero.name,
        role:
          formProfessionalTitle ||
          (isFa ? "استاد" : "Instructor"),
        bio: resolvedBioText,
        avatar: teacher.avatar || "",
        introVideoUrl: formIntroVideoUrl,
        courseIntroVideoUrls: formCourseIntroVideoUrls,
        socialLinks: teacher.socialLinks || {},
        teacherId: String(teacher._id || teacherIdParam),
        profilePath: buildTeacherPath({
          _id: teacher._id || teacherIdParam,
          name: teacher.name,
        }),
      },
      stats: [
        {
          label: baseData.stats[0].label,
          value: Number(teacher.ratingCount || 0) > 0
            ? Number(teacher.rating || 0).toFixed(1)
            : isFa
              ? "هنوز امتیازی نیست"
              : "No ratings yet",
        },
        { label: baseData.stats[1].label, value: numberFormatter.format(Number(teacher.totalStudents || 0)) },
        { label: baseData.stats[2].label, value: numberFormatter.format(Number(teacher.publishedCoursesCount || 0)) },
        { label: baseData.stats[3].label, value: numberFormatter.format(formYearsExperience) },
      ],
      sections: {
        ...baseData.sections,
        aboutText: resolvedBioText,
        teachingStyles:
          publishedCourses.length || Number(teacher.totalStudents || 0)
            ? backendTeachingStyles
            : baseData.sections.teachingStyles,
        progressSkills: teacherDefinedProgressSkills.length
          ? teacherDefinedProgressSkills
          : backendProgressSkills.length
            ? backendProgressSkills
            : baseData.sections.progressSkills,
        skills: skillBadges.length ? skillBadges : baseData.sections.skills,
        reviews: Array.isArray(teacher.reviews) ? teacher.reviews : [],
        courses: mappedCourses,
        endedCourses: endedCourses.map((course) => ({
          ...course,
          _id: course._id || course.id,
          id: course.id || course._id,
          teacher: teacher?.name || (isFa ? "مدرس" : "Instructor"),
          teacherName: teacher?.name || (isFa ? "مدرس" : "Instructor"),
          teacherAvatar: teacher?.avatar || "",
        })),
        schedule: scheduleRows,
        faqs: dynamicFaqs.length ? dynamicFaqs : baseData.sections.faqs,
      },
      sidebar: {
        ...baseData.sidebar,
        quickInfo: isFa
          ? [
              { label: "زبان", value: teacherLanguages.length ? teacherLanguages.join("، ") : "فارسی، انگلیسی" },
              { label: "حالت تدریس", value: meetingTypes.length ? meetingTypes.join("، ") : "آنلاین" },
              { label: "پلتفرم", value: meetingTypes.includes("Google Meet") ? "Google Meet" : (meetingTypes[0] || "Google Meet") },
              { label: "تجربه", value: `${numberFormatter.format(formYearsExperience)} سال` },
            ]
          : [
              { label: "Language", value: teacherLanguages.length ? teacherLanguages.join(", ") : "Persian, English" },
              { label: "Teaching Mode", value: meetingTypes.length ? meetingTypes.join(", ") : "Live Online" },
              { label: "Platform", value: meetingTypes.includes("Google Meet") ? "Google Meet" : (meetingTypes[0] || "Google Meet") },
              { label: "Experience", value: `${numberFormatter.format(formYearsExperience)} years` },
            ],
        featuredCourse,
        teacherApplicationStatus: appStatus,
      },
    };
  }, [teacher, baseData, isFa, teacherIdParam]);

  useEffect(() => {
    const panelCount = Array.isArray(data.tabs) ? data.tabs.length : 0;
    if (activeTab > panelCount - 1) {
      const timer = window.setTimeout(
        () => setActiveTab(Math.max(0, panelCount - 1)),
        0,
      );
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [data.tabs, activeTab]);

  useEffect(() => {
    const el = panelRefs.current[activeTab];
    if (!el) return;

    const checkOverflow = () => {
      const hasOverflow = el.scrollHeight > PANEL_COLLAPSED_HEIGHT + 2;
      setPanelOverflow((prev) =>
        prev[activeTab] === hasOverflow ? prev : { ...prev, [activeTab]: hasOverflow },
      );
    };

    checkOverflow();

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);

    return () => observer.disconnect();
  }, [activeTab, data, expandedPanels]);

  const introVideoUrl = String(data?.hero?.introVideoUrl || "").trim();
  const introVideoEmbedUrl = getYouTubeEmbedUrl(introVideoUrl);
  const courseIntroVideos = (Array.isArray(data?.hero?.courseIntroVideoUrls)
    ? data.hero.courseIntroVideoUrls
    : []
  )
    .map((url) => ({ url: String(url || "").trim(), embedUrl: getYouTubeEmbedUrl(url) }))
    .filter((video) => video.url && video.embedUrl)
    .filter(
      (video, index, rows) =>
        rows.findIndex((row) => row.embedUrl === video.embedUrl) === index,
    )
    .slice(0, 8);
  const getRowNavState = useCallback((rowElement) => {
    if (!rowElement) return { canPrev: false, canNext: false };
    const maxScroll = Math.max(0, rowElement.scrollWidth - rowElement.clientWidth);
    if (dir === "rtl") {
      const progress = Math.min(maxScroll, Math.abs(rowElement.scrollLeft || 0));
      return {
        canPrev: progress > 8,
        canNext: progress < maxScroll - 8,
      };
    }

    const progress = rowElement.scrollLeft || 0;
    return {
      canPrev: progress > 8,
      canNext: progress < maxScroll - 8,
    };
  }, [dir]);
  const updateSectionRowNav = useCallback((key, rowElement) => {
    const nextState = getRowNavState(rowElement);
    setSectionRowNav((previous) => {
      const current = previous[key];
      if (current?.canPrev === nextState.canPrev && current?.canNext === nextState.canNext) {
        return previous;
      }
      return { ...previous, [key]: nextState };
    });
  }, [getRowNavState]);
  const scrollRowForward = (key) => {
    const rowElement = sectionRowRefs.current[key];
    if (!rowElement) return;
    const scrollAmount = Math.max(320, Math.round(rowElement.clientWidth * 0.82));
    rowElement.scrollBy({
      left: dir === "rtl" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };
  const scrollRowBackward = (key) => {
    const rowElement = sectionRowRefs.current[key];
    if (!rowElement) return;
    const scrollAmount = Math.max(320, Math.round(rowElement.clientWidth * 0.82));
    rowElement.scrollBy({
      left: dir === "rtl" ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    ["featured-courses", "ended-courses"].forEach((key) => {
      const element = sectionRowRefs.current[key];
      if (element) {
        updateSectionRowNav(key, element);
      }
    });
  }, [data.sections.courses, data.sections.endedCourses, dir, updateSectionRowNav]);

  const renderPanel = (panelKey, content) => {
    const isExpanded = Boolean(expandedPanels[panelKey]);
    const hasOverflow = Boolean(panelOverflow[panelKey]);

    return (
      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.05)] md:p-8 animate-in fade-in duration-300">
        <div
          ref={(el) => {
            panelRefs.current[panelKey] = el;
          }}
          className={`relative ${isExpanded ? "" : "max-h-[580px] overflow-hidden"}`}
        >
          {content}
          {!isExpanded && hasOverflow ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
          ) : null}
        </div>

        {hasOverflow ? (
          <button
            className="mt-5 flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-primary-200 hover:text-primary-700"
            onClick={() =>
              setExpandedPanels((prev) => ({
                ...prev,
                [panelKey]: !prev[panelKey],
              }))
            }
          >
            {isExpanded ? (isFa ? "بستن" : "Collapse") : isFa ? "ادامه مطلب" : "Read more"}
          </button>
        ) : null}
      </section>
    );
  };

  if (loading && !teacher) {
    return (
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          <FrontendPageLoader
            label={isFa ? "در حال دریافت معلومات استاد" : "Loading teacher details"}
          />
        </div>
      </section>
    );
  }

  if (error && !teacher) {
    return (
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-lg font-black text-rose-600">{error}</p>
          <Link
            to="/teachers"
            className="mt-4 inline-flex rounded-lg bg-primary-600 px-5 py-3 text-sm font-black text-white"
          >
            {isFa ? "بازگشت به مدرسان" : "Back to teachers"}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div
      className="min-h-screen bg-slate-50 pb-16 pt-8 font-sans text-slate-900"
      dir={dir}
    >
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <nav className={`mb-6 px-1 sm:px-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500 ${isFa ? "justify-start" : "justify-start"}`}>
          {data.breadcrumbs.map((crumb, index) => {
            const isLast = index === data.breadcrumbs.length - 1;
            const crumbHref = index === 0 ? "/" : index === 1 ? "/teachers" : "";
            return (
              <div className="flex items-center gap-2" key={index}>
                {isLast ? (
                  <span className="text-slate-900">{crumb}</span>
                ) : (
                  <Link className="transition hover:text-primary-700" to={crumbHref}>
                    {crumb}
                  </Link>
                )}
                {!isLast && <span>/</span>}
              </div>
            );
          })}
        </nav>

        <TeacherHero data={data.hero} dir={dir} following={following} followerCount={followerCount ?? Number(teacher?.followerCount || 0)} followBusy={followBusy} onToggleFollow={handleToggleFollow} />

        {introVideoUrl ? (
          <section className="mt-6 overflow-hidden rounded-[28px] border border-primary-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="bg-slate-950">
                {introVideoEmbedUrl ? (
                  <iframe
                    className="aspect-video h-full min-h-[240px] w-full"
                    src={introVideoEmbedUrl}
                    title={isFa ? "ویدیوی معرفی مدرس" : "Teacher introduction video"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex aspect-video min-h-[240px] items-center justify-center bg-slate-900 p-6 text-center text-sm font-bold text-white">
                    {isFa ? "پیش‌نمایش ویدیو در دسترس نیست." : "Video preview is not available."}
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center p-6 lg:p-8">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                  <PlayCircle size={26} />
                </div>
                <h2 className="text-2xl font-black text-slate-950">
                  {isFa ? "با مدرس بیشتر آشنا شوید" : "Meet Your Teacher"}
                </h2>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                  {isFa
                    ? "این ویدیوی معرفی توسط مدرس اضافه شده تا قبل از انتخاب کورس، روش تدریس، شخصیت و تجربه او را بهتر بشناسید."
                    : "This intro video was added by the teacher so you can understand their teaching style, personality, and experience before joining a course."}
                </p>
                <a
                  href={introVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex h-11 w-fit items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-black text-white transition hover:bg-primary-700"
                >
                  <ExternalLink size={16} />
                  {isFa ? "باز کردن در YouTube" : "Open on YouTube"}
                </a>
              </div>
            </div>
          </section>
        ) : null}

        {courseIntroVideos.length ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950 md:text-3xl">
                  {isFa
                    ? "ویدیوهای معرفی کورس در یوتیوب"
                    : "Course Introduction Videos on YouTube"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-600">
                  {isFa
                    ? "پیش از انتخاب کورس، ویدیوهای معرفی مدرس را ببینید و با محتوای کورس و شیوه تدریس آشنا شوید."
                    : "Watch the teacher's introductions before choosing a course and get familiar with its content and teaching style."}
                </p>
              </div>
              <span className="text-xs font-black text-primary-700">
                {isFa
                  ? `${courseIntroVideos.length.toLocaleString("fa-AF")} ویدیو`
                  : `${courseIntroVideos.length} ${courseIntroVideos.length === 1 ? "video" : "videos"}`}
              </span>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {courseIntroVideos.map((video, index) => (
                <article
                  key={video.embedUrl}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                >
                  <iframe
                    className="aspect-video w-full bg-slate-950"
                    src={video.embedUrl}
                    title={
                      isFa
                        ? `ویدیوی معرفی کورس ${index + 1}`
                        : `Course introduction video ${index + 1}`
                    }
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                  <div className="flex items-center justify-between gap-3 p-4">
                    <p className="text-sm font-black text-slate-900">
                      {isFa ? `معرفی کورس ${index + 1}` : `Course Introduction ${index + 1}`}
                    </p>
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-primary-300 hover:text-primary-700"
                    >
                      <ExternalLink size={15} />
                      YouTube
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-6">
          <div className="flex min-w-0 flex-col gap-6">
            <TeacherStats stats={data.stats} />

            <section className="order-3 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black text-teal-700">{isFa ? "آموزش و تجربه" : "Teaching and insights"}</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{isFa ? "محتوای منتشرشده استاد" : "Published by this teacher"}</h2>
                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-slate-500">
                    {isFa ? "تازه‌ترین ویدیوها و مقاله‌هایی که این استاد در ایجوتک منتشر کرده است." : "The latest videos and articles this teacher has published on EduTech."}
                  </p>
                </div>
                <div className="flex gap-2 text-xs font-black">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-2 text-rose-700"><Video size={14} />{pageNumberFormatter.format(teacherContent.videoTotal)} {isFa ? "ویدیو" : teacherContent.videoTotal === 1 ? "video" : "videos"}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-2 text-primary-700"><BookOpen size={14} />{pageNumberFormatter.format(teacherContent.articleTotal)} {isFa ? "مقاله" : teacherContent.articleTotal === 1 ? "article" : "articles"}</span>
                </div>
              </div>

              {teacherContentLoading ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((item) => <div key={item} className="overflow-hidden rounded-2xl border border-slate-100"><div className="aspect-video animate-pulse bg-slate-100" /><div className="space-y-2 p-4"><div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" /><div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" /></div></div>)}
                </div>
              ) : teacherContent.videos.length || teacherContent.articles.length ? (
                <div className="mt-6 space-y-7">
                  {teacherContent.videos.length ? (
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="inline-flex items-center gap-2 text-base font-black text-slate-950"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-600"><Video size={18} /></span>{isFa ? "ویدیوهای استاد" : "Teacher videos"}</h3>
                        <Link to="/videos" className="inline-flex items-center gap-1 text-xs font-black text-primary-700 transition hover:text-primary-600">{isFa ? "صفحه ویدیوها" : "Video library"}{isFa ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}</Link>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {teacherContent.videos.map((video) => (
                          <Link key={video._id} to={`/videos?video=${encodeURIComponent(video._id)}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg">
                            <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-white via-blue-50 to-cyan-50">
                              <img src={video.thumbnailUrl || "/logo.png"} alt={video.title} loading="lazy" onError={(event) => { event.currentTarget.src = "/logo.png"; event.currentTarget.className = "h-full w-full object-contain p-8"; }} className={`h-full w-full transition duration-500 group-hover:scale-[1.03] ${video.thumbnailUrl ? "object-cover" : "object-contain p-8"}`} />
                              <span className="absolute inset-0 grid place-items-center bg-slate-950/10 transition group-hover:bg-slate-950/20"><span className="grid h-12 w-12 place-items-center rounded-full bg-white/95 text-primary-700 shadow-lg"><PlayCircle size={24} /></span></span>
                              <span className={`absolute start-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black text-white ${video.platform === "instagram" ? "bg-fuchsia-600" : "bg-rose-600"}`}>{video.platform === "instagram" ? "Instagram" : "YouTube"}</span>
                            </div>
                            <div className="p-4"><h4 className="line-clamp-2 text-sm font-black leading-6 text-slate-950">{video.title}</h4><div className="mt-3 flex items-center justify-between text-[11px] font-bold text-slate-400"><span>{formatContentDate(video.createdAt, isFa)}</span><span>{pageNumberFormatter.format(Number(video.likeCount || 0))} {isFa ? "پسند" : "likes"}</span></div></div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {teacherContent.articles.length ? (
                    <div className={teacherContent.videos.length ? "border-t border-slate-100 pt-7" : ""}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="inline-flex items-center gap-2 text-base font-black text-slate-950"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-50 text-primary-700"><BookOpen size={18} /></span>{isFa ? "مقاله‌های استاد" : "Teacher articles"}</h3>
                        <Link to="/blog" className="inline-flex items-center gap-1 text-xs font-black text-primary-700 transition hover:text-primary-600">{isFa ? "صفحه مقاله‌ها" : "Article library"}{isFa ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}</Link>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {teacherContent.articles.map((article) => {
                          const articleTitle = localizedArticleText(article.title, isFa ? "fa" : "en");
                          const coverImage = resolveArticleCoverUrl(article.coverImage);
                          return (
                            <Link key={article._id} to={`/blog/${article.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg">
                              <div className="aspect-video overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50"><img src={coverImage || "/logo.png"} alt={articleTitle} loading="lazy" onError={(event) => { event.currentTarget.src = "/logo.png"; event.currentTarget.className = "h-full w-full object-contain p-8"; }} className={`h-full w-full transition duration-500 group-hover:scale-[1.03] ${coverImage ? "object-cover" : "object-contain p-8"}`} /></div>
                              <div className="flex flex-1 flex-col p-4"><h4 className="line-clamp-2 text-sm font-black leading-6 text-slate-950">{articleTitle}</h4><div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-[11px] font-bold text-slate-400"><span className="inline-flex items-center gap-1"><Clock3 size={13} />{pageNumberFormatter.format(Number(article.estimatedReadMinutes || 1))} {isFa ? "دقیقه" : "min"}</span><span className="inline-flex items-center gap-1"><Eye size={13} />{pageNumberFormatter.format(Number(article.viewCount || 0))}</span></div></div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center"><BookOpen className="mx-auto text-slate-300" size={36} /><p className="mt-3 text-sm font-bold text-slate-500">{isFa ? "این استاد هنوز ویدیو یا مقاله‌ای منتشر نکرده است." : "This teacher has not published any videos or articles yet."}</p></div>
              )}
            </section>

            {/* Tabs */}
            <div className="order-1 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="flex gap-2 overflow-x-auto px-4 border-b border-slate-100 scrollbar-hide">
                {data.tabs.map((tab, idx) => {
                  const TabIcon = tabIcons[idx] || UserRound;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(idx)}
                      aria-current={activeTab === idx ? "page" : undefined}
                      className={`inline-flex shrink-0 items-center gap-2 px-5 py-4 text-sm font-black transition-colors ${
                        activeTab === idx
                          ? "border-b-2 border-primary-600 text-primary-700"
                          : "text-slate-600 hover:text-primary-700"
                      }`}
                    >
                      <TabIcon size={16} />
                      {tab}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Contents */}
            <div className="order-2">
            {activeTab === 0 && (
              renderPanel(0, (
                <>
                <h2 className="text-2xl font-black text-slate-950">
                  {data.sections.aboutTitle}
                </h2>
                <p className="mt-4 break-words [overflow-wrap:anywhere] text-justify font-medium leading-8 text-slate-600">
                  {data.sections.aboutText}
                </p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {data.sections.teachingStyles.map((style, idx) => {
                    const icons = [MessageCircle, UsersRound, Smile, LineChart];
                    const Icon = icons[idx];
                    return (
                      <div
                        className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-5 transition hover:border-teal-200 hover:bg-teal-50/50"
                        key={idx}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-teal-600 shadow-sm">
                          <Icon size={20} />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900">
                            {style.title}
                          </h4>
                          <p className="mt-2 text-sm font-semibold text-slate-600 leading-6">
                            {style.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
              ))
            )}

            {activeTab === 1 && (
              renderPanel(2, (
                <>
                <h2 className="text-2xl font-black text-slate-950">
                  {data.sections.skillsTitle}
                </h2>
                <div className="mt-8 space-y-6">
                  {data.sections.progressSkills.map((skill, idx) => (
                    <ProgressSkill
                      dir={dir}
                      key={idx}
                      name={skill.name}
                      percentage={skill.percentage}
                    />
                  ))}
                </div>
                {data.sections.skills?.length ? (
                  <div className="mt-8">
                    <div className="flex flex-wrap gap-3">
                      {data.sections.skills.map((skill, idx) => (
                        <SkillBadge key={idx} skill={skill} />
                      ))}
                    </div>
                  </div>
                ) : null}
                </>
              ))
            )}

            {activeTab === 2 && (
              renderPanel(3, (
                <>
                <h2 className="text-2xl font-black text-slate-950">
                  {data.sections.scheduleTitle}
                </h2>
                {data.sections.schedule.length > 0 ? <><div className="mt-6">
                  <TeacherScheduleTable
                    labels={data.sections.scheduleLabels}
                    schedule={data.sections.schedule}
                  />
                </div>
                <p className="mt-4 flex items-center gap-3 rounded-xl bg-primary-50 p-4 text-sm font-semibold leading-7 text-primary-800">
                  <Info className="shrink-0" size={18} />
                  {data.sections.scheduleNote}
                </p></> : <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center"><CalendarDays className="mx-auto text-slate-300" size={38} /><p className="mt-3 text-sm font-bold text-slate-500">{isFa ? "تقسیم اوقات این استاد هنوز منتشر نشده است." : "This teacher has not published a schedule yet."}</p></div>}
                </>
              ))
            )}

            {activeTab === 3 && (
              renderPanel(4, (
                <>
                <h2 className="mb-6 text-2xl font-black text-slate-950">
                  {data.sections.faqTitle}
                </h2>
                <div className="space-y-3">
                  {data.sections.faqs.map((faq, idx) => (
                    <FAQAccordion answer={faq.a} key={idx} question={faq.q} />
                  ))}
                </div>
                </>
              ))
            )}
            </div>
          </div>

        </div>

        <section id="teacher-courses" className="mt-6 scroll-mt-24 rounded-[24px] border border-primary-100 bg-primary-50 p-6 shadow-[0_12px_35px_rgba(15,23,42,0.05)] md:p-8">
          <h2 className="text-2xl font-black text-slate-950">
            {data.sections.coursesTitle}
          </h2>

          {!data.sections.courses?.length ? (
            <p className="mt-4 rounded-xl bg-white p-4 text-sm font-semibold text-slate-600">
              {isFa
                ? "این استاد فعلاً کورس منتشرشده ندارد."
                : "This teacher has no published courses yet."}
            </p>
          ) : (
            <div className="relative mt-6">
              <div
                ref={(element) => {
                  sectionRowRefs.current["featured-courses"] = element;
                }}
                onScroll={(event) => updateSectionRowNav("featured-courses", event.currentTarget)}
                className="edutech-scrollbar flex gap-4 overflow-x-auto px-2 pb-2 sm:gap-5"
                dir={dir}
              >
                {data.sections.courses.map((course, index) => (
                  <div
                    key={course._id || course.id || course.slug || `${course.title}-${index}`}
                    className="w-[calc(100vw-5.5rem)] min-w-[calc(100vw-5.5rem)] shrink-0 sm:w-[min(84vw,360px)] sm:min-w-[min(84vw,360px)]"
                  >
                    <CourseCard
                      course={course}
                      dir={dir}
                      isEnrolled={enrolledCourseIds.has(resolveCourseId(course))}
                      language={isFa ? "fa" : "en"}
                      labels={courseCardLabels}
                    />
                  </div>
                ))}
              </div>
              {sectionRowNav["featured-courses"]?.canPrev ? (
                <button
                  type="button"
                  onClick={() => scrollRowBackward("featured-courses")}
                  className="absolute start-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.14)] transition hover:border-violet-200 hover:text-violet-700"
                  aria-label={isFa ? "نمایش موارد قبلی" : "Show previous items"}
                >
                  <ChevronLeft size={18} className={dir === "rtl" ? "rotate-180" : ""} />
                </button>
              ) : null}
              {sectionRowNav["featured-courses"]?.canNext ? (
                <button
                  type="button"
                  onClick={() => scrollRowForward("featured-courses")}
                  className="absolute end-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.14)] transition hover:border-violet-200 hover:text-violet-700"
                  aria-label={isFa ? "نمایش موارد بعدی" : "Show next items"}
                >
                  <ChevronRight size={18} className={dir === "rtl" ? "rotate-180" : ""} />
                </button>
              ) : null}
            </div>
          )}
        </section>

        {data.sections.endedCourses?.length ? <section className="mt-6 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-slate-950">
              {data.sections.endedCoursesTitle}
            </h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
              {pageNumberFormatter.format(Array.isArray(data.sections.endedCourses) ? data.sections.endedCourses.length : 0)}
            </span>
          </div>

          {!data.sections.endedCourses?.length ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              {data.sections.endedCoursesEmpty}
            </p>
          ) : (
            <div className="relative mt-6">
              <div
                ref={(element) => {
                  sectionRowRefs.current["ended-courses"] = element;
                }}
                onScroll={(event) => updateSectionRowNav("ended-courses", event.currentTarget)}
                className="edutech-scrollbar flex gap-4 overflow-x-auto px-1 pb-2"
                dir={dir}
              >
              {data.sections.endedCourses.map((course, index) => (
                <article
                  key={course._id || course.id || course.slug || `${course.title}-${index}`}
                  className="w-[min(84vw,360px)] min-w-[min(84vw,360px)] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                >
                  <div className="aspect-[16/9] overflow-hidden bg-white">
                    <img
                      src={course.thumbnail || "/logo.png"}
                      alt={course.title || (isFa ? "کورس" : "Course")}
                      className={`h-full w-full ${
                        course.thumbnail ? "object-cover" : "object-contain p-8"
                      }`}
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800">
                        {isFa ? "پایان‌یافته" : "Ended"}
                      </span>
                      {course.level ? (
                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-black text-slate-700">
                          {course.level}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-lg font-black text-slate-950">
                      {course.title || (isFa ? "کورس بدون نام" : "Untitled course")}
                    </h3>
                    <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <span>{isFa ? "تاریخ ختم" : "Ended on"}</span>
                        <span className="text-slate-900">
                          {course.classEndedAt
                            ? new Intl.DateTimeFormat(isFa ? "fa-AF" : "en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }).format(new Date(course.classEndedAt))
                            : "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{isFa ? "شاگردان ثبت‌شده" : "Enrolled students"}</span>
                        <span className="text-slate-900">
                          {pageNumberFormatter.format(Number(course.enrolledStudentsCount || 0))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{isFa ? "اعتماد شاگردان" : "Student trust"}</span>
                        <span className="text-slate-900">
                          {Number(course.ratingCount || 0) > 0
                            ? `${Number(course.rating || 0).toFixed(1)} / 5 (${pageNumberFormatter.format(Number(course.ratingCount || 0))})`
                            : isFa
                              ? "بدون امتیاز ثبت‌شده"
                              : "No ratings yet"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{isFa ? "سطح کورس" : "Course level"}</span>
                        <span className="text-slate-900">
                          {course.level || "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{isFa ? "مجموع جلسات" : "Total sessions"}</span>
                        <span className="text-slate-900">
                          {Number(course.totalSessions || 0) > 0
                            ? pageNumberFormatter.format(Number(course.totalSessions || 0))
                            : "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{isFa ? "حالت برگزاری" : "Delivery mode"}</span>
                        <span className="text-slate-900">
                          {getMeetingTypeLabel(course.meetingType, isFa) || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              </div>
              {sectionRowNav["ended-courses"]?.canPrev ? (
                <button
                  type="button"
                  onClick={() => scrollRowBackward("ended-courses")}
                  className="absolute start-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.14)] transition hover:border-violet-200 hover:text-violet-700"
                  aria-label={isFa ? "نمایش موارد قبلی" : "Show previous items"}
                >
                  <ChevronLeft size={18} className={dir === "rtl" ? "rotate-180" : ""} />
                </button>
              ) : null}
              {sectionRowNav["ended-courses"]?.canNext ? (
                <button
                  type="button"
                  onClick={() => scrollRowForward("ended-courses")}
                  className="absolute end-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.14)] transition hover:border-violet-200 hover:text-violet-700"
                  aria-label={isFa ? "نمایش موارد بعدی" : "Show next items"}
                >
                  <ChevronRight size={18} className={dir === "rtl" ? "rotate-180" : ""} />
                </button>
              ) : null}
            </div>
          )}
        </section> : null}
      </div>
    </div>
  );
}
