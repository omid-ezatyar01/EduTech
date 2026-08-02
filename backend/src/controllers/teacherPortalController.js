import Course from "../models/Course.js";
import Assignment from "../models/Assignment.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import Enrollment from "../models/Enrollment.js";
import LiveSession from "../models/LiveSession.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { calculateTeacherEarnings } from "../utils/teacherEarnings.js";
import { DateTime } from "luxon";

const getTeacherCourseFilter = (teacherId) => ({
  $or: [{ teacher: teacherId }, { teacherId }, { createdBy: teacherId }],
});

const clampCourseProgress = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const DAY_INDEX_BY_KEY = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  یکشنبه: 0,
  دوشنبه: 1,
  "سه شنبه": 2,
  "سه‌شنبه": 2,
  چهارشنبه: 3,
  "چهار شنبه": 3,
  پنجشنبه: 4,
  "پنج شنبه": 4,
  جمعه: 5,
  شنبه: 6,
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeLocalizedDigits = (value) =>
  String(value || "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

const normalizePersianText = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌\s]+/g, " ");

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const dayToIndex = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_KEY, raw)) return DAY_INDEX_BY_KEY[raw];

  const normalized = normalizePersianText(raw);
  if (Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_KEY, normalized)) {
    return DAY_INDEX_BY_KEY[normalized];
  }

  const compact = normalized.replace(/\s+/g, "");
  if (Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_KEY, compact)) {
    return DAY_INDEX_BY_KEY[compact];
  }

  const upper = raw.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_KEY, upper)) return DAY_INDEX_BY_KEY[upper];
  return null;
};

const parseTimeToMinutes = (value) => {
  const match = normalizeLocalizedDigits(value)
    .trim()
    .replace(/\s+/g, " ")
    .match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s?(AM|PM|am|pm))?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const meridiem = String(match[3] || "").toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const resolveCourseTimeline = (course = {}, scheduleRows = []) => {
  const startAt = parseDate(course?.startDate || course?.classStartedAt);
  if (!startAt) return null;

  const firstRow = scheduleRows[0] || {};
  const fallbackEndMinutes = parseTimeToMinutes(firstRow?.endTime) ?? 60;
  const weeks = Number(course?.durationWeeks || 0);

  if (Number.isFinite(weeks) && weeks > 0) {
    const endAt = new Date(startAt);
    endAt.setDate(endAt.getDate() + Math.max(1, Math.round(weeks)) * 7 - 1);
    endAt.setHours(Math.floor(fallbackEndMinutes / 60), fallbackEndMinutes % 60, 59, 999);
    return { startAt, endAt };
  }

  const endAt = parseDate(course?.endDate);
  if (!endAt) return null;
  return { startAt, endAt };
};

const countCourseLessonsInRange = ({ startAt, endAt, dayMap, capAt = null }) => {
  if (!startAt || !endAt || !dayMap.size || endAt < startAt) return 0;

  const rangeStart = startOfDay(startAt);
  const rangeEnd = startOfDay(endAt);
  let count = 0;

  for (
    let cursor = new Date(rangeStart);
    cursor.getTime() <= rangeEnd.getTime();
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    const endMinutes = dayMap.get(cursor.getDay());
    if (!Number.isFinite(endMinutes)) continue;

    const lessonEnd = new Date(cursor);
    lessonEnd.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 59, 999);

    if (lessonEnd < startAt || lessonEnd > endAt) continue;
    if (capAt && lessonEnd > capAt) continue;
    count += 1;
  }

  return count;
};

