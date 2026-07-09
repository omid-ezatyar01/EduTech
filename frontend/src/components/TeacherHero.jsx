import { useState } from "react";
import {
  BriefcaseBusiness,
  Camera,
  MessageCircle,
  Share2,
  Users,
  Video,
} from "lucide-react";
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

export default function TeacherHero({ data, dir }) {
  const [failedAvatarKey, setFailedAvatarKey] = useState("");
  const isRtl = dir === "rtl";
  const teacherAvatar = resolveAvatarUrl(data?.avatar || "");
  const avatarKey = `${data?.name || ""}:${teacherAvatar}`;
  const hasAvatar = Boolean(teacherAvatar) && failedAvatarKey !== avatarKey;
  const socialItems = [
    { key: "youtube", label: "YouTube", icon: Video },
    { key: "instagram", label: "Instagram", icon: Camera },
    { key: "facebook", label: "Facebook", icon: Users },
    { key: "linkedin", label: "LinkedIn", icon: BriefcaseBusiness },
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  ]
    .map((item) => ({
      ...item,
      href: resolveSocialHref(item.key, data?.socialLinks?.[item.key]),
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
            {socialItems.length ? (
              <div className="inline-grid grid-flow-col auto-cols-[2.5rem] items-center gap-2 rounded-2xl border border-white/90 bg-white/80 p-2 shadow-sm backdrop-blur">
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
                      className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:-translate-y-0.5 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <Icon size={18} />
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
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:w-auto"
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
