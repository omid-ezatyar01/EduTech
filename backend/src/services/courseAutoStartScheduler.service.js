import Course from "../models/Course.js";
import { ensureCourseAutoStarted } from "../utils/courseAutoStart.js";

const DEFAULT_INTERVAL_MS = 60 * 1000;
let schedulerTimer = null;
let sweepRunning = false;

export const runCourseAutoStartSweep = async (now = new Date()) => {
  if (sweepRunning) return { skipped: true };
  sweepRunning = true;

  try {
    const courses = await Course.find({
      status: "published",
      isPublished: true,
      startDate: { $lte: now },
      classStartedAt: null,
      classEndedAt: null,
      classCancelledAt: null,
    }).select(
      "_id status lifecycleStatus isPublished startDate endDate schedule totalSessions durationWeeks minimumStudentsToStart enrolledStudentsCount minimumReachedAt actualStartedAt classStartedAt classEndedAt classCancelledAt endRequest",
    );

    for (const course of courses) {
      await ensureCourseAutoStarted(course, { now });
    }

    return { checked: courses.length };
  } catch (error) {
    console.warn(`Course auto-start sweep failed: ${error.message}`);
    return { checked: 0, error: error.message };
  } finally {
    sweepRunning = false;
  }
};

export const startCourseAutoStartScheduler = ({
  intervalMs = DEFAULT_INTERVAL_MS,
} = {}) => {
  if (schedulerTimer) return schedulerTimer;

  runCourseAutoStartSweep().catch(() => {});
  schedulerTimer = setInterval(() => {
    runCourseAutoStartSweep().catch(() => {});
  }, Math.max(15_000, Number(intervalMs) || DEFAULT_INTERVAL_MS));
  schedulerTimer.unref?.();
  return schedulerTimer;
};

export const stopCourseAutoStartScheduler = () => {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
};