const calculateCourseProgress = (course = {}, nowValue = new Date()) => {
  if (course?.classEndedAt) return 100;
  if (course?.status === "cancelled" || course?.classCancelledAt) return 0;

  const directProgress = course?.progressPercent ?? course?.progress;
  if (directProgress !== undefined && directProgress !== null && directProgress !== "") {
    return clampCourseProgress(directProgress);
  }

  const scheduleRows = Array.isArray(course?.schedule) ? course.schedule : [];
  const dayMap = new Map();

  scheduleRows.forEach((row) => {
    const dayIndex = dayToIndex(row?.day);
    if (dayIndex === null) return;
    dayMap.set(dayIndex, parseTimeToMinutes(row?.endTime) ?? 23 * 60 + 59);
  });

  const timeline = resolveCourseTimeline(course, scheduleRows);
  if (!timeline || !dayMap.size) return 0;

  const calculatedTotal = countCourseLessonsInRange({
    startAt: timeline.startAt,
    endAt: timeline.endAt,
    dayMap,
  });
  const exactTotal = Number(course?.totalSessions || 0);
  const totalLessons =
    Number.isInteger(exactTotal) && exactTotal > 0
      ? Math.min(exactTotal, calculatedTotal)
      : calculatedTotal;
  if (totalLessons <= 0) return 0;

  const completedLessons = Math.min(totalLessons, countCourseLessonsInRange({
    startAt: timeline.startAt,
    endAt: timeline.endAt,
    dayMap,
    capAt: parseDate(nowValue) || new Date(),
  }));

  return clampCourseProgress((completedLessons / totalLessons) * 100);
};

const getRelativeTimeFa = (date) => {
  const now = Date.now();
  const diffHours = Math.max(1, Math.floor((now - new Date(date).getTime()) / (1000 * 60 * 60)));
  if (diffHours < 24) return "امروز";
  if (diffHours < 48) return "دیروز";
  return `${Math.floor(diffHours / 24)} روز پیش`;
};

const buildAttendanceByEnrollmentMap = (liveSessions = []) => {
  const map = new Map();

  liveSessions.forEach((session) => {
    const courseId = String(session?.courseId || "");
    if (!courseId) return;

    const attendanceRows = Array.isArray(session?.attendance) ? session.attendance : [];
    attendanceRows.forEach((row) => {
      const studentId = String(row?.studentId || "");
      if (!studentId) return;

      const key = `${courseId}:${studentId}`;
      const previous = map.get(key) || { presentLike: 0, total: 0 };
      const isPresentLike = row?.status === "present";

      map.set(key, {
        presentLike: previous.presentLike + (isPresentLike ? 1 : 0),
        total: previous.total + 1,
      });
    });
  });

  return map;
};

const getAttendanceSummary = (attendanceMap, courseId, studentId) => {
  const key = `${courseId}:${studentId}`;
  const row = attendanceMap.get(key);

  if (!row || !row.total) {
    return { attendance: 0, hasAttendanceData: false };
  }

  return {
    attendance: Math.round((row.presentLike / row.total) * 100),
    hasAttendanceData: true,
  };
};

export const deriveStudentMetrics = ({
  enrollmentStatus,
  attendance,
  hasAttendanceData,
  assignmentTotal,
  submittedAssignments,
}) => {
  const assignmentProgress = assignmentTotal > 0
    ? Math.round((submittedAssignments / assignmentTotal) * 100)
    : null;
  const progressParts = [];
  if (assignmentProgress !== null) progressParts.push(assignmentProgress);
  if (hasAttendanceData) progressParts.push(attendance);

  const hasInactiveEnrollment = enrollmentStatus === "pending" || enrollmentStatus === "cancelled";
  const progress = enrollmentStatus === "completed"
    ? 100
    : hasInactiveEnrollment || progressParts.length === 0
      ? 0
      : Math.round(progressParts.reduce((sum, value) => sum + value, 0) / progressParts.length);

  let status = "active";
  if (enrollmentStatus === "pending" || enrollmentStatus === "cancelled") {
    status = "followup";
  } else if (hasAttendanceData && attendance < 60) {
    status = "low_attendance";
  } else if (enrollmentStatus === "completed") {
    status = "excellent";
  }

  const statusLabelMap = {
    active: "فعال",
    followup: "نیازمند پیگیری",
    excellent: "ممتاز",
    low_attendance: "کم حضور",
  };

  return {
    progress,
    attendance,
    assignments: assignmentTotal > 0 ? `${submittedAssignments} / ${assignmentTotal}` : "-",
    status,
    statusLabel: statusLabelMap[status] || statusLabelMap.active,
  };
};

