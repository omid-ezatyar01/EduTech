import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  confirmStudentPaymentRedirect,
  createCheckout,
  getPaymentAttemptStatus,
  getStudentPaymentStatusByOrder,
  getStudentPaymentStatus,
} from "../../services/paymentGateway.js";
import { getAuthUser } from "../../services/portal.js";
import {
  getLocalizedRequestErrorMessage,
  invalidateApiCache,
} from "../../services/http.js";
import {
  forgetHostedPaymentAttempt,
  resolveHostedPaymentReturn,
} from "../utils/hostedPaymentReturn.js";

const statusMeta = {
  paid: {
    titleFa: "پرداخت موفق شد",
    textFa: "پرداخت موفق بود. کورس شما اکنون فعال شده است.",
    titleEn: "Payment successful",
    textEn: "Payment successful. Your course is now active.",
    icon: CheckCircle2,
    color: "text-green-600 bg-green-50 border-green-100",
  },
  succeeded: {
    titleFa: "پرداخت موفق شد",
    textFa: "پرداخت تایید شد و کورس شما اکنون فعال شده است.",
    titleEn: "Payment successful",
    textEn: "Payment confirmed. Your course is now active.",
    icon: CheckCircle2,
    color: "text-green-600 bg-green-50 border-green-100",
  },
  duplicate_payment: {
    titleFa: "پرداخت تکراری نیازمند پیگیری است",
    textFa: "ممکن است پول این پرداخت پس از پرداخت قبلی کسر شده باشد. دوباره پرداخت نکنید؛ برای بررسی و بازپرداخت با پشتیبانی تماس بگیرید.",
    titleEn: "Duplicate payment needs attention",
    textEn: "Money may have been charged after an earlier payment completed. Do not pay again; contact support for review and a possible refund.",
    icon: AlertTriangle,
    color: "text-amber-700 bg-amber-50 border-amber-200",
  },
  manual_review: {
    titleFa: "پرداخت نیازمند بررسی دستی است",
    textFa: "دوباره پرداخت نکنید. پشتیبانی پرداخت و فعال‌سازی کورس را بررسی می‌کند.",
    titleEn: "Payment needs manual review",
    textEn: "Do not pay again. Support must review the payment and course activation.",
    icon: AlertTriangle,
    color: "text-amber-700 bg-amber-50 border-amber-200",
  },
  pending: {
    titleFa: "پرداخت در حال بررسی است",
    textFa: "پرداخت دریافت شد و در حال بررسی است.",
    titleEn: "Payment is pending verification",
    textEn: "Payment received. We are verifying your payment.",
    icon: Clock3,
    color: "text-amber-600 bg-amber-50 border-amber-100",
  },
  failed: {
    titleFa: "پرداخت ناموفق بود",
    textFa: "پرداخت ناموفق بود. لطفاً دوباره تلاش کنید.",
    titleEn: "Payment failed",
    textEn: "Payment failed.",
    icon: XCircle,
    color: "text-rose-600 bg-rose-50 border-rose-100",
  },
  expired: {
    titleFa: "جلسه پرداخت منقضی شده است",
    textFa: "اگر پول کم نشده است، می‌توانید جلسه پرداخت جدید ایجاد کنید. اگر پول کم شده است، دوباره پرداخت نکنید و شناسه را از بخش پرداخت‌ها پیگیری کنید.",
    titleEn: "Payment session expired",
    textEn: "If you were not charged, you can create a new payment session. If you were charged, do not pay again and follow up using Payment History.",
    icon: XCircle,
    color: "text-rose-600 bg-rose-50 border-rose-100",
  },
  refunded: {
    titleFa: "پرداخت بازپرداخت شده است",
    textFa: "این پرداخت بازپرداخت شده است. برای جزئیات بیشتر تاریخچه پرداخت را بررسی کنید.",
    titleEn: "Payment refunded",
    textEn: "This payment was refunded. Check Payment History for details.",
    icon: AlertTriangle,
    color: "text-blue-700 bg-blue-50 border-blue-200",
  },
  cancelled: {
    titleFa: "پرداخت لغو شده است",
    textFa: "این پرداخت تکمیل نشده است.",
    titleEn: "Payment cancelled",
    textEn: "This payment was not completed.",
    icon: XCircle,
    color: "text-rose-600 bg-rose-50 border-rose-100",
  },
  canceled: {
    titleFa: "پرداخت لغو شده است",
    textFa: "این پرداخت تکمیل نشده است.",
    titleEn: "Payment cancelled",
    textEn: "This payment was not completed.",
    icon: XCircle,
    color: "text-rose-600 bg-rose-50 border-rose-100",
  },
};

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const authUser = useMemo(() => getAuthUser() || {}, []);
  const paymentReturn = useMemo(
    () => resolveHostedPaymentReturn({ searchParams, user: authUser }),
    [authUser, searchParams],
  );
  const { reference, paymentAttemptId, orderId } = paymentReturn;
  const hasPaymentReference = Boolean(reference || paymentAttemptId || orderId);
  const [status, setStatus] = useState("pending");
  const [courseTitle, setCourseTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [loading, setLoading] = useState(true);
  const [isRestarting, setIsRestarting] = useState(false);
  const [error, setError] = useState("");
  const [retrySeed, setRetrySeed] = useState(0);

  const language = useMemo(() => {
    const saved = localStorage.getItem("edutech-language");
    return saved === "en" ? "en" : "fa";
  }, []);

  useEffect(() => {
    if (!hasPaymentReference) return undefined;

    let isMounted = true;
    let pollTimer = null;
    let attempts = 0;
    const maxAttempts = 12;

    const redirectToCourses = () => {
      invalidateApiCache((key) =>
        key.includes("/student/enrollments") ||
        key.includes("/student/learning-stats") ||
        key.includes("/student/live-sessions") ||
        key.includes("/student/payments") ||
        key.includes("/courses"),
      );
      window.dispatchEvent(new Event("edutech_data_changed"));
      navigate("/student/courses", { replace: true });
    };

    const checkStatus = async () => {
      try {
        if (!paymentAttemptId && reference && attempts === 0) {
          await confirmStudentPaymentRedirect(reference).catch((err) => {
            if (err?.status !== 409) throw err;
          });
        }

        const payment = paymentAttemptId
          ? await getPaymentAttemptStatus(paymentAttemptId)
          : reference
            ? { payment: await getStudentPaymentStatus(reference) }
            : await getStudentPaymentStatusByOrder(orderId);
        if (!isMounted) return;

        const nextStatus = String(
          payment?.status || payment?.payment?.status || "pending",
        ).toLowerCase();
        setStatus(nextStatus);
        const paymentDetails = payment?.payment || {};
        const paymentCourse = paymentDetails.courseId || payment?.course || null;
        setCourseTitle(paymentCourse?.title || payment?.course?.title || "");
        setCourseId(String(paymentCourse?._id || paymentCourse || ""));
        setPaymentMethod(String(paymentDetails.method || "").toUpperCase());
        setError("");

        if (["paid", "succeeded"].includes(nextStatus)) {
          forgetHostedPaymentAttempt({
            paymentAttemptId: payment?.paymentAttemptId || paymentAttemptId,
            reference: payment?.payment?.paymentReference || reference,
            orderId: payment?.orderId || orderId,
            user: authUser,
          });
          redirectToCourses();
          return;
        }

        if (["failed", "expired", "refunded", "cancelled", "canceled"].includes(nextStatus)) {
          forgetHostedPaymentAttempt({
            paymentAttemptId: payment?.paymentAttemptId || paymentAttemptId,
            reference: payment?.payment?.paymentReference || reference,
            orderId: payment?.orderId || orderId,
            user: authUser,
          });
        }

        if (["pending", "manual_review"].includes(nextStatus) && attempts < maxAttempts) {
          attempts += 1;
          pollTimer = setTimeout(checkStatus, 5000);
          return;
        }
      } catch (err) {
        if (!isMounted) return;
        setError(
          getLocalizedRequestErrorMessage(
            err,
            language,
            "بررسی وضعیت پرداخت ممکن نشد.",
            "Unable to verify payment status.",
          ),
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [
    authUser,
    hasPaymentReference,
    language,
    navigate,
    orderId,
    paymentAttemptId,
    reference,
    retrySeed,
  ]);

  const meta = statusMeta[status] || statusMeta.pending;
  const Icon = meta.icon;
  const title = language === "fa" ? meta.titleFa : meta.titleEn;
  const text = language === "fa" ? meta.textFa : meta.textEn;
  const needsSupport = ["duplicate_payment", "manual_review"].includes(status);
  const canRestartExpiredHesab =
    status === "expired" &&
    Boolean(courseId) &&
    (!paymentMethod || paymentMethod === "HESABPAY_HOSTED");

  const restartExpiredHesabPayment = async () => {
    const confirmed = window.confirm(
      language === "fa"
        ? "فقط اگر پول از حساب شما کم نشده است ادامه دهید. آیا می‌خواهید یک جلسه پرداخت جدید ایجاد شود؟"
        : "Continue only if your account was not charged. Create a new payment session?",
    );
    if (!confirmed) return;

    try {
      setIsRestarting(true);
      setError("");
      const checkout = await createCheckout({
        courseId,
        paymentMethod: "HESABPAY_HOSTED",
        restartExpired: true,
      });
      if (checkout?.paymentUrl) {
        window.location.assign(checkout.paymentUrl);
        return;
      }
      if (checkout?.paymentAttemptId) {
        navigate(
          `/payment/success?paymentAttemptId=${encodeURIComponent(checkout.paymentAttemptId)}`,
          { replace: true },
        );
        setRetrySeed((value) => value + 1);
        return;
      }
      throw new Error("Payment URL not received from server");
    } catch (err) {
      setError(
        getLocalizedRequestErrorMessage(
          err,
          language,
          "ایجاد جلسه پرداخت جدید ممکن نشد.",
          "Unable to create a new payment session.",
        ),
      );
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <section className="min-h-[70vh] bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div
          className={`mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full border ${meta.color}`}
        >
          <Icon size={30} />
        </div>

        <h1 className="text-2xl font-black text-slate-950">{title}</h1>

        {!hasPaymentReference ? (
          <p className="mt-3 text-sm font-semibold text-rose-600">
            {language === "fa" ? "شناسه پرداخت نامعتبر است." : "Invalid payment reference."}
          </p>
        ) : loading ? (
          <p className="mt-3 text-sm font-semibold text-slate-500">
            {language === "fa" ? "در حال بررسی وضعیت پرداخت" : "Checking payment status"}
          </p>
        ) : error ? (
          <div className="mt-3">
            <p className="text-sm font-semibold text-rose-600">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setRetrySeed((value) => value + 1);
              }}
              className="mt-4 rounded-xl bg-rose-50 px-4 py-2 text-sm font-black text-rose-700"
            >
              {language === "fa" ? "بررسی دوباره" : "Check again"}
            </button>
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm font-semibold text-slate-600">{text}</p>
            {courseTitle ? (
              <p className="mt-2 text-sm font-black text-slate-900">
                {language === "fa" ? "کورس:" : "Course:"} {courseTitle}
              </p>
            ) : null}
            {needsSupport ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-start text-sm font-semibold leading-6 text-amber-900">
                <p>
                  {language === "fa"
                    ? "این وضعیت موفقیت عادی نیست و به‌صورت خودکار به کورس‌های شما منتقل نمی‌شوید. شناسه پرداخت را برای پشتیبانی نگه دارید."
                    : "This is not a normal success state, so you will not be redirected automatically. Keep the payment reference for support."}
                </p>
                {reference || paymentAttemptId ? (
                  <p className="mt-2 break-all font-mono text-xs" dir="ltr">
                    {reference || paymentAttemptId}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {canRestartExpiredHesab ? (
            <button
              type="button"
              onClick={restartExpiredHesabPayment}
              disabled={isRestarting}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRestarting
                ? language === "fa" ? "در حال ایجاد..." : "Creating..."
                : language === "fa" ? "ایجاد جلسه پرداخت جدید" : "Start a new payment"}
            </button>
          ) : null}
          <Link
            to="/student/courses"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-600 px-5 text-sm font-black text-white transition hover:bg-primary-700"
          >
            {language === "fa" ? "رفتن به کورس‌های من" : "Go to my courses"}
          </Link>
          <Link
            to="/student/payments"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            {language === "fa" ? "تاریخچه پرداخت" : "Payment history"}
          </Link>
          {needsSupport ? (
            <Link
              to="/student/support"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-5 text-sm font-black text-amber-800 transition hover:bg-amber-100"
            >
              {language === "fa" ? "تماس با پشتیبانی" : "Contact support"}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
