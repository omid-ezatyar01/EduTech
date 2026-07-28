import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Archive,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  Languages,
  Loader2,
  PlayCircle,
  Share2,
  Star,
  UsersRound,
  Video,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  createCheckout,
  getCourseBankPaymentDetails,
  submitBankTransferPayment,
} from "../../services/paymentGateway.js";
import {
  enrollCourse,
  fetchPublishedCourseBySlug,
  getCachedPublishedCourseBySlug,
  fetchStudentEnrollments,
} from "../../services/courseService.js";
import { getLocalizedRequestErrorMessage } from "../../services/http.js";
import PaymentMethodModal from "../components/PaymentMethodModal.jsx";
import BankPaymentDetailsModal from "../components/BankPaymentDetailsModal.jsx";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";
import ReviewCard from "../components/ReviewCard.jsx";
import { calculateCourseProgressSnapshot } from "../utils/courseProgress.js";
import {
  buildCoursePath,
  buildTeacherPath,
  extractRouteIdentifier,
} from "../utils/routePaths.js";
import { buildLocalizedSiteUrl } from "../utils/localizedRoutes.js";
import { shareContent } from "../utils/share.js";
import {
  formatTimeZoneOffset,
  getDualTimeDetails,
} from "../utils/timezone.js";
import {
  canEnrollFromPublicState,
  getPublicActionLabel,
  getPublicStateLabel,
  getPublicStateMessage,
  getPublicStateTone,
} from "../utils/coursePublicState.js";
import {
  useCryptoUsdtQuoteLabel,
  useCourseRegionalPrice,
  useRegionalPricing,
} from "../context/RegionalPricingContext.jsx";
import {
  calculateHesabPayAfnAmount,
  calculateRegionalUsdAmount,
} from "../utils/checkoutPriceDisplay.js";
import { applySeo } from "../seo/useSeo.js";