const mapCourseOptions = (courses = []) =>
  courses.map((course) => ({
    id: String(course._id),
    title: course.title || "Course",
  }));

export const getTeacherDashboard = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const earnings = await calculateTeacherEarnings(teacherId);
  const teacherTimeZone = String(
    req.user?.timezone || process.env.APP_TIMEZONE || "Asia/Kabul",
  );
  const localNow = DateTime.now().setZone(teacherTimeZone);
  const dayStart = localNow.startOf("day").toUTC().toJSDate();
  const dayEnd = localNow.endOf("day").toUTC().toJSDate();

  const courses = await Course.find(getTeacherCourseFilter(teacherId))
    .select("title status schedule enrolledStudentsCount maxStudents meetingLink startDate endDate classStartedAt classEndedAt classCancelledAt")
    .sort({ createdAt: -1 });

  const courseIds = courses.map((c) => c._id);
  const manageableCourseIds = courses
    .filter(
      (course) =>
        !course.classEndedAt &&
        !course.classCancelledAt &&
        course.status !== "cancelled",
    )
    .map((course) => course._id);

  const [enrollments, pendingAssignmentCount, pendingSubmissionRows, todaySessionRows] = await Promise.all([
    manageableCourseIds.length
      ? Enrollment.find({ courseId: { $in: manageableCourseIds } })
          .select("studentId enrollmentStatus updatedAt")
          .populate("studentId", "_id")
      : [],
    manageableCourseIds.length
      ? AssignmentSubmission.countDocuments({
          teacherId,
          courseId: { $in: manageableCourseIds },
          status: "submitted",
        })
      : 0,
    manageableCourseIds.length
      ? AssignmentSubmission.find({
          teacherId,
          courseId: { $in: manageableCourseIds },
          status: "submitted",
        })
          .populate("assignmentId", "title")
          .populate("studentId", "name")
          .sort({ submittedAt: 1 })
          .limit(5)
          .lean()
      : [],
    manageableCourseIds.length
      ? LiveSession.find({
          teacherId,
          courseId: { $in: manageableCourseIds },
          startAt: { $lte: dayEnd },
          endAt: { $gte: dayStart },
          status: { $in: ["scheduled", "ready", "live", "delayed"] },
        })
          .populate("courseId", "title enrolledStudentsCount")
          .sort({ startAt: 1 })
          .lean()
      : [],
  ]);

  const activeCourses = courses.filter(
    (course) =>
      ["published", "approved"].includes(course.status) &&
      !course.classEndedAt &&
      !course.classCancelledAt,
  ).length;
  const visibleEnrollments = enrollments.filter((e) => Boolean(e?.studentId?._id));
  const activeStudents = visibleEnrollments.filter((e) => e.enrollmentStatus === "active").length;
  const monthIncome = Number(earnings.teacherEarnings || 0);

  const liveClasses = todaySessionRows.map((session) => {
    const sessionZone = String(session?.timezone || teacherTimeZone);
    const startLabel = DateTime.fromJSDate(new Date(session.startAt))
      .setZone(sessionZone)
      .toFormat("HH:mm");
    const endLabel = DateTime.fromJSDate(new Date(session.endAt))
      .setZone(sessionZone)
      .toFormat("HH:mm");
    return {
      id: String(session._id),
      title: session.title || session?.courseId?.title || "Live class",
      time: `${startLabel} - ${endLabel}`,
      studentsCount: Number(session?.courseId?.enrolledStudentsCount || 0),
      meetingLink: session.meetingLink || null,
      status: session.status,
    };
  });

  const courseProgress = courses.slice(0, 4).map((course) => {
    return {
      id: String(course._id),
      title: course.title,
      progress: calculateCourseProgress(course),
    };
  });

  const reviewAssignments = pendingSubmissionRows.map((submission) => {
    const assignmentTitle = submission?.assignmentId?.title || "Assignment";
    const studentName = submission?.studentId?.name || "Student";
    return `${assignmentTitle} — ${studentName}`;
  });

  return res.json(
    new ApiResponse({
      message: "Teacher dashboard fetched successfully",
      data: {
        stats: {
          activeCourses,
          activeStudents,
          pendingAssignments: pendingAssignmentCount,
          monthIncome,
        },
        contract: {
          startDate: req.user?.contractStartDate || null,
          validUntil: req.user?.contractValidUntil || null,
        },
        liveClasses,
        courseProgress,
        reviewAssignments,
      },
    }),
  );
});

