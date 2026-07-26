import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Loader2,
  CalendarDays,
  Clock3,
  BadgePercent,
  Star,
  Share2,
  UsersRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  createCheckout,
  getCourseBankPaymentDetails,
  submitBankTransferPayment,
} from "../../services/paymentGateway.js";
import { enrollCourse } from "../../services/courseService.js";
import { getLocalizedRequestErrorMessage } from "../../services/http.js";
import { resolveAvatarUrl } from "../utils/avatar";
import { buildCoursePath, buildTeacherPath } from "../utils/routePaths.js";
import PaymentMethodModal from "./PaymentMethodModal.jsx";
import BankPaymentDetailsModal from "./BankPaymentDetailsModal.jsx";
import { shareContent } from "../utils/share";
import {
  useCryptoUsdtQuoteLabel,
  useCourseRegionalPrice,
  useRegionalPricing,
} from "../context/RegionalPricingContext.jsx";
import {
  calculateHesabPayAfnAmount,
  calculateRegionalUsdAmount,
} from "../utils/checkoutPriceDisplay.js";
import {
  canEnrollFromPublicState,
  getPublicActionLabel,
  getPublicStateKey,
  getPublicStateLabel,
  getPublicStateMessage,
  getPublicStateTone,
} from "../utils/coursePublicState.js";

const fallbackCourseImage = "/logo.png";
const COURSE_IMAGE_ASPECT_RATIO = "750 / 422";

function resolveMediaUrl(value) {
  if (!value || typeof value !== "string") return "";
  if (value.startsWith("/uploads/")) return resolveAvatarUrl(value);
  return value;
}

