import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { legalContent } from "../data/legalContent.js";

export default function TermsPage({ language = "fa" }) {
  const isFa = language === "fa";
  const dir = isFa ? "rtl" : "ltr";
  const localized = legalContent[language] || legalContent.fa;
  const data = localized.terms;
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo =
    typeof location.state?.from === "string" && location.state.from.startsWith("/")
      ? location.state.from
      : "/";

  const handleBack = () => {
    if (returnTo && returnTo !== location.pathname) {
      navigate(returnTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-12 pt-8 font-sans text-slate-900" dir={dir}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <button
            type="button"
            onClick={handleBack}
            className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
          >
            {isFa ? "بازگشت" : "Back"}
          </button>
          <p className="text-sm font-bold text-primary-600">{data.updatedAt}</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">
            {data.title}
          </h1>
          <p className="mt-2 text-lg font-bold text-slate-700">{data.subtitle}</p>
          <p className="mt-6 text-base leading-8 text-slate-600">{data.intro}</p>

          <div className="mt-8 space-y-6">
            {data.sections.map((section) => (
              <article key={section.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <h2 className="text-lg font-black text-slate-900">{section.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600 sm:text-base">{section.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-8">
            <Link
              to="/privacy-policy"
              state={{ from: returnTo }}
              className="inline-flex items-center rounded-xl bg-primary-600 px-5 py-3 text-sm font-black text-white transition hover:bg-primary-700"
            >
              {data.cta}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
