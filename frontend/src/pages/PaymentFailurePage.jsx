import { AlertTriangle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

export default function PaymentFailurePage() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("ref");
  const language =
    localStorage.getItem("edutech-language") === "en" ? "en" : "fa";

  return (
    <section className="min-h-[70vh] bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full border border-rose-100 bg-rose-50 text-rose-600">
          <AlertTriangle size={30} />
        </div>

        <h1 className="text-2xl font-black text-slate-950">
          {language === "fa" ? "پرداخت ناموفق بود" : "Payment failed"}
        </h1>
        <p className="mt-3 text-sm font-semibold text-slate-600">
          {language === "fa"
            ? "پرداخت تکمیل نشد. لطفاً دوباره تلاش کنید یا روش پرداخت دیگری انتخاب کنید."
            : "Your payment was not completed. Please retry or use a different payment method."}
        </p>

        {reference ? (
          <p className="mt-3 text-xs font-bold text-slate-500">
            Ref: {reference}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/live-courses"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-600 px-5 text-sm font-black text-white transition hover:bg-primary-700"
          >
            {language === "fa" ? "تلاش دوباره" : "Try again"}
          </Link>
          <Link
            to="/student/payments"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            {language === "fa" ? "رفتن به پرداخت‌ها" : "Go to payments"}
          </Link>
        </div>
      </div>
    </section>
  );
}