function normalizeSeoText(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateSeoText(value, maxLength) {
  const normalized = normalizeSeoText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getYouTubeEmbedUrl(value = "") {
  try {
    const url = new URL(String(value || "").trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";

    if (hostname === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      if (url.pathname.startsWith("/watch")) {
        videoId = url.searchParams.get("v") || "";
      } else if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
        videoId = url.pathname.split("/").filter(Boolean)[1] || "";
      }
    }

    return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : "";
  } catch {
    return "";
  }
}

function getYouTubeThumbnailUrl(value = "") {
  const embedUrl = getYouTubeEmbedUrl(value);
  const videoId = embedUrl.split("/").filter(Boolean).at(-1) || "";
  return videoId
    ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`
    : "";
}

function extractYouTubeUrls(value = "") {
  const matches = String(value || "").match(/https?:\/\/[^\s"'<>]+/gi) || [];
  return matches
    .map((url) => url.replace(/[),.;،؛]+$/g, ""))
    .filter((url) => Boolean(getYouTubeEmbedUrl(url)));
}

function hasYouTubeUrl(value = "") {
  return extractYouTubeUrls(value).length > 0;
}

function filterDisplayList(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((item) => String(item || "").trim())
    .filter((item) => item && !hasYouTubeUrl(item));
}

function normalizePreviewVideoLinks(course = {}) {
  const rows = [
    ...(Array.isArray(course?.previewVideoUrls) ? course.previewVideoUrls : []),
    ...(course?.promoVideo ? [course.promoVideo] : []),
    ...(Array.isArray(course?.targetAudience) ? course.targetAudience : []),
    ...(Array.isArray(course?.whatYouWillLearn) ? course.whatYouWillLearn : []),
    ...(Array.isArray(course?.requirements) ? course.requirements : []),
    ...(Array.isArray(course?.curriculumTopics) ? course.curriculumTopics : []),
  ].flatMap((item) => {
    const value = String(item || "").trim();
    if (!value) return [];
    const extracted = extractYouTubeUrls(value);
    return extracted.length ? extracted : [value];
  });
  const seen = new Set();
  return rows
    .map((item) => String(item || "").trim())
    .filter((item) => {
      const embedUrl = getYouTubeEmbedUrl(item);
      const key = embedUrl || item.toLowerCase();
      if (!embedUrl || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((url) => ({
      url,
      embedUrl: getYouTubeEmbedUrl(url),
      thumbnailUrl: getYouTubeThumbnailUrl(url),
    }));
}
const COURSE_IMAGE_ASPECT_RATIO = "750 / 422";
const COURSE_IMAGE_FALLBACK = "/logo.png";
const WEEK_DAY_ORDER = [
  "saturday",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
];

function normalizeScheduleDayKey(dayValue) {
  const key = String(dayValue || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const map = {
    saturday: "saturday",
    sunday: "sunday",
    monday: "monday",
    tuesday: "tuesday",
    wednesday: "wednesday",
    thursday: "thursday",
    friday: "friday",
    شنبه: "saturday",
    یکشنبه: "sunday",
    دوشنبه: "monday",
    "سه‌شنبه": "tuesday",
    "سه شنبه": "tuesday",
    چهارشنبه: "wednesday",
    "چهار شنبه": "wednesday",
    پنجشنبه: "thursday",
    "پنج شنبه": "thursday",
    جمعه: "friday",
  };

  return map[key] || "";
}

function formatMeetingType(type, language) {
  const key = String(type || "").toLowerCase();
  const mapFa = {
    google_meet: "Google Meet",
    zoom: "Zoom",
    physical: "حضوری",
    recorded: "Google Meet",
  };
  const mapEn = {
    google_meet: "Google Meet",
    zoom: "Zoom",
    physical: "In Person",
    recorded: "Google Meet",
  };

  if (!key) return null;
  return language === "fa" ? mapFa[key] || key : mapEn[key] || key;
}

function formatLevel(level, language) {
  if (!level) return null;
  const key = String(level || "").toLowerCase();
  const mapFa = {
    beginner: "مبتدی",
    intermediate: "متوسط",
    advanced: "پیشرفته",
  };
  const mapEn = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };

  return language === "fa" ? mapFa[key] || key : mapEn[key] || key;
}

function formatCourseLanguage(languageValue, language) {
  const value = String(languageValue || "").trim();
  if (!value) return null;

  const mapFa = {
    english: "English",
    persian: "فارسی",
    pashto: "پشتو",
    arabic: "عربی",
  };
  const mapEn = {
    english: "English",
    persian: "Persian",
    pashto: "Pashto",
    arabic: "Arabic",
  };
  const key = value.toLowerCase();

  return language === "fa" ? mapFa[key] || value : mapEn[key] || value;
}

function formatStartDate(dateValue, language, fallback) {
  if (!dateValue) return fallback;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return fallback;

  if (language === "fa") {
    const formatter = new Intl.DateTimeFormat("fa-AF-u-ca-persian", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const parts = formatter.formatToParts(date);
    const partValue = (type) =>
      parts.find((part) => part.type === type)?.value || "";

    const year = partValue("year");
    const month = partValue("month");
    const day = partValue("day");
    const weekday = partValue("weekday");
    const value = `${year} ${month} ${day}، ${weekday}`.trim();
    return value || fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDayLabel(dayValue, language) {
  const key = String(dayValue || "").trim().toLowerCase();
  const map = {
    saturday: { fa: "شنبه", en: "Saturday" },
    sunday: { fa: "یکشنبه", en: "Sunday" },
    monday: { fa: "دوشنبه", en: "Monday" },
    tuesday: { fa: "سه‌شنبه", en: "Tuesday" },
    wednesday: { fa: "چهارشنبه", en: "Wednesday" },
    thursday: { fa: "پنجشنبه", en: "Thursday" },
    friday: { fa: "جمعه", en: "Friday" },
  };

  if (map[key]) {
    return language === "fa" ? map[key].fa : map[key].en;
  }

  return dayValue || "-";
}

function formatDurationLabel(durationValue, language) {
  const raw = String(durationValue || "").trim();
  if (!raw) return null;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const amount = Number(raw);
    const unitEn = amount > 1 ? "weeks" : "week";
    return language === "fa" ? `${raw} هفته` : `${raw} ${unitEn}`;
  }

  return raw;
}

function resolveCourseStartAt(course = {}) {
  if (!course?.startDate) return null;
  const date = new Date(course.startDate);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatCountdown(targetDate, nowMs, language) {
  if (!targetDate) return "";
  const diffMs = targetDate.getTime() - nowMs;
  if (diffMs <= 0) {
    return language === "fa" ? "کورس شروع شده است" : "Course has started";
  }

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const locale = language === "fa" ? "fa-AF" : "en-US";
  const formatNumber = (value) => Number(value).toLocaleString(locale);

  if (language === "fa") {
    if (days > 0) return `${formatNumber(days)} روز ${formatNumber(hours)} ساعت تا شروع`;
    if (hours > 0) return `${formatNumber(hours)} ساعت ${formatNumber(minutes)} دقیقه تا شروع`;
    return `${formatNumber(minutes)} دقیقه تا شروع`;
  }

  if (days > 0) return `${formatNumber(days)}d ${formatNumber(hours)}h until start`;
  if (hours > 0) return `${formatNumber(hours)}h ${formatNumber(minutes)}m until start`;
  return `${formatNumber(minutes)}m until start`;
}

function hasActiveEnrollmentAccess(row = {}) {
  const status = String(row?.enrollmentStatus || "").toLowerCase();
  if (!["active", "completed"].includes(status)) return false;
  if (String(row?.accessStatus || "").toLowerCase() !== "allowed") return false;
  if (!row?.accessExpiresAt) return true;
  const expiresAt = new Date(row.accessExpiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt > new Date();
}

export default function CourseDetailsPage({ t }) {
  const { id: slugParam } = useParams();
  const courseIdentifier = extractRouteIdentifier(slugParam);
  const location = useLocation();
  const navigate = useNavigate();
  const dir = t.meta.dir;
  const language = t.meta.lang === "fa" ? "fa" : "en";
  const { countryCode, rates, pricingRegion } = useRegionalPricing();
  const detail = t.courseDetail;
  const ArrowIcon = dir === "rtl" ? ArrowLeft : ArrowRight;
  const locationSearch = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const backPathCandidate = String(locationSearch.get("from") || "").trim();
  const backLabelCandidate = String(locationSearch.get("fromLabel") || "").trim();
  const breadcrumbBackPath = backPathCandidate.startsWith("/") ? backPathCandidate : "/live-courses";
  const breadcrumbBackLabel = backLabelCandidate || detail.breadcrumbs[1];
  const cachedCourse = getCachedPublishedCourseBySlug(courseIdentifier);

  const [course, setCourse] = useState(() => cachedCourse);
  const [loading, setLoading] = useState(() => !cachedCourse);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isBankDetailsModalOpen, setIsBankDetailsModalOpen] = useState(false);
  const [isBankDetailsLoading, setIsBankDetailsLoading] = useState(false);
  const [isSubmittingBankProof, setIsSubmittingBankProof] = useState(false);
  const [bankPaymentDetails, setBankPaymentDetails] = useState(null);
  const [hesabPayAmountLabel, setHesabPayAmountLabel] = useState("");
  const [cryptoPreviewLabel, setCryptoPreviewLabel] = useState("");
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [expandedDescriptionSlug, setExpandedDescriptionSlug] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [reviewSort, setReviewSort] = useState("newest");
  const [activePreviewIndex, setActivePreviewIndex] = useState(null);
  const coursePricing = useCourseRegionalPrice(course, language);
  const isCourseFree = coursePricing.isFree;
  const legacyCryptoAmountLabel = useCryptoUsdtQuoteLabel(Number(course?.price || 0), language);
  const cryptoAmountLabel =
    coursePricing.pricingType === "regional"
      ? `${language === "fa" ? "پرداخت رمزارزی:" : "Crypto payment:"} ${new Intl.NumberFormat("en-US", {
          maximumFractionDigits: 2,
        }).format(calculateRegionalUsdAmount({
          coursePricing,
          rates: { AFN: rates?.AFN, IRR: rates?.IRR },
        }))} USDT`
      : legacyCryptoAmountLabel;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 640);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadPaymentPreviewLabels = async () => {
      const rawPrice = Number(course?.price || 0);
      if (!isPaymentMethodModalOpen || isCourseFree) return;

      try {
        if (!mounted) return;
        if (coursePricing.pricingType === "regional") {
          const hesabAmount = calculateHesabPayAfnAmount({
            coursePricing,
            rates: { AFN: rates?.AFN, IRR: rates?.IRR },
            fallbackUsdPrice: rawPrice,
          });
          setHesabPayAmountLabel(
            `${language === "fa" ? "مبلغ در درگاه حساب‌پی:" : "Amount at HesabPay:"} ${new Intl.NumberFormat(
              language === "fa" ? "fa-AF" : "en-US",
              { maximumFractionDigits: 0 },
            ).format(hesabAmount)} ${language === "fa" ? "افغانی" : "AFN"}`,
          );
        } else {
          const afnRate = Number(rates?.AFN || 0);
          const hesabAmount = afnRate > 0 ? rawPrice * afnRate : 0;
          setHesabPayAmountLabel(
            `${language === "fa" ? "پرداخت کارتی:" : "Card payment:"} ${new Intl.NumberFormat(
              language === "fa" ? "fa-AF" : "en-US",
              { maximumFractionDigits: 0 },
            ).format(Number(hesabAmount || 0))} ${language === "fa" ? "افغانی" : "AFN"}`,
          );
        }

        setCryptoPreviewLabel(cryptoAmountLabel);
      } catch {
        if (!mounted) return;
        setHesabPayAmountLabel("");
        setCryptoPreviewLabel(cryptoAmountLabel);
      }
    };

    loadPaymentPreviewLabels();

    return () => {
      mounted = false;
    };
  }, [
    course?._id,
    course?.id,
    coursePricing,
    course?.price,
    cryptoAmountLabel,
    isPaymentMethodModalOpen,
    isCourseFree,
    language,
    rates?.AFN,
    rates?.IRR,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const initialCourse = getCachedPublishedCourseBySlug(courseIdentifier);
        if (initialCourse) {
          setCourse(initialCourse);
          setLoading(false);
        } else {
          setCourse(null);
          setLoading(true);
        }
        setError("");
        setNotFound(false);

        let loadedCourse = initialCourse;
        try {
          const freshCourse = await fetchPublishedCourseBySlug(courseIdentifier, {
            force: Boolean(initialCourse),
          });
          if (freshCourse) loadedCourse = freshCourse;
        } catch (refreshError) {
          if (!initialCourse) throw refreshError;
        }
        if (!loadedCourse) {
          throw new Error("Course not found");
        }

        const canonicalPath = buildCoursePath(loadedCourse);
        if (canonicalPath !== `/course/${slugParam}`) {
          navigate(canonicalPath, { replace: true });
        }

        let enrolled = false;
        if (localStorage.getItem("edutech_auth") === "true") {
          try {
            const enrollments = await fetchStudentEnrollments();
            const targetCourseId = String(loadedCourse?._id || loadedCourse?.id || "");
            const excludedStatuses = new Set([
              "cancelled",
              "canceled",
              "failed",
              "rejected",
              "refunded",
            ]);

            enrolled = Array.isArray(enrollments)
              ? enrollments.some((item) => {
                  const status = String(item?.enrollmentStatus || "").toLowerCase();
                  if (excludedStatuses.has(status) || !hasActiveEnrollmentAccess(item)) return false;

                  const rawCourse = item?.courseId;
                  const enrolledCourseId =
                    typeof rawCourse === "object"
                      ? rawCourse?._id || rawCourse?.id
                      : rawCourse;

                  return String(enrolledCourseId || "") === targetCourseId;
                })
              : false;
          } catch {
            enrolled = false;
          }
        }

        if (!mounted) return;
        setCourse(loadedCourse);
        setIsEnrolled(enrolled);
      } catch (err) {
        if (!mounted) return;
        const courseWasNotFound =
          Number(err?.status) === 404 ||
          /course not found/i.test(String(err?.message || ""));
        setNotFound(courseWasNotFound);
        setError(
          courseWasNotFound
            ? language === "fa"
              ? "این کورس یافت نشد یا دیگر منتشر نیست."
              : "This course was not found or is no longer published."
            : getLocalizedRequestErrorMessage(
                err,
                language,
                "بارگذاری کورس انجام نشد.",
                "Unable to load course.",
              ),
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [courseIdentifier, language, navigate, slugParam]);

  useEffect(() => {
    if (loading) return undefined;

    const timer = window.setTimeout(() => {
      if (course) {
        const canonicalPath = buildCoursePath(course);
        const courseTitle = normalizeSeoText(course.title) ||
          (language === "fa" ? "دوره آنلاین" : "Online Course");
        const teacherName = normalizeSeoText(course.teacher || course.teacherName);
        const fallbackDescription = language === "fa"
          ? `${courseTitle} را با کلاس‌های زنده و آموزش تعاملی در ایجوتک یاد بگیرید.`
          : `Learn ${courseTitle} through live, interactive classes at EduTech Academy.`;
        const description = truncateSeoText(
          course.description || fallbackDescription,
          160,
        );
        const schemaDescription = truncateSeoText(description, 60);
        const image = course.thumbnail || "/logo.png";

        applySeo({
          pathname: location.pathname,
          language,
          overrides: {
            canonicalPath,
            title: `${courseTitle} | ${language === "fa" ? "آکادمی ایجوتک" : "EduTech Academy"}`,
            description,
            image,
            imageAlt: courseTitle,
            keywords: [courseTitle, teacherName, course.level, course.language].filter(Boolean),
            robots: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
            shouldIndex: true,
          },
          additionalStructuredData: [
            {
              "@type": "Course",
              name: courseTitle,
              description: schemaDescription,
              image,
              provider: {
                "@type": "Organization",
                name: "EduTech Academy",
                sameAs: "https://edutech.study",
              },
              ...(teacherName
                ? { creator: { "@type": "Person", name: teacherName } }
                : {}),
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: language === "fa" ? "خانه" : "Home",
                  item: buildLocalizedSiteUrl("/", language),
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: language === "fa" ? "دوره‌ها" : "Courses",
                  item: buildLocalizedSiteUrl("/live-courses", language),
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: courseTitle,
                  item: buildLocalizedSiteUrl(canonicalPath, language),
                },
              ],
            },
          ],
        });
        return;
      }

      if (!course) {
        applySeo({
          pathname: location.pathname,
          language,
          overrides: {
            title: notFound
              ? language === "fa"
                ? "کورس یافت نشد | ایجوتک"
                : "Course Not Found | EduTech"
              : language === "fa"
                ? "کورس در دسترس نیست | ایجوتک"
                : "Course Unavailable | EduTech",
            description: notFound
              ? language === "fa"
                ? "این کورس وجود ندارد یا دیگر در ایجوتک منتشر نیست."
                : "This course does not exist or is no longer published on EduTech."
              : language === "fa"
                ? "جزئیات این کورس در حال حاضر در دسترس نیست."
                : "This course is temporarily unavailable.",
            robots: "noindex, nofollow",
            shouldIndex: false,
          },
        });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [course, language, loading, location.pathname, notFound]);

  const startHesabPayPurchase = async () => {
    if (!course || isStartingPayment) return;

    const courseId = course?._id || course?.id;
    if (!courseId) {
      alert(language === "fa" ? "شناسه کورس یافت نشد." : "Course ID not found.");
      return;
    }

    try {
      setIsStartingPayment(true);
      setIsPaymentMethodModalOpen(false);
      if (isCourseFree) {
        await enrollCourse(courseId, pricingRegion);
        window.dispatchEvent(new Event("edutech_data_changed"));
        navigate("/student/courses");
        return;
      }

      const session = await createCheckout({
        courseId,
        paymentMethod: "HESABPAY_HOSTED",
        pricingRegion,
      });
      if (session?.paymentUrl) {
        window.location.href = session.paymentUrl;
        return;
      }
    } catch (err) {
      if (err.message === "NOT_AUTHENTICATED") {
        navigate("/login");
        return;
      }
      if (String(err.message || "").toLowerCase().includes("already enrolled")) {
        navigate("/student/courses");
        return;
      }
      alert(
        getLocalizedRequestErrorMessage(
          err,
          language,
          "شروع پرداخت ممکن نشد.",
          "Unable to start payment.",
        ),
      );
    } finally {
      setIsStartingPayment(false);
    }
  };

  const startNowPaymentsPurchase = async () => {
    if (!course || isStartingPayment) return;

    const courseId = course?._id || course?.id;
    if (!courseId) return;

    try {
      setIsStartingPayment(true);
      setIsPaymentMethodModalOpen(false);

      const session = await createCheckout({
        courseId,
        paymentMethod: "USDT_BSC_DIRECT",
        pricingRegion,
      });
      if (session?.paymentAttemptId) {
        navigate(`/payment/crypto?attemptId=${encodeURIComponent(session.paymentAttemptId)}`);
        return;
      }
    } catch (err) {
      if (err.message === "NOT_AUTHENTICATED") {
        navigate("/login");
        return;
      }
      if (String(err.message || "").toLowerCase().includes("already enrolled")) {
        navigate("/student/courses");
        return;
      }
      alert(
        getLocalizedRequestErrorMessage(
          err,
          language,
          "شروع پرداخت ممکن نشد.",
          "Unable to start payment.",
        ),
      );
    } finally {
      setIsStartingPayment(false);
    }
  };

  const handlePurchase = () => {
    if (!course || isStartingPayment || course?.classEndedAt) return;

    if (localStorage.getItem("edutech_auth") === "true") {
      if (isCourseFree) {
        startHesabPayPurchase();
        return;
      }

      setIsPaymentMethodModalOpen(true);
      return;
    }

    navigate("/login");
  };

  const handleOpenBankDetails = async () => {
    if (!course || isBankDetailsLoading) return;

    const courseId = course?._id || course?.id;
    if (!courseId) return;

    try {
      setIsBankDetailsLoading(true);
      const details = await getCourseBankPaymentDetails(courseId, pricingRegion);
      setBankPaymentDetails(details);
      setIsPaymentMethodModalOpen(false);
      setIsBankDetailsModalOpen(true);
    } catch (err) {
      if (err.message === "NOT_AUTHENTICATED") {
        navigate("/login");
        return;
      }
      alert(
        getLocalizedRequestErrorMessage(
          err,
          language,
          "اطلاعات پرداخت بانکی در دسترس نیست.",
          "Bank payment details are not available.",
        ),
      );
    } finally {
      setIsBankDetailsLoading(false);
    }
  };

  const handleSubmitBankProof = async ({ senderAccount, note, paymentProof }) => {
    const courseId = course?._id || course?.id;
    if (!courseId) return;

    try {
      setIsSubmittingBankProof(true);
      const response = await submitBankTransferPayment({
        courseId,
        countryCode,
        paymentProof,
        senderAccount,
        note,
      });
      setBankPaymentDetails((current) => (current ? {
        ...current,
        submissionState: {
          hasSubmission: true,
          canResubmit: false,
          status: "pending_review",
          reviewStatus: response?.payment?.bankTransferReviewStatus || "pending_teacher_review",
          paymentStatus: response?.payment?.paymentStatus || "pending",
          submittedAt: response?.payment?.paymentProofSubmittedAt || new Date().toISOString(),
          message: "Your previous bank transfer proof is still waiting for teacher review.",
        },
      } : current));
      window.dispatchEvent(new Event("edutech_data_changed"));
    } finally {
      setIsSubmittingBankProof(false);
    }
  };

  const weeklyScheduleRows = useMemo(() => {
    const byDay = new Map();
    const scheduleRows = Array.isArray(course?.scheduleRows)
      ? course.scheduleRows
          .map((row) => ({
            day: row?.day || "",
            startTime: row?.startTime || "",
            endTime: row?.endTime || "",
          }))
          .filter((row) => row.day)
      : [];

    scheduleRows.forEach((row) => {
      const dayKey = normalizeScheduleDayKey(row.day);
      if (!dayKey || !WEEK_DAY_ORDER.includes(dayKey)) return;
      if (byDay.has(dayKey)) return;
      byDay.set(dayKey, {
        day: dayKey,
        startTime: row.startTime || "-",
        endTime: row.endTime || "-",
      });
    });

    return WEEK_DAY_ORDER.map((dayKey) => byDay.get(dayKey)).filter(Boolean);
  }, [course]);

  const seatInfo = useMemo(() => {
    const maxStudents = Number(course?.maxStudents || 0);
    const enrolledStudents = Number(course?.enrolledStudentsCount || 0);
    const remainingSeats = Math.max(0, maxStudents - enrolledStudents);

    return {
      maxStudents,
      enrolledStudents,
      remainingSeats,
      label:
        maxStudents > 0
          ? `${remainingSeats} / ${maxStudents}`
          : String(remainingSeats),
    };
  }, [course?.maxStudents, course?.enrolledStudentsCount]);

  const sessionProgress = useMemo(() => {
    if (!course) return null;
    return calculateCourseProgressSnapshot(
      {
        ...course,
        schedule: Array.isArray(course.scheduleRows)
          ? course.scheduleRows
          : [],
      },
      new Date(nowMs),
    );
  }, [course, nowMs]);

  const priceText = isCourseFree
    ? language === "fa"
      ? "رایگان"
      : "Free"
    : coursePricing.finalLabel;
  const usdBaseLabel =
    coursePricing.pricingType === "regional" &&
    coursePricing.currency !== "USD" &&
    Number(coursePricing.finalPriceUsd) > 0
      ? `${language === "fa" ? "مبنای پرداخت:" : "Checkout base:"} $${new Intl.NumberFormat("en-US", {
          minimumFractionDigits: Number.isInteger(Number(coursePricing.finalPriceUsd)) ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(Number(coursePricing.finalPriceUsd))} USD`
      : "";
  const exchangeRateLabel =
    coursePricing.pricingType === "regional" &&
    coursePricing.currency !== "USD" &&
    Number(coursePricing.usdExchangeRate) > 0
      ? `${coursePricing.usesInternationalPrice
          ? language === "fa" ? "نرخ فعلی:" : "Current rate:"
          : language === "fa" ? "نرخ کورس:" : "Course rate:"} 1 USD = ${new Intl.NumberFormat(
          language === "fa" ? "fa-AF" : "en-US",
          { maximumFractionDigits: coursePricing.currency === "TOMAN" ? 0 : 2 },
        ).format(Number(coursePricing.usdExchangeRate))} ${coursePricing.currency}`
      : "";
  const paymentPlan =
    course?.paymentPlan === "whole_period" ? "whole_period" : "monthly";
  const paymentPlanLabel =
    paymentPlan === "monthly"
      ? language === "fa"
        ? "پرداخت ماهانه"
        : "Monthly payment"
      : language === "fa"
        ? "پرداخت یک‌باره برای تمام دوره"
        : "One payment for the whole period";
  const paymentPlanDescription =
    paymentPlan === "monthly"
      ? language === "fa"
        ? "این مبلغ هر ماه برای تمدید دسترسی پرداخت می‌شود."
        : "This amount is paid each month to renew course access."
      : language === "fa"
        ? "این مبلغ یک‌بار پرداخت می‌شود و دسترسی تا پایان کورس ادامه دارد."
        : "Pay once and keep access through the end of the course.";
  const startDateText = formatStartDate(course?.startDate, language, null);
  const courseStartAt = resolveCourseStartAt(course);
  const publicStateLabel = getPublicStateLabel(course, language);
  const publicStateMessage = getPublicStateMessage(course, language);
  const publicStateTone = getPublicStateTone(course);
  const canPublicEnroll = canEnrollFromPublicState(course);
  const courseTimeDetails = courseStartAt
    ? getDualTimeDetails(
        courseStartAt,
        null,
        course?.timezone || "Asia/Kabul",
        language,
      )
    : null;
  const countdownText = formatCountdown(courseStartAt, nowMs, language);
  const levelText = formatLevel(course?.level, language);
  const courseLanguageText = formatCourseLanguage(course?.language, language);
  const durationText = formatDurationLabel(course?.duration, language);
  const platformText = formatMeetingType(course?.meetingType, language);
  const rawTeacherId = course?.teacherId;
  const teacherId = String(
    (rawTeacherId && typeof rawTeacherId === "object"
      ? rawTeacherId?._id || rawTeacherId?.id
      : rawTeacherId) ||
      (course?.teacher && typeof course?.teacher === "object"
        ? course.teacher?._id || course.teacher?.id
        : ""),
  ).trim();
  const teacherProfilePath = teacherId
    ? buildTeacherPath({ _id: teacherId, name: course?.teacherName || course?.teacher })
    : "";
  const teacherName =
    String(course?.teacherName || course?.teacher || "").trim() ||
    (language === "fa" ? "مدرس کورس" : "Course instructor");
  const courseImage = course?.thumbnail || COURSE_IMAGE_FALLBACK;
  const isHeroDescriptionExpanded = expandedDescriptionSlug === slugParam;
  const courseDescriptionSource = [
    course?.description,
    course?.about,
    detail?.aboutText,
  ].find((value) => String(value || "").trim());
  const courseDescription = String(courseDescriptionSource || "").replace(/\r\n/g, "\n");
  const learningOutcomes = filterDisplayList(
    course?.whatYouWillLearn?.length ? course.whatYouWillLearn : [],
  );
  const syllabusItems = filterDisplayList(
    course?.curriculumTopics?.length ? course.curriculumTopics : [],
  );
  const suitableAudience = filterDisplayList(
    course?.targetAudience?.length ? course.targetAudience : [],
  );
  const requirements = filterDisplayList(
    course?.requirements?.length ? course.requirements : [],
  );
  const previewVideos = normalizePreviewVideoLinks(course);
  const isSpecialCourse = course?.courseType === "special";
  const courseEnded = Boolean(course?.classEndedAt);
  const certificateIncluded =
    !isCourseFree &&
    coursePricing.finalPrice > 0 &&
    course?.certificate?.enabled !== false;
  const certificateMinimumAttendance = Math.max(
    0,
    Math.min(100, Number(course?.certificate?.minimumAttendance ?? 70)),
  );
  const certificateMinimumPassingGrade = Math.max(
    0,
    Math.min(100, Number(course?.certificate?.minimumPassingGrade ?? 60)),
  );
  const courseReviews = Array.isArray(course?.reviews) ? course.reviews : [];
  const displayedCourseReviews = courseReviews;
  const sortedCourseReviews = [...displayedCourseReviews].sort((left, right) => reviewSort === "helpful"
    ? Number(right.helpfulCount || 0) - Number(left.helpfulCount || 0)
    : new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
  const reviewCount = Math.max(Number(course?.ratingCount || 0), displayedCourseReviews.length);
  const quickFacts = [
    {
      icon: UsersRound,
      label: language === "fa" ? "مدرس" : "Teacher",
      value: teacherName,
      href: teacherProfilePath,
    },
    {
      icon: CalendarDays,
      label: language === "fa" ? "شروع صنف" : "Class starts",
      value: startDateText || "-",
    },
    {
      icon: Video,
      label: detail.stats.platform,
      value: platformText || "-",
    },
    {
      icon: BookOpen,
      label: language === "fa" ? "سطح دوره" : "Course level",
      value: levelText || "-",
    },
    {
      icon: Languages,
      label: language === "fa" ? "زبان تدریس" : "Teaching language",
      value: courseLanguageText || "-",
    },
    {
      icon: BookOpen,
      label: language === "fa" ? "مجموع جلسات" : "Total sessions",
      value: String(sessionProgress?.totalLessons || course?.totalSessions || "-"),
    },
    {
      icon: CreditCard,
      label: language === "fa" ? "روش پرداخت" : "Payment plan",
      value: isCourseFree
        ? language === "fa"
          ? "رایگان"
          : "Free"
        : paymentPlanLabel,
    },
    {
      icon: UsersRound,
      label: language === "fa" ? "جای‌های باقی‌مانده" : "Remaining seats",
      value: seatInfo.maxStudents > 0 ? seatInfo.label : "-",
    },
  ];
  const teacherProfileSection = (
    <section className="order-[-1] overflow-hidden rounded-3xl border border-primary-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 bg-gradient-to-br from-primary-50 via-white to-teal-50 p-5 sm:flex-row sm:items-center sm:p-6">
        <img
          src={course?.teacherAvatar || COURSE_IMAGE_FALLBACK}
          alt={teacherName}
          className={`h-20 w-20 shrink-0 rounded-2xl border border-white bg-white shadow-sm ${course?.teacherAvatar ? "object-cover" : "object-contain p-3"}`}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = COURSE_IMAGE_FALLBACK;
            event.currentTarget.className =
              "h-20 w-20 shrink-0 rounded-2xl border border-white bg-white object-contain p-3 shadow-sm";
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-primary-700">
            {language === "fa" ? "مدرس این کورس" : "Course instructor"}
          </p>
          <h2 className="mt-1 break-words text-xl font-black text-slate-950">
            {teacherName}
          </h2>
          {course?.teacherRole ? (
            <p className="mt-1 text-sm font-bold text-slate-600">
              {course.teacherRole}
            </p>
          ) : null}
          {course?.teacherBio ? (
            <p
              dir="auto"
              className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-slate-600"
            >
              {course.teacherBio}
            </p>
          ) : null}
        </div>
        {teacherProfilePath ? (
          <Link
            to={teacherProfilePath}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-primary-700"
          >
            {language === "fa" ? "مشاهده پروفایل مدرس" : "View teacher profile"}
            <ArrowIcon size={16} />
          </Link>
        ) : null}
      </div>
    </section>
  );

  const handleShare = async () => {
    const shared = await shareContent({
      title: course?.title || "Course",
      text: courseDescription,
      path: window.location.pathname,
      previewPath: `/share/course/${encodeURIComponent(course?.slug || course?._id || course?.id || "")}`,
    });

    if (shared && !navigator.share) {
      alert(language === "fa" ? "لینک کپی شد." : "Link copied.");
    }
  };

  const handleDownloadSyllabus = () => {
    const lines = [
      course?.title || "Course",
      "",
      `${language === "fa" ? "سطح" : "Level"}: ${levelText}`,
      `${language === "fa" ? "زبان تدریس" : "Teaching language"}: ${courseLanguageText || "-"}`,
      `${language === "fa" ? "مدت" : "Duration"}: ${durationText || "-"}`,
      `${language === "fa" ? "مجموع جلسات" : "Total sessions"}: ${sessionProgress?.totalLessons || "-"}`,
      `${language === "fa" ? "پلتفرم" : "Platform"}: ${platformText || "-"}`,
      "",
      language === "fa" ? "آنچه یاد می‌گیرید:" : "What you will learn:",
      ...(learningOutcomes.length ? learningOutcomes.map((item) => `- ${item}`) : ["-"]),
      "",
      language === "fa" ? "سرفصل:" : "Syllabus:",
      ...(syllabusItems.length ? syllabusItems.map((item) => `- ${item}`) : ["-"]),
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${course?.slug || "course"}-syllabus.txt`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6 lg:px-8">
          <FrontendPageLoader
            label={language === "fa" ? "در حال بارگذاری جزئیات کورس" : "Loading course details"}
          />
        </div>
      </section>
    );
  }

  if (error || !course) {
    return (
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-lg font-black text-rose-600">{error || "Course not found"}</p>
          <Link
            to={breadcrumbBackPath}
            className="mt-4 inline-flex rounded-lg bg-primary-600 px-5 py-3 text-sm font-black text-white"
          >
            {language === "fa" ? "برگشت به کورس‌ها" : "Back to courses"}
          </Link>
        </div>
      </section>
    );
  }

  const purchaseButtonLabel = getPublicActionLabel(course, language, false);

  const sectionLinks = [
    { href: "#course-overview", label: language === "fa" ? "معرفی کورس" : "Overview" },
    { href: "#course-schedule", label: language === "fa" ? "تقسیم اوقات" : "Schedule" },
    { href: "#course-syllabus", label: language === "fa" ? "سرفصل‌ها" : "Syllabus" },
    { href: "#course-reviews", label: language === "fa" ? "نظریات شاگردان" : "Reviews" },
  ];

  return (
    <section className={`overflow-x-hidden bg-slate-50 pt-6 sm:pt-8 ${!isEnrolled && !courseEnded && canPublicEnroll ? "pb-24" : "pb-16"}`} dir={dir}>
      <div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-2 px-1 text-xs font-bold text-slate-500 sm:text-sm">
          <Link className="hover:text-primary-700" to="/">
            {detail.breadcrumbs[0]}
          </Link>
          <span>/</span>
          <Link className="hover:text-primary-700" to={breadcrumbBackPath}>
            {breadcrumbBackLabel}
          </Link>
          <span>/</span>
          <span className="max-w-full truncate text-slate-900">{course.title}</span>
        </div>

        {courseEnded ? (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Archive size={19} className="mt-0.5 shrink-0 text-amber-700" />
              <div>
                <p className="font-black">{language === "fa" ? "این کورس پایان یافته است" : "This course has ended"}</p>
                <p className="mt-0.5 leading-6 text-amber-800">{language === "fa" ? "جزئیات، برنامه و نظریات شاگردان به‌عنوان آرشیف برای شما قابل مشاهده است." : "Its details, schedule, and student reviews remain available as an archive."}</p>
              </div>
            </div>
            <a href="#course-reviews" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 text-xs font-black text-amber-900 transition hover:bg-amber-100">
              {language === "fa" ? "دیدن نظریات" : "Read reviews"}
            </a>
          </div>
        ) : !isEnrolled ? (
          <div className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${publicStateTone}`}>
            <BookOpen size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-black">{publicStateLabel}</p>
              {publicStateMessage ? <p className="mt-1 leading-6">{publicStateMessage}</p> : null}
            </div>
          </div>
        ) : (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-700" />
            {language === "fa"
              ? "شما در این کورس ثبت‌نام هستید."
              : "You are already enrolled in this course."}
          </div>
        )}

        <div
          className={`grid min-w-0 gap-6 ${
            isEnrolled || courseEnded || !canPublicEnroll ? "" : "xl:grid-cols-[minmax(0,1fr)_360px]"
          }`}
        >
          <div className="flex min-w-0 max-w-full flex-col gap-5">
            <div
              id="course-overview"
              className="relative order-[-3] mx-auto w-full overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
            >
              <div className="pointer-events-none absolute -start-20 -top-24 h-64 w-64 rounded-full bg-blue-100/60 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-28 end-0 h-64 w-64 rounded-full bg-teal-100/60 blur-3xl" />
              <div className="relative p-5 sm:p-7 lg:p-8">
                <div className="min-w-0 space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-700"><BookOpen size={14} />{language === "fa" ? "کورس آنلاین ایجوتک" : "EduTech online course"}</span>
                      {isSpecialCourse ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-black text-white shadow-sm">
                          <Star size={13} fill="currentColor" />{language === "fa" ? "کورس ویژه" : "Special course"}
                        </span>
                      ) : null}
                      {courseEnded ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">
                          <Archive size={13} />{language === "fa" ? "کورس پایان‌یافته" : "Ended course"}
                        </span>
                      ) : null}
                      {publicStateLabel ? (
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black ${publicStateTone}`}>
                          <Clock3 size={13} />
                          {publicStateLabel}
                        </span>
                      ) : null}
                      {Number(course?.ratingCount || 0) > 0 ? (
                        <a href="#course-reviews" className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-black text-slate-800 transition hover:bg-amber-50">
                          <Star size={13} className="text-amber-500" fill="currentColor" />
                          <span dir="ltr">{Number(course?.rating || 0).toFixed(1)}</span>
                          <span className="text-slate-500">({Number(course.ratingCount)})</span>
                        </a>
                      ) : null}
                    </div>
                    <h1 className="mt-4 break-words whitespace-normal text-start text-2xl font-black leading-[1.35] text-slate-950 [overflow-wrap:anywhere] sm:text-3xl lg:text-4xl">
                      {course.title}
                    </h1>
                    <div
                      className="mx-auto mt-5 flex w-full max-w-5xl items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-teal-50 shadow-sm"
                      style={{ aspectRatio: COURSE_IMAGE_ASPECT_RATIO }}
                    >
                      <img
                        className={`block h-full w-full object-center ${
                          courseImage === COURSE_IMAGE_FALLBACK ? "object-contain p-8 sm:p-10" : "object-cover"
                        }`}
                        src={courseImage}
                        alt={course.title}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = COURSE_IMAGE_FALLBACK;
                          event.currentTarget.className =
                            "block h-full w-full object-contain object-center p-8 sm:p-10";
                        }}
                      />
                    </div>
                    {courseDescription ? (
                      <>
                        <p
                          dir="auto"
                          className={`edutech-prose-justify mt-4 whitespace-pre-wrap break-words text-start text-[15px] font-medium leading-8 text-slate-600 [overflow-wrap:anywhere] ${
                            isHeroDescriptionExpanded
                              ? ""
                              : "max-h-[84px] overflow-hidden sm:max-h-none"
                          }`}
                        >
                          {courseDescription}
                        </p>
                        <button
                          type="button"
                          className="mt-2 flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-primary-700 shadow-sm sm:hidden"
                          onClick={() =>
                            setExpandedDescriptionSlug((prev) =>
                              prev === slugParam ? "" : slugParam,
                            )
                          }
                        >
                          {isHeroDescriptionExpanded
                            ? language === "fa"
                              ? "نمایش کمتر"
                              : "Show less"
                            : language === "fa"
                              ? "نمایش بیشتر"
                              : "Show more"}
                        </button>
                      </>
                    ) : null}
                    {countdownText && !courseEnded ? (
                      <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-black text-sky-800">
                        <Clock3 size={16} />
                        <span>{countdownText}</span>
                      </div>
                    ) : null}
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button type="button" onClick={handleDownloadSyllabus} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:border-primary-200 hover:text-primary-700"><Download size={15} />{detail.download}</button>
                      <button type="button" onClick={handleShare} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:border-primary-200 hover:text-primary-700"><Share2 size={15} />{detail.share}</button>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <nav aria-label={language === "fa" ? "بخش‌های جزئیات کورس" : "Course detail sections"} className="sticky top-16 z-20 order-[-2] -mx-4 overflow-x-auto bg-slate-50/90 px-4 py-2 backdrop-blur [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:min-w-0 sm:grid sm:grid-cols-4">
                {sectionLinks.map((item) => (
                  <a key={item.href} href={item.href} className="inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-xs font-black text-slate-600 transition hover:bg-primary-50 hover:text-primary-700 sm:px-2">
                    {item.label}
                  </a>
                ))}
              </div>
            </nav>

            {quickFacts.length ? (
              <div className="order-[-1] grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {quickFacts.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700">
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-500">{item.label}</p>
                          {item.href ? (
                            <Link
                              className="mt-1 inline-flex break-words text-sm font-black text-primary-700 underline-offset-2 transition [overflow-wrap:anywhere] hover:text-primary-800 hover:underline"
                              to={item.href}
                            >
                              {item.value}
                            </Link>
                          ) : (
                            <p className="mt-1 break-words text-sm font-black text-slate-900 [overflow-wrap:anywhere]">
                              {item.value}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div
                className={`p-5 sm:p-6 ${
                  certificateIncluded
                    ? "bg-gradient-to-br from-amber-50 via-white to-primary-50"
                    : "bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                      certificateIncluded
                        ? "bg-amber-500 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    <Award size={21} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-black text-slate-950">
                      {language === "fa"
                        ? "شرایط دریافت گواهینامه"
                        : "Certificate requirements"}
                    </h2>
                    <p className="mt-1 text-sm font-semibold leading-7 text-slate-600">
                      {certificateIncluded
                        ? language === "fa"
                          ? "این کورس پولی شامل گواهینامه ایجوتک است؛ برای دریافت آن باید همه شرایط زیر را تکمیل کنید."
                          : "This paid course includes an EduTech certificate after all requirements below are completed."
                        : language === "fa"
                          ? "این کورس رایگان است و شامل گواهینامه نمی‌شود."
                          : "This free course does not include a certificate."}
                    </p>
                  </div>
                </div>
                {certificateIncluded ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      language === "fa" ? "پایان رسمی کورس" : "Official course completion",
                      language === "fa"
                        ? `حداقل ${certificateMinimumAttendance}٪ حضور`
                        : `At least ${certificateMinimumAttendance}% attendance`,
                      language === "fa"
                        ? `حداقل ${certificateMinimumPassingGrade}٪ نمره قبولی`
                        : `At least ${certificateMinimumPassingGrade}% passing grade`,
                      language === "fa" ? "پرداخت کامل کورس" : "Full course payment",
                    ].map((requirement) => (
                      <div
                        key={requirement}
                        className="flex items-center gap-2 rounded-xl border border-white bg-white/90 px-3 py-3 text-xs font-black text-slate-800 shadow-sm"
                      >
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                        <span>{requirement}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            {previewVideos.length ? (
              <div className="w-full min-w-0 max-w-full overflow-hidden rounded-3xl border border-red-100 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <div className="border-b border-red-100 bg-gradient-to-r from-red-50 via-white to-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">
                        <PlayCircle size={14} />
                        YouTube
                      </p>
                      <h2 className="mt-3 text-xl font-black text-slate-950">
                        {language === "fa" ? "قبل از خرید، کورس را ببینید" : "Preview The Course Before You Enroll"}
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                        {language === "fa"
                          ? "این ویدیوها توسط استاد اضافه شده‌اند تا سبک تدریس، سطح درس و فضای کورس را قبل از ثبت‌نام بهتر بشناسید."
                          : "These videos were added by the teacher so you can understand the teaching style, lesson level, and course feel before enrolling."}
                      </p>
                    </div>
                    <span className="rounded-full border border-red-100 bg-white px-3 py-1 text-xs font-black text-red-700">
                      {language === "fa"
                        ? `${previewVideos.length} ویدیو`
                        : `${previewVideos.length} videos`}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
                  {previewVideos.map((videoItem, index) => (
                    <div
                      key={`${videoItem.url}-${index}`}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950"
                    >
                      <div className="relative aspect-video bg-slate-900">
                        {videoItem.embedUrl && activePreviewIndex === index ? (
                          <iframe
                            className="h-full w-full"
                            src={`${videoItem.embedUrl}?autoplay=1&rel=0`}
                            title={`${course.title} preview video ${index + 1}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        ) : videoItem.thumbnailUrl ? (
                          <button
                            type="button"
                            onClick={() => setActivePreviewIndex(index)}
                            className="group relative block h-full w-full overflow-hidden"
                            aria-label={language === "fa" ? `پخش ویدیوی ${index + 1}` : `Play preview ${index + 1}`}
                          >
                            <img
                              src={videoItem.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                            />
                            <span className="absolute inset-0 bg-slate-950/20 transition group-hover:bg-slate-950/30" />
                            <span className="absolute start-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-red-600 text-white shadow-xl transition group-hover:scale-105">
                              <PlayCircle size={34} fill="currentColor" />
                            </span>
                          </button>
                        ) : (
                          <div className="grid h-full place-items-center p-6 text-center text-sm font-bold text-white">
                            {language === "fa" ? "پیش‌نمایش مستقیم این لینک در دسترس نیست." : "Direct preview is not available for this link."}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3 bg-white p-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-500">
                            {language === "fa" ? `ویدیوی ${index + 1}` : `Preview ${index + 1}`}
                          </p>
                          <p className="truncate text-sm font-bold text-slate-900" dir="ltr">{videoItem.url}</p>
                        </div>
                        <a
                          href={videoItem.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-red-100 px-3 text-xs font-black text-red-700 transition hover:bg-red-50"
                        >
                          <ExternalLink size={14} />
                          {language === "fa" ? "باز کردن" : "Open"}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="contents">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-black text-slate-950">
                  {detail.suitableTitle}
                </h2>
                <div className="mt-4 space-y-2.5">
                  {suitableAudience.length ? suitableAudience.map((item, idx) => (
                    <p
                      key={`${item}-${idx}`}
                      className="flex items-start gap-2 text-sm font-semibold text-slate-700"
                    >
                      <CheckCircle2
                        className="mt-0.5 shrink-0 text-emerald-600"
                        size={16}
                      />
                      <span className="break-words [overflow-wrap:anywhere]">{item}</span>
                    </p>
                  )) : (
                    <p className="text-sm font-semibold text-slate-500">
                      {language === "fa" ? "هنوز ثبت نشده است." : "Not added yet."}
                    </p>
                  )}
                </div>
              </div>

              <div id="course-schedule" className="scroll-mt-24 -order-1 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-black text-slate-950">
                  {detail.scheduleTitle}
                </h2>
                {sessionProgress ? (
                  <div className="mt-4 rounded-2xl border border-blue-100 bg-[linear-gradient(135deg,#EFF6FF_0%,#F0FDFA_100%)] p-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[11px] font-black text-slate-500">
                          {language === "fa" ? "جلسات گذشته" : "Passed"}
                        </p>
                        <p className="mt-1 text-xl font-black text-blue-800">
                          {sessionProgress.completedLessons}
                        </p>
                      </div>
                      <div className="border-x border-blue-100">
                        <p className="text-[11px] font-black text-slate-500">
                          {language === "fa" ? "باقی‌مانده" : "Remaining"}
                        </p>
                        <p className="mt-1 text-xl font-black text-teal-700">
                          {Math.max(
                            0,
                            sessionProgress.totalLessons -
                              sessionProgress.completedLessons,
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-500">
                          {language === "fa" ? "مجموع جلسات" : "Total"}
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-950">
                          {sessionProgress.totalLessons}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-700 to-teal-500 transition-[width] duration-700"
                        style={{ width: `${sessionProgress.progressPercent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-center text-[11px] font-bold text-slate-500">
                      {language === "fa"
                        ? `${sessionProgress.progressPercent}٪ از جلسات کورس گذشته است`
                        : `${sessionProgress.progressPercent}% of course sessions have passed`}
                    </p>
                  </div>
                ) : null}
                {courseTimeDetails ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                      <p className="text-[11px] font-black uppercase tracking-wide text-blue-700">
                        {language === "fa" ? "وقت تعیین‌شده استاد" : "Teacher’s scheduled time"}
                      </p>
                      <p className="mt-1.5 text-sm font-black text-slate-950">
                        {courseTimeDetails.teacherDate}
                      </p>
                      <p className="mt-1 break-all text-[11px] font-bold text-slate-500" dir="ltr">
                        {formatTimeZoneOffset(courseTimeDetails.teacherZone, language, courseStartAt)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
                      <p className="text-[11px] font-black uppercase tracking-wide text-teal-700">
                        {language === "fa" ? "وقت محل فعلی شما" : "Your local time"}
                      </p>
                      <p className="mt-1.5 text-sm font-black text-slate-950">
                        {courseTimeDetails.localDate}
                      </p>
                      <p className="mt-1 break-all text-[11px] font-bold text-slate-500" dir="ltr">
                        {formatTimeZoneOffset(courseTimeDetails.localZone, language, courseStartAt)}
                      </p>
                    </div>
                  </div>
                ) : null}
                {weeklyScheduleRows.length ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                    <p className="border-b border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-500">
                      {language === "fa"
                        ? "تقسیم اوقات هفتگی بر اساس وقت استاد"
                        : "Weekly schedule in the teacher’s timezone"}
                    </p>
                    <div className="grid grid-cols-3 gap-2 bg-slate-100 px-3 py-2.5 text-[11px] font-black text-slate-500">
                      <span>{language === "fa" ? "روز" : "Day"}</span>
                      <span>{language === "fa" ? "شروع" : "Starts"}</span>
                      <span>{language === "fa" ? "پایان" : "Ends"}</span>
                    </div>
                    {weeklyScheduleRows.map((row, idx) => (
                    <div
                      key={`${row.day}-${idx}`}
                      className="grid grid-cols-3 gap-2 border-b border-slate-100 px-3 py-3 text-xs font-semibold text-slate-700 last:border-b-0"
                    >
                      <span className="truncate">{formatDayLabel(row.day, language)}</span>
                      <span className="truncate">{row.startTime || "-"}</span>
                      <span className="truncate text-teal-700">{row.endTime || "-"}</span>
                    </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    {language === "fa" ? "تقسیم اوقات این کورس هنوز ثبت نشده است." : "The schedule for this course has not been added yet."}
                  </p>
                )}
              </div>
            </div>

            {teacherProfileSection}

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-black text-slate-950">
                  {detail.outcomesTitle}
                </h2>
                <div className="mt-4 space-y-2.5">
                  {learningOutcomes.length ? learningOutcomes.map((item, idx) => (
                    <p
                      key={`${item}-${idx}`}
                      className="flex items-start gap-2 text-sm font-semibold text-slate-700"
                    >
                      <CheckCircle2
                        className="mt-0.5 shrink-0 text-primary-700"
                        size={16}
                      />
                      <span className="break-words [overflow-wrap:anywhere]">{item}</span>
                    </p>
                  )) : (
                    <p className="text-sm font-semibold text-slate-500">
                      {language === "fa" ? "هنوز ثبت نشده است." : "Not added yet."}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-black text-slate-950">
                  {detail.requirementsTitle}
                </h2>
                <div className="mt-4 space-y-2">
                  {requirements.length ? requirements.map((item, idx) => (
                    <div
                      key={`${item}-${idx}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700"
                    >
                      <span className="break-words [overflow-wrap:anywhere]">{item}</span>
                    </div>
                  )) : (
                    <p className="text-sm font-semibold text-slate-500">
                      {language === "fa" ? "هنوز ثبت نشده است." : "Not added yet."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div id="course-syllabus" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-xl font-black text-slate-950">{detail.tabs[1]}</h2>
              <div
                className={`mt-3 max-h-[520px] space-y-2 overflow-y-auto pe-1 ${
                  dir === "rtl" ? "[direction:ltr]" : ""
                }`}
              >
                {syllabusItems.length ? syllabusItems.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className={`flex min-h-11 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm font-bold text-slate-800 ${
                      dir === "rtl" ? "[direction:rtl]" : ""
                    }`}
                  >
                    <span className="break-words [overflow-wrap:anywhere]">{item}</span>
                  </div>
                )) : (
                  <p className="text-sm font-semibold text-slate-500">
                    {language === "fa" ? "هنوز ثبت نشده است." : "Not added yet."}
                  </p>
                )}
              </div>
            </div>

            <div id="course-reviews" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-black text-slate-950">
                  {language === "fa" ? "نظریات شاگردان درباره کورس" : "Student Reviews About This Course"}
                </h2>
                <div className="flex items-center gap-2">
                  {displayedCourseReviews.length > 1 ? (
                    <select
                      value={reviewSort}
                      onChange={(event) => setReviewSort(event.target.value)}
                      aria-label={language === "fa" ? "ترتیب نظریات" : "Sort reviews"}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"
                    >
                      <option value="newest">{language === "fa" ? "تازه‌ترین" : "Newest"}</option>
                      <option value="helpful">{language === "fa" ? "مفیدترین" : "Most helpful"}</option>
                    </select>
                  ) : null}
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-black text-primary-700">
                    {reviewCount}
                  </span>
                </div>
              </div>
              {Number(course?.ratingCount || 0) > 0 ? (
                <div className="mt-5 grid gap-5 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 sm:grid-cols-[170px_1fr] sm:p-5">
                  <div className="flex flex-col items-center justify-center text-center">
                    <p className="text-4xl font-black text-slate-950">{Number(course.rating || 0).toFixed(1)}</p>
                    <div className="mt-2 flex items-center gap-0.5" dir="ltr">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          size={18}
                          fill={index < Math.round(Number(course.rating || 0)) ? "currentColor" : "none"}
                          className={index < Math.round(Number(course.rating || 0)) ? "text-amber-400" : "text-slate-300"}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      {course.ratingCount} {language === "fa" ? "نظر شاگردان" : "student reviews"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((score) => {
                      const count = Number(course?.ratingDistribution?.[score] || 0);
                      const percent = Math.round((count / Number(course.ratingCount || 1)) * 100);
                      return (
                        <div key={score} className="flex items-center gap-2 text-xs font-bold text-slate-600" dir="ltr">
                          <span className="w-3">{score}</span>
                          <Star size={13} className="shrink-0 text-amber-400" fill="currentColor" />
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${percent}%` }} />
                          </div>
                          <span className="w-9 text-end">{percent}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {displayedCourseReviews.length ? (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {sortedCourseReviews.map((review, index) => (
                    <ReviewCard key={review._id || `${review.name}-${index}`} review={{ ...review, isFa: language === "fa" }} />
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  {language === "fa"
                    ? "هنوز نظری برای این کورس ثبت نشده است."
                    : "No reviews have been posted for this course yet."}
                </p>
              )}
            </div>

          </div>

          {!isEnrolled && !courseEnded && canPublicEnroll ? (
            <aside className="hidden xl:block">
              <div className="sticky top-24 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.10)]">
                <p className="text-center text-xs font-black uppercase tracking-wide text-slate-500">
                  {detail.priceLabel}
                </p>
                <p className="mt-1 text-center text-3xl font-black text-slate-950" dir="ltr">
                  {priceText}
                </p>
                {coursePricing.originalLabel ? (
                  <p className="mt-1 text-center text-sm font-bold text-slate-400 line-through" dir="ltr">
                    {coursePricing.originalLabel}
                  </p>
                ) : null}
                {usdBaseLabel ? (
                  <p className="mt-1 text-xs font-bold text-slate-500" dir="ltr">{usdBaseLabel}</p>
                ) : null}
                {exchangeRateLabel ? (
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-400" dir="ltr">{exchangeRateLabel}</p>
                ) : null}
                {!isCourseFree ? (
                  <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-center">
                    <p className="text-xs font-black text-blue-900">
                      {paymentPlanLabel}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-blue-700">
                      {paymentPlanDescription}
                    </p>
                  </div>
                ) : null}

                <button
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-black text-white shadow-lg shadow-primary-100 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
                  onClick={handlePurchase}
                  disabled={isStartingPayment}
                >
                  {isStartingPayment ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {language === "fa" ? "در حال انتقال" : "Redirecting"}
                    </>
                  ) : (
                    <>
                      {purchaseButtonLabel}
                      <ArrowIcon size={16} />
                    </>
                  )}
                </button>

                <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
                  {seatInfo.maxStudents > 0 ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                        <UsersRound size={15} className="text-primary-700" />
                        {detail.stats.remaining}
                      </div>
                      <span className="text-sm font-black text-slate-900">
                        {seatInfo.label}
                      </span>
                    </div>
                  ) : null}
                  {startDateText ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                        <CalendarDays size={15} className="text-primary-700" />
                        {detail.nextBatch}
                      </div>
                      <span className="text-xs font-black text-slate-900">
                        {startDateText}
                      </span>
                    </div>
                  ) : null}
                  {countdownText ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-sky-50 px-3 py-2.5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-sky-800">
                        <Clock3 size={15} className="text-sky-700" />
                        {language === "fa" ? "زمان تا شروع" : "Starts in"}
                      </div>
                      <span className="text-xs font-black text-sky-900">
                        {countdownText}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-primary-300 hover:text-primary-700"
                    onClick={handleDownloadSyllabus}
                  >
                    <Download size={14} />
                    {detail.download}
                  </button>
                  <button
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-primary-300 hover:text-primary-700"
                    onClick={handleShare}
                  >
                    <Share2 size={14} />
                    {detail.share}
                  </button>
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>

      {!isEnrolled && !courseEnded && canPublicEnroll ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur xl:hidden">
          <div className="mx-auto flex min-w-0 max-w-[1340px] items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                {detail.priceLabel}
              </p>
              <p className="truncate text-lg font-black text-slate-950" dir="ltr">
                {priceText}
              </p>
              {coursePricing.originalLabel ? (
                <p className="truncate text-[10px] font-bold text-slate-400 line-through" dir="ltr">
                  {coursePricing.originalLabel}
                </p>
              ) : null}
              {usdBaseLabel ? (
                <p className="mt-1 text-xs font-bold text-slate-500" dir="ltr">{usdBaseLabel}</p>
              ) : null}
              {exchangeRateLabel ? (
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400" dir="ltr">{exchangeRateLabel}</p>
              ) : null}
              {!isCourseFree ? (
                <p className="truncate text-[10px] font-bold text-blue-700">
                  {paymentPlanLabel}
                </p>
              ) : null}
            </div>
            <button
              className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-black text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={handlePurchase}
              disabled={isStartingPayment}
            >
              {isStartingPayment ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {language === "fa" ? "در حال انتقال" : "Redirecting"}
                </>
              ) : (
                <>
                  {purchaseButtonLabel}
                  <ArrowIcon size={15} />
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" })}
        className={`fixed right-5 z-[29] grid h-12 w-12 place-items-center rounded-full border border-primary-400 bg-white text-primary-700 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-300 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-100 ${!isEnrolled && !courseEnded && canPublicEnroll ? "bottom-24 xl:bottom-5" : "bottom-5"} ${showScrollTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
        aria-label={language === "fa" ? "رفتن به بالای صفحه" : "Scroll to top"}
        title={language === "fa" ? "رفتن به بالای صفحه" : "Scroll to top"}
      >
        <ArrowUp size={20} />
      </button>

      <PaymentMethodModal
        isOpen={isPaymentMethodModalOpen}
        onClose={() => setIsPaymentMethodModalOpen(false)}
        onSelectHesabPay={startHesabPayPurchase}
        onSelectNowPayments={startNowPaymentsPurchase}
        onSelectBank={handleOpenBankDetails}
        language={language}
        courseTitle={course?.title || ""}
        hesabPayAmountLabel={hesabPayAmountLabel}
        cryptoAmountLabel={cryptoPreviewLabel || cryptoAmountLabel}
        bankOptionCountryCode={countryCode}
        isBankPaymentAvailable={Boolean(course?.bankPaymentAvailable)}
        isLoading={isStartingPayment}
        isBankLoading={isBankDetailsLoading}
      />
      <BankPaymentDetailsModal
        isOpen={isBankDetailsModalOpen}
        onClose={() => setIsBankDetailsModalOpen(false)}
        details={bankPaymentDetails}
        language={language}
        onSubmitProof={handleSubmitBankProof}
        isSubmittingProof={isSubmittingBankProof}
      />
    </section>
  );
}
