import { Link } from "react-router";

export default function CTASection({
  title,
  text,
  primaryBtn,
  secondaryBtn,
  primaryHref = "#live-courses",
  secondaryHref = "#contact",
  sectionClassName = "bg-white py-16",
}) {
  const renderAction = (label, href, className) => {
    if (!label || !href) return null;

    if (href.startsWith("/")) {
      return (
        <Link to={href} className={className}>
          {label}
        </Link>
      );
    }

    return (
      <a href={href} className={className}>
        {label}
      </a>
    );
  };

  return (
    <section className={sectionClassName}>
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-primary-700 via-primary-600 to-teal-500 px-6 py-12 text-white shadow-hero sm:px-10 lg:px-14">
          <div className="absolute inset-y-0 end-0 w-1/2 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]" />
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-black md:text-4xl">{title}</h2>
              <p className="mt-4 text-lg font-medium leading-8 text-white/85">
                {text}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              {renderAction(
                primaryBtn,
                primaryHref,
                "inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-white px-8 font-black text-primary-700 shadow-sm transition hover:-translate-y-0.5",
              )}
              {renderAction(
                secondaryBtn,
                secondaryHref,
                "inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-white/40 px-8 font-black text-white transition hover:bg-white/10",
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