export const getTeacherStudents = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const courses = await Course.find(getTeacherCourseFilter(teacherId)).select("_id title");
  const courseIds = courses.map((c) => c._id);

  if (!courseIds.length) {
    return res.json(
      new ApiResponse({
        message: "Teacher students fetched successfully",
        data: {
          students: [],
          newStudents: [],
          courses: [],
          stats: {
            totalStudents: 0,
            activeStudents: 0,
            followupStudents: 0,
            averageAttendance: 0,
          },
          meta: { page, limit, total: 0, totalPages: 1 },
        },
      }),
    );
  }

  const [enrollments, liveSessions, assignments, submissions] = await Promise.all([
    Enrollment.find({ courseId: { $in: courseIds } })
      .populate("studentId", "name email phone avatar studentId country city gradeLevel schoolName status")
      .populate("courseId", "title")
      .sort({ createdAt: -1 }),
    LiveSession.find({
      courseId: { $in: courseIds },
      status: { $in: ["live", "completed"] },
    }).select("courseId attendance"),
    Assignment.find({
      courseId: { $in: courseIds },
      teacherId,
      status: { $in: ["published", "closed"] },
    }).select("_id courseId"),
    AssignmentSubmission.find({
      courseId: { $in: courseIds },
      teacherId,
    }).select("assignmentId courseId studentId status submittedAt reviewedAt"),
  ]);

  const attendanceByEnrollmentMap = buildAttendanceByEnrollmentMap(liveSessions);
  const assignmentCountByCourse = new Map();
  assignments.forEach((assignment) => {
    const courseKey = String(assignment.courseId || "");
    assignmentCountByCourse.set(courseKey, (assignmentCountByCourse.get(courseKey) || 0) + 1);
  });

  const submittedAssignmentByEnrollment = new Map();
  submissions.forEach((submission) => {
    const courseKey = String(submission.courseId || "");
    const studentKey = String(submission.studentId || "");
    const assignmentKey = String(submission.assignmentId || "");
    if (!courseKey || !studentKey || !assignmentKey) return;
    const rowKey = `${courseKey}:${studentKey}`;
    const previous = submittedAssignmentByEnrollment.get(rowKey) || new Set();
    previous.add(assignmentKey);
    submittedAssignmentByEnrollment.set(rowKey, previous);
  });

  const visibleEnrollments = enrollments.filter((enrollment) => {
    const student = enrollment?.studentId;
    return Boolean(student && typeof student === "object" && student._id);
  });

  const allRows = visibleEnrollments.map((enrollment) => {
    const student = enrollment.studentId;
    const course = enrollment.courseId;
    const courseId = String(course?._id || enrollment?.courseId || "");
    const studentId = String(student?._id || "");
    const attendanceSummary = getAttendanceSummary(attendanceByEnrollmentMap, courseId, studentId);
    const assignmentTotal = assignmentCountByCourse.get(courseId) || 0;
    const submittedAssignments = submittedAssignmentByEnrollment.get(`${courseId}:${studentId}`)?.size || 0;
    const metrics = deriveStudentMetrics({
      enrollmentStatus: enrollment?.enrollmentStatus,
      attendance: attendanceSummary.attendance,
      hasAttendanceData: attendanceSummary.hasAttendanceData,
      assignmentTotal,
      submittedAssignments,
    });

    return {
      id: String(enrollment._id),
      studentId,
      studentCode: student?.studentId || "",
      name: student?.name || "Student",
      avatar: student?.avatar || "",
      course: course?.title || "Course",
      courseId,
      progress: metrics.progress,
      attendance: metrics.attendance,
      assignments: metrics.assignments,
      lastActivity: getRelativeTimeFa(enrollment.updatedAt || enrollment.createdAt),
      status: metrics.status,
      statusLabel: metrics.statusLabel,
      email: student?.email || "-",
      phone: student?.phone || "-",
      country: student?.country || "",
      city: student?.city || "",
      gradeLevel: student?.gradeLevel || "",
      schoolName: student?.schoolName || "",
      accountStatus: student?.status || "",
      enrollmentStatus: enrollment.enrollmentStatus || "",
      accessStatus: enrollment.accessStatus || "",
      notes: "",
      createdAt: enrollment.createdAt,
      enrolledAt: enrollment.enrolledAt || enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
      assignmentTotal,
      submittedAssignments,
      hasAttendanceData: attendanceSummary.hasAttendanceData,
    };
  });

  let rows = allRows;

  const search = String(req.query.search || "").trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (item) =>
        item.name.toLowerCase().includes(search) ||
        item.course.toLowerCase().includes(search) ||
        item.email.toLowerCase().includes(search),
    );
  }

  if (req.query.course && req.query.course !== "all") {
    const requestedCourse = String(req.query.course || "");
    rows = rows.filter((item) => item.courseId === requestedCourse || item.course === requestedCourse);
  }

  if (req.query.status && req.query.status !== "all") {
    rows = rows.filter((item) => item.status === req.query.status);
  }

  if (req.query.performance && req.query.performance !== "all") {
    rows = rows.filter((item) => {
      const avg = (item.progress + item.attendance) / 2;
      if (req.query.performance === "excellent") return avg >= 85;
      if (req.query.performance === "good") return avg >= 70 && avg < 85;
      if (req.query.performance === "average") return avg >= 50 && avg < 70;
      if (req.query.performance === "weak") return avg < 50;
      return true;
    });
  }

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const students = rows.slice(start, start + limit);

  // Keep summary cards aligned with the active course/search filters. Previously
  // the table was filtered while its totals still represented every teacher course.
  const statsRows = rows;
  const uniqueStudentHealth = new Map();

  statsRows.forEach((item) => {
    const key = item.studentId || item.id;
    const statusGroup =
      item.status === "followup" || item.status === "low_attendance"
        ? "followup"
        : "active";

    if (uniqueStudentHealth.get(key) === "followup") return;
    uniqueStudentHealth.set(key, statusGroup);
  });

  const attendanceRows = statsRows.filter((item) => item.hasAttendanceData);
  const averageAttendance = attendanceRows.length
    ? Math.round(attendanceRows.reduce((sum, item) => sum + item.attendance, 0) / attendanceRows.length)
    : 0;

  const newStudents = rows
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      name: item.name,
      avatar: item.avatar,
      course: item.course,
      time: item.lastActivity,
    }));

  return res.json(
    new ApiResponse({
      message: "Teacher students fetched successfully",
      data: {
        students,
        newStudents,
        courses: mapCourseOptions(courses),
        stats: {
          totalStudents: uniqueStudentHealth.size,
          activeStudents: Array.from(uniqueStudentHealth.values()).filter((value) => value === "active").length,
          followupStudents: Array.from(uniqueStudentHealth.values()).filter((value) => value === "followup")
            .length,
          averageAttendance,
        },
        meta: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    }),
  );
});

