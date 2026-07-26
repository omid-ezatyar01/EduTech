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
      className="group relative mx-auto flex h-full w-full max-w-[390px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.08)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(15,23,42,0.14)]"
    >
      <div
        className="relative w-full overflow-hidden bg-slate-100"
        style={{ aspectRatio: COURSE_IMAGE_ASPECT_RATIO }}
      >
        <img
          src={courseImage}
          alt={course?.title || "Course"}
          className={`block h-full w-full object-center transition duration-300 group-hover:scale-[1.01] ${
            courseImage === fallbackCourseImage ? "object-contain p-8" : "object-contain"
          }`}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = fallbackCourseImage;
            event.currentTarget.className =
              "block h-full w-full object-contain object-center p-8 transition duration-300 group-hover:scale-[1.01]";
          }}
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex rounded-md bg-black/65 px-2 py-1 text-[11px] font-bold text-white">
              {course.level}
            </span>
            {isSpecialCourse ? (
              <span className="inline-flex h-6 items-center gap-1 rounded-md bg-amber-500 px-2 text-[11px] font-black leading-none text-white shadow-sm">
                <Star size={12} fill="currentColor" className="shrink-0" />
                <span className="leading-none">{language === "fa" ? "ویژه" : "Special"}</span>
              </span>
            ) : null}
          </div>
          {discountPercent > 0 && !isCourseFree ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-black text-white">
              <BadgePercent size={12} />
              {discountPercent}% {uiText.discount}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleShareCourse}
          aria-label={language === "fa" ? "اشتراک‌گذاری کورس" : "Share course"}
          className="absolute bottom-3 end-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-slate-800 shadow-lg transition hover:bg-primary-600 hover:text-white"
        >
          <Share2 size={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {publicStateLabel ? (
          <div className="mb-3">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${publicStateTone}`}>
              {publicStateLabel}
            </span>
            {publicStateMessage ? (
              <p className="mt-1.5 text-xs font-bold leading-5 text-slate-500">
                {publicStateMessage}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mb-3 flex items-center gap-2">
          {hasTeacherAvatar ? (
            <img
              src={teacherAvatar}
              alt={teacherName}
              className="h-6 w-6 rounded-full border border-slate-200 bg-white object-cover object-center"
              onError={() => setFailedAvatarKey(avatarKey)}
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[9px] font-black leading-none text-slate-700">
              {teacherInitials}
            </div>
          )}
          <p className="truncate text-sm font-bold text-slate-900">
            {uiText.instructor}{" "}
            {teacherProfilePath ? (
              <Link
                className="text-primary-700 underline-offset-2 transition hover:text-primary-800 hover:underline"
                to={teacherProfilePath}
              >
                {teacherName}
              </Link>
            ) : (
              teacherName
            )}
          </p>
        </div>

        <h3 className="text-[1.05rem] font-black leading-7 text-slate-950">
          {course.title}
        </h3>
        <p
          dir="auto"
          className="mt-2 text-sm leading-6 text-slate-600 [overflow-wrap:anywhere] break-words"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {description}
        </p>

        <div className="mt-auto pt-4">
          {!isEnrolled ? (
            <div className={`${language === "fa" ? "text-right" : "text-left"}`}>
              <p className="text-xs font-black tracking-wide text-slate-500">
                {uiText.priceTitle}
              </p>
              <p className="text-[1.15rem] font-black text-slate-950" dir="ltr">
                {isCourseFree ? uiText.free : priceLabel}
              </p>
              {hasDiscount ? (
                <p className="text-sm font-bold text-slate-400 line-through" dir="ltr">
                  {oldPriceLabel}
                </p>
              ) : null}
              {usdBaseLabel ? (
                <p className="mt-1 text-[11px] font-bold text-slate-500" dir="ltr">
                  {usdBaseLabel}
                </p>
              ) : null}
              {exchangeRateLabel ? (
                <p className="mt-0.5 text-[10px] font-semibold text-slate-400" dir="ltr">
                  {exchangeRateLabel}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
              {uiText.enrolled}
            </p>
          )}

          {countdownText ? (
            <div className="mt-4 inline-flex w-full items-center gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-black text-sky-800">
              <Clock3 size={14} />
              <span>{countdownText}</span>
            </div>
          ) : null}

          {course?.publicState?.remainingSeats !== null &&
          course?.publicState?.remainingSeats !== undefined &&
          !["completed", "canceled"].includes(publicStateKey) ? (
            <p className="mt-3 text-xs font-black text-slate-600">
              {language === "fa"
                ? `${Number(course.publicState.remainingSeats).toLocaleString("fa-AF")} جای باقی مانده`
                : `${Number(course.publicState.remainingSeats).toLocaleString("en-US")} seats remaining`}
            </p>
          ) : null}

          <div className={`mt-4 text-sm text-slate-500 ${language === "fa" ? "text-right" : "text-left"}`}>
            <p className="inline-flex flex-wrap items-center gap-1.5">
              <Star size={14} fill="currentColor" className="text-amber-500" />
              <span className="font-black text-slate-700">
                {ratingCount > 0
                  ? `${uiText.rating} ${rating.toFixed(1)}`
                  : language === "fa"
                    ? "هنوز امتیازی نیست"
                    : "No ratings yet"}
              </span>
              <span className="text-slate-300">|</span>
              <span>
                {uiText.level} {course?.level || "-"}
              </span>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center gap-1">
                <UsersRound size={14} />
                {uiText.students} {studentsCount.toLocaleString()}
              </span>
            </p>
          </div>

          <div
            className={`mt-4 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 ${
              isEnrolled || canEnroll ? "sm:grid-cols-2" : ""
            }`}
          >
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
              to={coursePath}
            >
              <CalendarDays size={15} />
              {labels.details || uiText.seeDetails}
              <ArrowIcon size={15} />
            </Link>

            {isEnrolled ? (
              <Link
                to={workspacePath}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-primary-700 to-primary-600 px-3 text-sm font-black text-white transition hover:from-primary-600 hover:to-primary-500"
              >
                <ArrowIcon size={15} />
                {publicActionLabel}
              </Link>
            ) : canEnroll ? (
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-primary-700 to-primary-600 px-3 text-sm font-black text-white transition hover:from-primary-600 hover:to-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
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
