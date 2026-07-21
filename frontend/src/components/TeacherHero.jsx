import { useState } from "react";
import {
  AtSign,
  Send,
  Share2,
  Bell,
  BellRing,
} from "lucide-react";
import SocialBrandIcon from "./SocialBrandIcon.jsx";
import { resolveAvatarUrl } from "../utils/avatar";
import { shareContent } from "../utils/share";

function getInitials(name) {
  return String(name || "T")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const resolveSocialHref = (platform, rawValue) => {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  if (platform === "email") {
    return value.includes("@") ? `mailto:${value}` : "";
  }
  if (platform === "whatsapp" && /^\+?[\d\s()-]{8,20}$/.test(value)) {
    return `https://wa.me/${value.replace(/\D/g, "")}`;
  }
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
};

export default function TeacherHero({ data, dir, following = false, followerCount = 0, followBusy = false, onToggleFollow }) {
  const [failedAvatarKey, setFailedAvatarKey] = useState("");
  const isRtl = dir === "rtl";
  const teacherAvatar = resolveAvatarUrl(data?.avatar || "");
  const avatarKey = `${data?.name || ""}:${teacherAvatar}`;
  const hasAvatar = Boolean(teacherAvatar) && failedAvatarKey !== avatarKey;
  const socialStyles = {
    youtube: "text-[#FF0000] hover:border-rose-300 hover:bg-rose-50",
    instagram: "text-[#E4405F] hover:border-pink-300 hover:bg-pink-50",
    facebook: "text-[#1877F2] hover:border-blue-300 hover:bg-blue-50",
    linkedin: "text-[#0A66C2] hover:border-sky-300 hover:bg-sky-50",
    whatsapp: "text-[#25D366] hover:border-emerald-300 hover:bg-emerald-50",
    twitter: "hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700",
    github: "text-[#181717] hover:border-slate-400 hover:bg-slate-100",
    email: "hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700",
  };
  const socialItems = [
    { key: "youtube", label: "YouTube", brandIcon: true },
    { key: "instagram", label: "Instagram", brandIcon: true },
    { key: "facebook", label: "Facebook", brandIcon: true },
    { key: "linkedin", label: "LinkedIn", brandIcon: true },
    { key: "whatsapp", label: "WhatsApp", brandIcon: true },
    { key: "twitter", label: "Twitter", icon: Send },
    { key: "github", label: "GitHub", brandIcon: true },
    { key: "email", label: "Email", icon: AtSign },
  ]
    .map((item) => ({
      ...item,
      href: resolveSocialHref(
        item.key,
        item.key === "email" ? data?.email || data?.socialLinks?.email : data?.socialLinks?.[item.key],
      ),
    }))
    .filter((item) => item.href);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-teal-50 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] md:p-8">
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10">
        <div
          className={`order-2 min-w-0 lg:order-1 ${
            isRtl ? "text-center lg:text-right" : "text-center lg:text-left"
          }`}
        >
          <h1 className="break-words text-3xl font-black text-slate-950 md:text-4xl">
            {data.name}
          </h1>
          <p className="mt-4 break-words text-justify font-medium leading-8 text-slate-600">
            {data.bio}
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <button
              type="button"
              onClick={onToggleFollow}
              disabled={followBusy}
              className={`order-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-black shadow-sm transition sm:order-none sm:w-auto ${following ? "border border-primary-200 bg-white text-primary-700 hover:bg-primary-50" : "bg-primary-600 text-white hover:bg-primary-700"} disabled:opacity-60`}
            >
              {following ? <BellRing size={17}/> : <Bell size={17}/>}
              {following ? (isRtl ? "دنبال می‌کنید" : "Following") : (isRtl ? "دنبال کردن" : "Follow")}
              <span className="rounded-full bg-current/10 px-2 py-0.5 text-xs">{Number(followerCount || 0).toLocaleString(isRtl ? "fa-AF" : "en-US")}</span>
            </button>
            {socialItems.length ? (
              <div className="order-1 inline-grid max-w-full grid-flow-col auto-cols-[2.5rem] items-center gap-2 overflow-x-auto rounded-2xl border border-white/90 bg-white/80 p-2 shadow-sm backdrop-blur sm:order-none">
                {socialItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.key}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={item.label}
                      title={item.label}
                      className={`grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                        socialStyles[item.key] || "hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                      }`}
                    >
                      {item.brandIcon ? (
                        <SocialBrandIcon brand={item.key} size={18} />
                      ) : (
                        <Icon size={18} />
                      )}
                    </a>
                  );
                })}
              </div>
            ) : null}
            <button
              type="button"
              onClick={async () => {
                const shared = await shareContent({
                  title: data?.name || "EduTech Instructor",
                  text: isRtl
                    ? "پروفایل این مدرس را در EduTech ببینید."
                    : "View this instructor on EduTech.",
                  path: data?.profilePath || window.location.pathname,
                  previewPath: data?.teacherId
                    ? `/share/teacher/${encodeURIComponent(data.teacherId)}`
                    : "",
                });
                if (shared && !navigator.share) {
                  alert(isRtl ? "لینک مدرس کپی شد." : "Teacher link copied.");
                }
              }}
              aria-label={isRtl ? "اشتراک‌گذاری پروفایل" : "Share profile"}
              title={isRtl ? "اشتراک‌گذاری پروفایل" : "Share profile"}
              className="order-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:order-none sm:w-auto"
            >
              <Share2 size={16} />
              {isRtl ? "اشتراک‌گذاری" : "Share"}
            </button>
          </div>
        </div>

        <div className="order-1 mx-auto w-fit shrink-0 lg:order-2">
          {hasAvatar ? (
            <img
              src={teacherAvatar}
              alt={data.name}
              className="h-40 w-40 rounded-full border-4 border-white bg-white object-cover shadow-lg md:h-48 md:w-48"
              style={{ objectPosition: "center top" }}
              onError={() => setFailedAvatarKey(avatarKey)}
            />
          ) : (
            <div className="grid h-40 w-40 place-items-center rounded-full border-4 border-white bg-slate-200 text-4xl font-black text-slate-700 shadow-lg md:h-48 md:w-48">
              {getInitials(data?.name)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
