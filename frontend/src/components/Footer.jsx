import { Mail, MapPin } from "lucide-react";
import { Link, useLocation } from "react-router";
import SocialBrandIcon from "./SocialBrandIcon.jsx";

const WHATSAPP_NUMBER = "93772305458";
const WHATSAPP_DISPLAY_NUMBER = "+93 772 305 458";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
const CONTACT_EMAIL = "info@edutech.study";
const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029Vb6syw8CRs1pexVczE0A";
const TELEGRAM_CHANNEL_URL = "https://t.me/edutech_main";
const INSTAGRAM_URL = "https://www.instagram.com/edutech_main/";
const FACEBOOK_URL = "https://www.facebook.com/share/1KuPqHbFMv/";
const YOUTUBE_URL = "https://www.youtube.com/@edutech_main";
const disableLinkClick = (event) => event.preventDefault();

function WhatsAppIcon({ size = 18, className = "" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.601 2.326A7.854 7.854 0 0 0 8.002 0a7.94 7.94 0 0 0-6.89 11.89L0 16l4.265-1.114A7.94 7.94 0 0 0 8 16a7.94 7.94 0 0 0 7.94-7.94 7.9 7.9 0 0 0-2.339-5.734zm-5.6 12.38a6.6 6.6 0 0 1-3.36-.92l-.24-.145-2.53.66.676-2.466-.157-.251a6.6 6.6 0 0 1-1.007-3.505 6.62 6.62 0 1 1 6.617 6.627zm3.615-4.953c-.198-.099-1.173-.579-1.353-.645-.182-.066-.312-.099-.445.1s-.512.645-.627.777c-.115.132-.231.149-.429.05-.198-.1-.836-.308-1.59-.981-.587-.523-.985-1.168-1.1-1.366-.116-.198-.012-.305.087-.404.09-.089.198-.231.297-.347.099-.115.132-.198.198-.33.066-.132.033-.248-.017-.347-.05-.099-.445-1.074-.61-1.47-.161-.387-.325-.335-.446-.341l-.38-.007a.73.73 0 0 0-.528.248c-.182.198-.693.678-.693 1.653s.71 1.918.81 2.05c.1.132 1.387 2.118 3.361 2.972.47.203.836.324 1.122.415.472.15.902.129 1.24.078.378-.056 1.173-.48 1.339-.944.165-.463.165-.86.116-.943-.05-.083-.182-.132-.38-.232z" />
    </svg>
  );
}

function FacebookIcon({ size = 18, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.6-1.6h1.7V4.8c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4V11H8v3h2.6v8z" />
    </svg>
  );
}

function TelegramIcon({ size = 18, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M21.94 4.66a1.5 1.5 0 0 0-1.62-.24L3.4 11.5a1.5 1.5 0 0 0 .13 2.81l4.15 1.45 1.45 4.15a1.5 1.5 0 0 0 2.81.13l7.08-16.92a1.5 1.5 0 0 0-.08-1.46zm-10.98 10.2-.58 2.74-.95-2.73 7.2-6.57-5.67 6.56z" />
    </svg>
  );
}

export default function Footer({ t }) {
  const logoSrc = "/logo.png";
  const isFa = t.meta.lang === "fa";
  const location = useLocation();
  const legalFrom = `${location.pathname}${location.search}${location.hash}`;

  return (
    <footer id="footer" className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3 md:items-start md:gap-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <div className="flex items-center justify-center gap-2 md:justify-start">
              <img
                className="h-9 w-auto object-contain"
                src={logoSrc}
                alt="EduTech"
              />
            </div>
            <p className="mt-3 text-center text-sm leading-7 text-slate-600 md:text-start">
              {isFa
                ? "ایجوتک آموزش آنلاین مهارت‌محور را برای رشد فردی و کاری در دسترس همه قرار می‌دهد."
                : "EduTech makes practical online learning accessible for personal and career growth."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <h3 className="text-center text-sm font-black tracking-wide text-slate-950 md:text-start md:text-base">
              {t.footer.contactTitle}
            </h3>
            <div className="mt-3 space-y-2.5 text-sm text-slate-600 sm:mt-4 sm:space-y-3 md:text-start">
              <p className="flex items-center gap-2">
                <Mail size={17} className="text-primary-600" />
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-semibold break-all hover:text-primary-700"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <WhatsAppIcon size={17} className="text-emerald-600" />
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold hover:text-emerald-700"
                >
                  {isFa
                    ? `\u202A${WHATSAPP_DISPLAY_NUMBER}\u202C`
                    : WHATSAPP_DISPLAY_NUMBER}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={17} className="text-primary-600" />
                {t.footer.address}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <h3 className="text-center text-sm font-black tracking-wide text-slate-950 md:text-start md:text-base">
              {t.footer.socialsTitle}
            </h3>
            <div className="mt-3 grid grid-cols-5 gap-2 sm:mt-4 md:flex md:flex-wrap md:items-center md:justify-start md:gap-3">
              {[
                {
                  href: WHATSAPP_CHANNEL_URL,
                  label: "WhatsApp",
                  icon: <WhatsAppIcon className="text-emerald-600" />,
                  disabled: false,
                },
                {
                  href: TELEGRAM_CHANNEL_URL,
                  label: "Telegram",
                  icon: <TelegramIcon size={18} className="text-sky-500" />,
                  disabled: false,
                },
                {
                  href: INSTAGRAM_URL,
                  label: "Instagram",
                  icon: <SocialBrandIcon brand="instagram" size={18} className="text-pink-600" />,
                  disabled: false,
                },
                {
                  href: YOUTUBE_URL,
                  label: "YouTube",
                  icon: <SocialBrandIcon brand="youtube" size={18} className="text-red-600" />,
                  disabled: false,
                },
                {
                  href: FACEBOOK_URL,
                  label: "Facebook",
                  icon: <FacebookIcon size={18} />,
                  disabled: false,
                },
              ].map((item, index) => (
                <a
                  aria-label={item.label}
                  className={`grid h-11 w-full place-items-center rounded-xl border border-slate-200 text-slate-600 transition md:h-10 md:w-10 md:rounded-full ${
                    item.disabled
                      ? "cursor-default opacity-60"
                      : "hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
                  }`}
                  href={item.disabled ? "#" : item.href}
                  key={`${item.label}-${index}`}
                  onClick={item.disabled ? disableLinkClick : undefined}
                  target={!item.disabled && item.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    !item.disabled && item.href.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                >
                  {item.icon}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 bg-white py-5 text-center text-sm font-semibold text-slate-500">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Link
            to="/privacy-policy"
            state={{ from: legalFrom }}
            className="hover:text-primary-700 hover:underline"
          >
            {isFa ? "حریم خصوصی" : "Privacy Policy"}
          </Link>
          <span className="text-slate-300">|</span>
          <Link
            to="/terms"
            state={{ from: legalFrom }}
            className="hover:text-primary-700 hover:underline"
          >
            {isFa ? "شرایط استفاده" : "Terms of Service"}
          </Link>
        </div>
        <p className="mt-2">
          {isFa ? "توسعه داده شده توسط " : "Developed by "}
          <span className="text-primary-700">
            {isFa ? "شرکت برنامه نویسی بودا" : "Boda Software Development Company"}
          </span>
        </p>
      </div>
    </footer>
  );
}