export const getTeacherProfile = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  const teacherId = req.user._id;

  const coursesCount = await Course.countDocuments(getTeacherCourseFilter(teacherId));

  const courseIds = (
    await Course.find(getTeacherCourseFilter(teacherId)).select("_id")
  ).map((c) => c._id);

  const activeEnrollmentRows = courseIds.length
    ? await Enrollment.find({ courseId: { $in: courseIds }, enrollmentStatus: "active" })
        .select("studentId")
        .populate("studentId", "_id")
    : [];
  const studentsCount = activeEnrollmentRows.filter((row) => Boolean(row?.studentId?._id)).length;

  const earnings = await calculateTeacherEarnings(teacherId);
  const totalRevenue = Number(earnings.totalRevenue || 0);

  return res.json(
    new ApiResponse({
      message: "Teacher profile fetched successfully",
      data: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        avatar: req.user.avatar || "",
        role: req.user.role,
        status: req.user.status,
        birthDate: req.user.birthDate || "",
        gender: req.user.gender || "",
        country: req.user.country || "",
        city: req.user.city || "",
        address: req.user.address || "",
        postalCode: req.user.postalCode || "",
        preferredLanguage: req.user.preferredLanguage || "",
        timezone: req.user.timezone || "",
        bio: req.user.bio || "",
        emergencyContactName: req.user.emergencyContactName || "",
        emergencyContactPhone: req.user.emergencyContactPhone || "",
        socialLinks: {
          linkedin: req.user?.socialLinks?.linkedin || "",
          youtube: req.user?.socialLinks?.youtube || "",
          instagram: req.user?.socialLinks?.instagram || "",
          facebook: req.user?.socialLinks?.facebook || "",
          whatsapp: req.user?.socialLinks?.whatsapp || "",
          twitter: req.user?.socialLinks?.twitter || "",
          github: req.user?.socialLinks?.github || "",
        },
        teacherApplication: {
          status: req.user?.teacherApplication?.status || "draft",
          submittedAt: req.user?.teacherApplication?.submittedAt || null,
          reviewedAt: req.user?.teacherApplication?.reviewedAt || null,
          reviewedBy: req.user?.teacherApplication?.reviewedBy || null,
          reviewNote: req.user?.teacherApplication?.reviewNote || "",
          professionalTitle: req.user?.teacherApplication?.professionalTitle || "",
          yearsExperience: Number(req.user?.teacherApplication?.yearsExperience || 0),
          education: req.user?.teacherApplication?.education || "",
          expertiseAreas: Array.isArray(req.user?.teacherApplication?.expertiseAreas)
            ? req.user.teacherApplication.expertiseAreas
            : [],
          teachingLevels: Array.isArray(req.user?.teacherApplication?.teachingLevels)
            ? req.user.teacherApplication.teachingLevels
            : [],
          certifications: Array.isArray(req.user?.teacherApplication?.certifications)
            ? req.user.teacherApplication.certifications
            : [],
          languages: Array.isArray(req.user?.teacherApplication?.languages)
            ? req.user.teacherApplication.languages
            : [],
          skillRatings: Array.isArray(req.user?.teacherApplication?.skillRatings)
            ? req.user.teacherApplication.skillRatings.map((item) => ({
                name: String(item?.name || "").trim(),
                percentage: Number(item?.percentage || 0),
              }))
            : [],
          portfolioUrl: req.user?.teacherApplication?.portfolioUrl || "",
          cvUrl: req.user?.teacherApplication?.cvUrl || "",
          certificatesFileUrl: req.user?.teacherApplication?.certificatesFileUrl || "",
          introVideoUrl: req.user?.teacherApplication?.introVideoUrl || "",
          courseIntroVideoUrls: Array.isArray(req.user?.teacherApplication?.courseIntroVideoUrls)
            ? req.user.teacherApplication.courseIntroVideoUrls.filter(Boolean)
            : [],
          nationalId: req.user?.teacherApplication?.nationalId || "",
          availableHoursPerWeek: Number(req.user?.teacherApplication?.availableHoursPerWeek || 0),
          expectedMonthlySalaryAfn: Number(req.user?.teacherApplication?.expectedMonthlySalaryAfn || 0),
          motivation: req.user?.teacherApplication?.motivation || "",
        },
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt,
        totals: {
          coursesCount,
          studentsCount,
          totalRevenue,
        },
      },
    }),
  );
});
