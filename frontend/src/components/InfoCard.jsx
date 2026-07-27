import { Link } from "react-router";

export default function InfoCard({
  title,
  text,
  icon: Icon,
  buttonText,
  buttonHref,
  compact = false,
  bgClass = "bg-primary-50",
  textClass = "text-primary-800",
  iconClass = "text-primary-600",
}) {
  return (
    <div
      className={`flex h-full flex-col items-start rounded-[24px] shadow-sm sm:flex-row sm:items-center ${bgClass} ${
        compact ? "gap-3 p-5 sm:p-6" : "gap-4 p-6"
      }`}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ${iconClass} ${
          compact ? "h-10 w-10" : "h-12 w-12"
        }`}
      >
        <Icon size={compact ? 20 : 24} />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className={`${compact ? "text-[15px]" : "text-base"} font-black text-slate-900`}>
          {title}
        </h4>
        <p
          className={`text-sm font-semibold ${textClass} ${
            compact ? "mt-1 leading-5" : "mt-1 leading-6"
          }`}
        >
          {text}
        </p>
      </div>
      {buttonText &&
        (buttonHref?.startsWith("/") ? (
          <Link
            to={buttonHref}
            className="mt-3 sm:mt-0 flex shrink-0 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-black shadow-sm transition hover:-translate-y-0.5"
            style={{ color: "inherit" }}
          >
            {buttonText}
          </Link>
        ) : (
          <a
            href={buttonHref}
            className="mt-3 sm:mt-0 flex shrink-0 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-black shadow-sm transition hover:-translate-y-0.5"
            style={{ color: "inherit" }}
          >
            {buttonText}
          </a>
        ))}
    </div>
  );
}
