import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  confirmStudentPaymentRedirect,
  getPaymentAttemptStatus,
  getStudentPaymentStatus,
} from "../../services/paymentGateway.js";
import {
  getLocalizedRequestErrorMessage,
  invalidateApiCache,
} from "../../services/http.js";

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
};

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reference = searchParams.get("ref");
  const paymentAttemptId = searchParams.get("paymentAttemptId");
  const [status, setStatus] = useState("pending");
  const [courseTitle, setCourseTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const language = useMemo(() => {
    const saved = localStorage.getItem("edutech-language");
    return saved === "en" ? "en" : "fa";
  }, []);

  useEffect(() => {
    if (!reference && !paymentAttemptId) {
      setError(language === "fa" ? "شناسه پرداخت نامعتبر است." : "Invalid payment reference.");
      setLoading(false);
      return;
    }

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
        if (!paymentAttemptId && attempts === 0) {
          await confirmStudentPaymentRedirect(reference).catch((err) => {
            if (err?.status !== 409) throw err;
          });
        }

        const payment = paymentAttemptId
          ? await getPaymentAttemptStatus(paymentAttemptId)
          : { payment: await getStudentPaymentStatus(reference) };
        if (!isMounted) return;

        const nextStatus = paymentAttemptId
          ? String(payment?.status || "PENDING").toLowerCase()
          : payment?.payment?.status || payment?.status || "pending";
        setStatus(nextStatus);
        setCourseTitle(payment?.payment?.courseId?.title || payment?.course?.title || "");
        setError("");

        if (nextStatus === "paid" || nextStatus === "succeeded") {
          redirectToCourses();
          return;
        }

        if (nextStatus === "pending" && attempts < maxAttempts) {
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
        if (!isMounted) return;
        setLoading(false);
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [language, navigate, paymentAttemptId, reference]);

  const meta = statusMeta[status] || statusMeta.pending;
  const Icon = meta.icon;
  const title = language === "fa" ? meta.titleFa : meta.titleEn;
  const text = language === "fa" ? meta.textFa : meta.textEn;

  return (
    <section className="min-h-[70vh] bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div
          className={`mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full border ${meta.color}`}
        >
          <Icon size={30} />
        </div>

        <h1 className="text-2xl font-black text-slate-950">{title}</h1>

        {loading ? (
          <p className="mt-3 text-sm font-semibold text-slate-500">
            {language === "fa" ? "در حال بررسی وضعیت پرداخت" : "Checking payment status"}
          </p>
        ) : error ? (
          <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>
        ) : (
          <>
            <p className="mt-3 text-sm font-semibold text-slate-600">{text}</p>
            {courseTitle ? (
              <p className="mt-2 text-sm font-black text-slate-900">
                {language === "fa" ? "کورس:" : "Course:"} {courseTitle}
              </p>
            ) : null}
          </>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
        </div>
      </div>
    </section>
  );
}