function getInitials(value = "") {
  const words = String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "NA";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
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
  if (diffMs <= 0) return "";

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

export default function CourseCard({
  course,
  labels,
  dir = "rtl",
  language = "fa",
  isEnrolled = false,
  coursePathOverride = "",
}) {
  const { countryCode, rates, pricingRegion } = useRegionalPricing();
  const coursePricing = useCourseRegionalPrice(course, language);
  const isCourseFree = coursePricing.isFree;
  const uiText = {
    instructor: language === "fa" ? "مدرس" : "Instructor",
    free: language === "fa" ? "رایگان" : "Free",
    discount: language === "fa" ? "تخفیف" : "OFF",
    seeDetails: language === "fa" ? "جزئیات کورس" : "See Details",
    noDescription:
      language === "fa"
        ? "در این کورس مهارت‌های عملی و کاربردی را با تمرین‌های واقعی یاد می‌گیرید."
        : "Learn practical and in-demand skills through hands-on projects and guided sessions.",
    students: language === "fa" ? "شاگرد" : "students",
    level: language === "fa" ? "سطح" : "Level",
    rating: language === "fa" ? "امتیاز" : "Rating",
    priceTitle: language === "fa" ? "قیمت کورس" : "Course Price",
    enrolled: language === "fa" ? "شما در این کورس ثبت‌نام کرده‌اید" : "You are already enrolled",
  };

  const ArrowIcon = dir === "rtl" ? ArrowLeft : ArrowRight;
  const navigate = useNavigate();
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isBankDetailsModalOpen, setIsBankDetailsModalOpen] = useState(false);
  const [isBankDetailsLoading, setIsBankDetailsLoading] = useState(false);
  const [isSubmittingBankProof, setIsSubmittingBankProof] = useState(false);
  const [bankPaymentDetails, setBankPaymentDetails] = useState(null);
  const [hesabPayAmountLabel, setHesabPayAmountLabel] = useState("");
  const [cryptoPreviewLabel, setCryptoPreviewLabel] = useState("");
  const buyLabel = isCourseFree
    ? language === "fa"
      ? "ثبت‌نام رایگان"
      : "Join for Free"
    : language === "fa"
      ? "خرید کورس"
      : "Buy Course";
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [failedAvatarKey, setFailedAvatarKey] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const teacherName =
    course?.teacherName ||
    course?.teacher ||
    (language === "fa" ? "مدرس کورس" : "Course Instructor");
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
    ? buildTeacherPath({ _id: teacherId, name: teacherName })
    : "";
  const teacherAvatar = resolveMediaUrl(course?.teacherAvatar || "");
  const teacherInitials = getInitials(teacherName);
  const avatarKey = `${course?._id || course?.id || ""}:${teacherAvatar}`;
  const hasTeacherAvatar = Boolean(teacherAvatar) && failedAvatarKey !== avatarKey;

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const courseImage =
    resolveMediaUrl(course?.thumbnail || course?.image || course?.coverImage) ||
    fallbackCourseImage;
  const description = String(course?.description || uiText.noDescription).trim();

  const rawPrice = Number(course?.price || 0);
  const hasDiscount = coursePricing.originalPrice > coursePricing.finalPrice;
  const discountPercent =
    hasDiscount && coursePricing.originalPrice > 0
      ? Math.round(
          ((coursePricing.originalPrice - coursePricing.finalPrice) /
            coursePricing.originalPrice) *
            100,
        )
      : Number(course?.discountPercent || 0);

  const priceLabel = coursePricing.finalLabel;
  const oldPriceLabel = hasDiscount ? coursePricing.originalLabel : "";
  const legacyCryptoAmountLabel = useCryptoUsdtQuoteLabel(rawPrice, language);
  const cryptoAmountLabel =
    coursePricing.pricingType === "regional"
      ? `${language === "fa" ? "پرداخت رمزارزی:" : "Crypto payment:"} ${new Intl.NumberFormat("en-US", {
          maximumFractionDigits: 2,
        }).format(calculateRegionalUsdAmount({
          coursePricing,
          rates: { AFN: rates?.AFN, IRR: rates?.IRR },
        }))} USDT`
      : legacyCryptoAmountLabel;
  const rating = Number(course?.rating || 0);
  const ratingCount = Math.max(0, Number(course?.ratingCount || 0));
  const studentsCount = Math.max(0, Number(course?.enrolledStudentsCount || 0));
  const courseStartAt = resolveCourseStartAt(course);
  const countdownText = formatCountdown(courseStartAt, nowMs, language);
  const isSpecialCourse = course?.courseType === "special";
  const coursePath = coursePathOverride || buildCoursePath(course);
  const publicStateKey = getPublicStateKey(course);
  const publicStateLabel = getPublicStateLabel(course, language);
  const publicStateMessage = getPublicStateMessage(course, language);
  const publicStateTone = getPublicStateTone(course);
  const canEnroll = canEnrollFromPublicState(course);
  const publicActionLabel = getPublicActionLabel(course, language, isEnrolled);
  const workspacePath =
    course?.publicState?.primaryAction?.url ||
    `/student/course/${encodeURIComponent(course?._id || course?.id || "")}`;
  const handleShareCourse = async () => {
    const shared = await shareContent({
      title: course?.title || "EduTech Course",
      text:
        language === "fa"
          ? "این کورس را در EduTech ببینید."
          : "View this course on EduTech.",
      path: coursePath,
      previewPath: `/share/course/${encodeURIComponent(course.slug || course._id || course.id)}`,
    });
    if (shared && !navigator.share) {
      alert(language === "fa" ? "لینک کورس کپی شد." : "Course link copied.");
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadPaymentPreviewLabels = async () => {
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
    cryptoAmountLabel,
    isPaymentMethodModalOpen,
    isCourseFree,
    language,
    rawPrice,
    rates?.AFN,
    rates?.IRR,
  ]);

  const startHesabPayPurchase = async () => {
    if (isStartingPayment) return;

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
    } catch (error) {
      if (error.message === "NOT_AUTHENTICATED") {
        navigate("/login");
        return;
      }
      if (String(error.message || "").toLowerCase().includes("already enrolled")) {
        navigate("/student/courses");
        return;
      }
      alert(
        getLocalizedRequestErrorMessage(
          error,
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
    if (isStartingPayment) return;

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
      }
    } catch (error) {
      if (error.message === "NOT_AUTHENTICATED") {
        navigate("/login");
        return;
      }
      alert(getLocalizedRequestErrorMessage(error, language, "شروع پرداخت ممکن نشد.", "Unable to start payment."));
    } finally {
      setIsStartingPayment(false);
    }
  };

  const handleBuy = () => {
    if (isStartingPayment) return;

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
    if (isBankDetailsLoading) return;

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

  return (
    <article
      className="group relative mx-auto flex h-full w-full max-w-[390px] flex-col overflow-hidden rounded-[22px] border border-slate-200/90 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-[0_18px_42px_rgba(15,23,42,0.13)]"
    >
      <div
        className="relative w-full overflow-hidden bg-slate-100"
        style={{ aspectRatio: COURSE_IMAGE_ASPECT_RATIO }}
      >
        <Link to={coursePath} aria-label={course?.title || uiText.seeDetails}>
          <img
            src={courseImage}
            alt={course?.title || "Course"}
            className={`block h-full w-full object-center transition duration-500 group-hover:scale-[1.04] ${
              courseImage === fallbackCourseImage ? "object-contain p-8" : "object-cover"
            }`}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = fallbackCourseImage;
              event.currentTarget.className =
                "block h-full w-full object-contain object-center p-8 transition duration-500 group-hover:scale-[1.04]";
            }}
          />
        </Link>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-950/45 to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex rounded-full border border-white/20 bg-slate-950/70 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur-sm">
              {course.level}
            </span>
            {isSpecialCourse ? (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-400 px-2.5 text-[10px] font-black leading-none text-amber-950 shadow-sm">
                <Star size={12} fill="currentColor" className="shrink-0" />
                <span className="leading-none">{language === "fa" ? "ویژه" : "Special"}</span>
              </span>
            ) : null}
          </div>
          {discountPercent > 0 && !isCourseFree ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
              <BadgePercent size={12} />
              {discountPercent}% {uiText.discount}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleShareCourse}
          aria-label={language === "fa" ? "اشتراک‌گذاری کورس" : "Share course"}
          className="absolute bottom-3 end-3 grid h-9 w-9 place-items-center rounded-full border border-white/70 bg-white/95 text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.18)] transition hover:bg-primary-600 hover:text-white"
        >
          <Share2 size={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-[18px]">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {hasTeacherAvatar ? (
              <img
                src={teacherAvatar}
                alt={teacherName}
                className="h-7 w-7 shrink-0 rounded-full border border-slate-200 bg-white object-cover object-center"
                onError={() => setFailedAvatarKey(avatarKey)}
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[9px] font-black leading-none text-slate-700">
                {teacherInitials}
              </div>
            )}
            <p className="truncate text-xs font-bold text-slate-500">
              {uiText.instructor}{" "}
              {teacherProfilePath ? (
                <Link
                  className="font-black text-slate-800 underline-offset-2 transition hover:text-primary-700 hover:underline"
                  to={teacherProfilePath}
                >
                  {teacherName}
                </Link>
              ) : (
                <span className="font-black text-slate-800">{teacherName}</span>
              )}
            </p>
          </div>
          {publicStateLabel ? (
            <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${publicStateTone}`}>
              {publicStateLabel}
            </span>
          ) : null}
        </div>

        <Link to={coursePath} className="mt-3 block">
          <h3
            className="min-h-12 text-base font-black leading-6 text-slate-950 transition group-hover:text-primary-700"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {course.title}
          </h3>
        </Link>
        <p
          dir="auto"
          className="mt-1.5 min-h-10 text-[13px] leading-5 text-slate-500 [overflow-wrap:anywhere] break-words"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {description}
        </p>
        {!canEnroll && publicStateMessage ? (
          <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] font-bold leading-4 text-slate-600">
            {publicStateMessage}
          </p>
        ) : null}

        <div className="mt-auto pt-3">
          {!isEnrolled ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <div className="flex items-end justify-between gap-3">
                <p className="text-[11px] font-black text-slate-500">
                  {uiText.priceTitle}
                </p>
                <div className="flex flex-wrap items-baseline justify-end gap-x-2" dir="ltr">
                  {hasDiscount ? (
                    <span className="text-xs font-bold text-slate-400 line-through">
                      {oldPriceLabel}
                    </span>
                  ) : null}
                  <span className={`font-black ${isCourseFree ? "text-base text-emerald-700" : "text-xl text-slate-950"}`}>
                    {isCourseFree ? uiText.free : priceLabel}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">
              {uiText.enrolled}
            </p>
          )}

          {countdownText ||
          (course?.publicState?.remainingSeats !== null &&
            course?.publicState?.remainingSeats !== undefined &&
            !["completed", "canceled"].includes(publicStateKey)) ? (
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {countdownText ? (
                <div className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-sky-50 px-2.5 py-2 text-[11px] font-black text-sky-800">
                  <Clock3 size={14} className="shrink-0" />
                  <span className="leading-4">{countdownText}</span>
                </div>
              ) : null}
              {course?.publicState?.remainingSeats !== null &&
              course?.publicState?.remainingSeats !== undefined &&
              !["completed", "canceled"].includes(publicStateKey) ? (
                <div className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] font-black text-amber-800">
                  <UsersRound size={14} className="shrink-0" />
                  <span>
                    {language === "fa"
                      ? `${Number(course.publicState.remainingSeats).toLocaleString("fa-AF")} جای باقی مانده`
                      : `${Number(course.publicState.remainingSeats).toLocaleString("en-US")} seats remaining`}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white text-center text-[10px] font-bold text-slate-500 rtl:divide-x-reverse">
            <div className="flex min-w-0 items-center justify-center gap-1 px-1.5 py-2">
              <Star size={13} fill="currentColor" className="shrink-0 text-amber-500" />
              <span className="truncate text-slate-700">
                {ratingCount > 0
                  ? rating.toFixed(1)
                  : language === "fa"
                    ? "بدون امتیاز"
                    : "No rating"}
              </span>
            </div>
            <div className="truncate px-1.5 py-2">
              {uiText.level} {course?.level || "-"}
            </div>
            <div className="flex min-w-0 items-center justify-center gap-1 px-1.5 py-2">
              <UsersRound size={13} className="shrink-0" />
              <span className="truncate">
                {studentsCount.toLocaleString()} {uiText.students}
              </span>
            </div>
          </div>

          <div
            className={`mt-3 grid grid-cols-1 gap-2 ${
              isEnrolled || canEnroll ? "sm:grid-cols-2" : ""
            }`}
          >
            <Link
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
              to={coursePath}
            >
              <CalendarDays size={15} />
              {labels.details || uiText.seeDetails}
              <ArrowIcon size={15} />
            </Link>

            {isEnrolled ? (
              <Link
                to={workspacePath}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-700 to-primary-600 px-3 text-xs font-black text-white shadow-sm transition hover:from-primary-600 hover:to-primary-500"
              >
                <ArrowIcon size={15} />
                {publicActionLabel}
              </Link>
            ) : canEnroll ? (
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-700 to-primary-600 px-3 text-xs font-black text-white shadow-sm transition hover:from-primary-600 hover:to-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={handleBuy}
                disabled={isStartingPayment}
              >
                {isStartingPayment ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    {language === "fa" ? "در حال انتقال" : "Redirecting"}
                  </>
                ) : (
                  <>
                    <CreditCard size={15} />
                    {publicActionLabel || buyLabel}
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>

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
    </article>
  );
}
