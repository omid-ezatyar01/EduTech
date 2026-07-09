import { useEffect, useMemo, useState } from "react";

const CIRCLE_SIZE = 452.389;

const normalizeLocalizedDigits = (value = "") =>
  String(value).replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    return char;
  });

const parseTimeRange = (timeRange = "") => {
  const normalized = normalizeLocalizedDigits(timeRange)
    .replace(/[\u200e\u200f\u061c]/g, "")
    .replace(/[–—−]/g, "-");
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, sh, sm, eh, em] = match;
  return {
    startHour: Number(sh),
    startMinute: Number(sm),
    endHour: Number(eh),
    endMinute: Number(em),
  };
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildDateFromTime = (hour, minute) => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
};

const formatRemainingParts = (ms) => {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(safe / 3600)).padStart(2, "0");
  const m = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  return [h, m, s];
};

export default function CountdownCard({ course, language = "fa" }) {
  const isFa = language === "fa";
  const t = {
    noClass: isFa ? "صنفی موجود نیست." : "No class available.",
    noTime: isFa ? "زمان صنف مشخص نیست." : "Class time is unavailable.",
    untilEnd: isFa ? "تا پایان صنف" : "Until class ends",
    untilStart: isFa ? "تا شروع صنف" : "Until class starts",
    pending: isFa ? "در انتظار تایید صنف" : "Waiting for class confirmation",
    title: isFa ? "زمان باقی مانده" : "Time Remaining",
    note: isFa
      ? "لطفاً چند دقیقه قبل از شروع صنف در Google Meet حاضر باشید."
      : "Please join Google Meet a few minutes before class starts.",
  };
  const timeUnitLabels = isFa
    ? ["ساعت", "دقیقه", "ثانیه"]
    : ["Hours", "Minutes", "Seconds"];
  const countdownConfig = useMemo(() => {
    if (!course) return { targetTime: null, totalMs: 0, subtitle: t.noClass };
    const exactStart = parseDate(course.startAt || course.linkOpenAt);
    const exactEnd = parseDate(course.endAt || course.linkCloseAt);

    if (course.status === "live" && exactEnd) {
      return {
        targetTime: exactEnd,
        totalMs: exactStart
          ? Math.max(1, exactEnd.getTime() - exactStart.getTime())
          : Math.max(1, exactEnd.getTime() - Date.now()),
        subtitle: t.untilEnd,
      };
    }

    if ((course.status === "scheduled" || course.status === "upcoming") && exactStart) {
      return {
        targetTime: exactStart,
        totalMs: Math.max(1, exactStart.getTime() - Date.now()),
        subtitle: t.untilStart,
      };
    }

    const parsed = parseTimeRange(course.time);
    if (!parsed) return { targetTime: null, totalMs: 0, subtitle: t.noTime };

    const start = buildDateFromTime(parsed.startHour, parsed.startMinute);
    const end = buildDateFromTime(parsed.endHour, parsed.endMinute);
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }

    if (course.status === "live") {
      return {
        targetTime: end,
        totalMs: Math.max(1, end.getTime() - start.getTime()),
        subtitle: t.untilEnd,
      };
    }

    if (course.status === "scheduled") {
      const nextStart = new Date(start);
      if (nextStart <= new Date()) {
        nextStart.setDate(nextStart.getDate() + 1);
      }
      return {
        targetTime: nextStart,
        totalMs: Math.max(1, nextStart.getTime() - Date.now()),
        subtitle: t.untilStart,
      };
    }

    return { targetTime: null, totalMs: 0, subtitle: t.pending };
  }, [course, t.noClass, t.noTime, t.pending, t.untilEnd, t.untilStart]);

  const [remainingMs, setRemainingMs] = useState(() => {
    if (!countdownConfig.targetTime) return 0;
    return Math.max(0, countdownConfig.targetTime.getTime() - Date.now());
  });

  useEffect(() => {
    if (!countdownConfig.targetTime) {
      setRemainingMs(0);
      return;
    }

    const tick = () =>
      setRemainingMs(Math.max(0, countdownConfig.targetTime.getTime() - Date.now()));

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [countdownConfig.targetTime]);

  const progress = countdownConfig.totalMs
    ? Math.min(1, Math.max(0, remainingMs / countdownConfig.totalMs))
    : 0;
  const strokeDashoffset = CIRCLE_SIZE * (1 - progress);
  const timeParts = countdownConfig.targetTime
    ? formatRemainingParts(remainingMs)
    : ["--", "--", "--"];

  return (
    <div className="flex flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm text-center">
      <h3 className="text-lg font-black text-slate-950">{t.title}</h3>
      <p className="text-sm font-bold text-slate-500 mt-1">{countdownConfig.subtitle}</p>

      <div className="relative mx-auto mt-6 flex h-44 w-44 items-center justify-center rounded-full bg-slate-50 shadow-inner sm:h-48 sm:w-48">
        <svg
          viewBox="0 0 160 160"
          className="absolute inset-0 h-full w-full -rotate-90"
        >
          <circle
            cx="80"
            cy="80"
            r="72"
            className="stroke-slate-100"
            strokeWidth="10"
            fill="none"
          />
          <circle
            cx="80"
            cy="80"
            r="72"
            className="stroke-teal-500"
            strokeWidth="10"
            fill="none"
            strokeDasharray={CIRCLE_SIZE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s linear" }}
          />
        </svg>
        <div className="mx-auto w-[9.75rem] text-center" dir="ltr">
          <div className="grid grid-cols-[3rem_0.375rem_3rem_0.375rem_3rem] items-baseline justify-center text-2xl font-black tracking-wider text-slate-900 tabular-nums">
            <span>{timeParts[0]}</span>
            <span>:</span>
            <span>{timeParts[1]}</span>
            <span>:</span>
            <span>{timeParts[2]}</span>
          </div>
          <div className="mt-1 grid grid-cols-[3rem_0.375rem_3rem_0.375rem_3rem] items-center justify-center whitespace-nowrap text-[10px] font-black text-slate-400">
            <span className="text-center" dir={isFa ? "rtl" : "ltr"}>{timeUnitLabels[0]}</span>
            <span aria-hidden="true">:</span>
            <span className="text-center" dir={isFa ? "rtl" : "ltr"}>{timeUnitLabels[1]}</span>
            <span aria-hidden="true">:</span>
            <span className="text-center" dir={isFa ? "rtl" : "ltr"}>{timeUnitLabels[2]}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-primary-50 p-4 text-xs font-bold leading-6 text-primary-800">
        {t.note}
      </div>
    </div>
  );
}
