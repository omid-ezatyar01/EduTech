import Joi from "joi";
import { objectId, paginationQuerySchema } from "./common.validators.js";

const platformSchema = Joi.string().valid("google_meet", "zoom", "manual", "physical");
const statusSchema = Joi.string().valid(
  "scheduled",
  "ready",
  "live",
  "delayed",
  "completed",
  "cancelled",
  "rescheduled",
  "missed",
);
const attendanceStatusSchema = Joi.string().valid("present", "absent");

const ensureValidTimeRange = (value, helpers) => {
  if (value.startAt && value.endAt) {
    const start = new Date(value.startAt);
    const end = new Date(value.endAt);
    if (end <= start) {
      return helpers.error("any.invalid", {
        message: "endAt must be after startAt",
      });
    }
  }

  const platform = value.platform || "google_meet";
  const needsLink = platform !== "physical";
  const shouldSkipLinkCheck = value.autoGenerateMeet === true;

  if (needsLink && !value.meetingLink && !shouldSkipLinkCheck) {
    return helpers.error("any.invalid", {
      message: "meetingLink is required for online sessions",
    });
  }

  return value;
};

export const liveSessionIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const createLiveSessionSchema = Joi.object({
  courseId: objectId.required(),
  title: Joi.string().trim().min(2).max(160).required(),
  description: Joi.string().trim().allow("").default(""),
  platform: platformSchema.default("google_meet"),
  meetingLink: Joi.string().uri().allow("").default(""),
  timezone: Joi.string().trim().max(100).default(process.env.APP_TIMEZONE || "Asia/Kabul"),
  autoGenerateMeet: Joi.boolean().default(false),
  calendarId: Joi.string().trim().allow("").default("primary"),
  startAt: Joi.date().required(),
  endAt: Joi.date().required(),
  notifyStudents: Joi.boolean().default(true),
  reminderEnabled: Joi.boolean().default(true),
  autoAttendance: Joi.boolean().default(false),
})
  .custom(ensureValidTimeRange)
  .messages({ "any.invalid": "{{#message}}" });

export const updateLiveSessionSchema = Joi.object({
  courseId: objectId,
  title: Joi.string().trim().min(2).max(160),
  description: Joi.string().trim().allow(""),
  platform: platformSchema,
  meetingLink: Joi.string().uri().allow(""),
  timezone: Joi.string().trim().max(100),
  startAt: Joi.date(),
  endAt: Joi.date(),
  status: statusSchema,
  notifyStudents: Joi.boolean(),
  reminderEnabled: Joi.boolean(),
  autoAttendance: Joi.boolean(),
  cancelReason: Joi.string().trim().allow(""),
})
  .min(1)
  .custom(ensureValidTimeRange)
  .messages({ "any.invalid": "{{#message}}" });

export const cancelLiveSessionSchema = Joi.object({
  reason: Joi.string().trim().allow(""),
});

export const liveSessionListQuerySchema = paginationQuerySchema.keys({
  courseId: objectId,
  status: statusSchema,
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
});

export const studentLiveSessionQuerySchema = paginationQuerySchema.keys({
  status: statusSchema,
  courseId: objectId,
});

export const attendanceListQuerySchema = paginationQuerySchema.keys({
  status: statusSchema,
  courseId: objectId,
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
});

export const updateLiveSessionAttendanceSchema = Joi.object({
  attendees: Joi.array()
    .items(
      Joi.object({
        studentId: objectId.required(),
        status: attendanceStatusSchema.required(),
        note: Joi.string().trim().allow(""),
        joinedAt: Joi.date(),
        leftAt: Joi.date(),
      }),
    )
    .min(1)
    .required(),
});

export const generateMeetLinksParamSchema = Joi.object({
  courseId: objectId.required(),
});

export const generateMeetLinksBodySchema = Joi.object({
  month: Joi.string().pattern(/^\d{4}-\d{2}$/),
  rangeDays: Joi.number().integer().valid(7, 30),
  startDate: Joi.string().isoDate(),
  daysOfWeek: Joi.array()
    .items(
      Joi.string().valid(
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ),
    )
    .min(1)
    .required(),
  startTime: Joi.string().pattern(/^\d{1,2}:\d{2}$/).required(),
  durationMinutes: Joi.number().integer().min(1).max(720).required(),
  timezone: Joi.string().trim().default(process.env.APP_TIMEZONE || "Asia/Kabul"),
  calendarId: Joi.string().trim().allow("").default("primary"),
  platform: platformSchema.default("google_meet"),
  title: Joi.string().trim().max(180).allow(""),
  description: Joi.string().trim().allow(""),
  notifyStudents: Joi.boolean().default(true),
  reminderEnabled: Joi.boolean().default(true),
  autoAttendance: Joi.boolean().default(false),
})
  .or("month", "rangeDays")
  .messages({
    "object.missing": "Either month or rangeDays is required",
  });

export const googleOAuthCallbackQuerySchema = Joi.object({
  code: Joi.string().trim().required(),
  state: Joi.string().trim().required(),
  scope: Joi.string().trim().allow(""),
});

export const studentLiveLinkParamSchema = Joi.object({
  sessionId: objectId.required(),
});
