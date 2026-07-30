import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  ClipboardCheck,
  Clock,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPageLoader from "../components/common/TeacherPageLoader";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import useLiveDataRefresh from "../hooks/useLiveDataRefresh";
import usePersistentFormDraft, {
  clearTeacherFormDraft,
} from "../hooks/usePersistentFormDraft";
import { fetchTeacherCourses } from "../../services/courseService";
import { getAuthUser } from "../../services/portal";
import { getApiBase } from "../../services/http";
import {
  createTeacherAssignment,
  deleteTeacherAssignment,
  fetchTeacherAssignments,
  fetchTeacherAssignmentSubmissions,
  reviewTeacherAssignmentSubmission,
  updateTeacherAssignment,
} from "../../services/assignmentService";
import {
  getTeacherPageCacheKey,
  readTeacherPageCache,
  writeTeacherPageCache,
} from "../utils/teacherPageCache";

const PAGE_SIZE = 20;

const getAssignmentsCacheKey = ({ page, search, courseId, status, type }) =>
  getTeacherPageCacheKey("assignments", {
    page,
    search: String(search || "").trim(),
    courseId,
    status,
    type,
  });

const emptyForm = {
  title: "",
  courseId: "",
  type: "homework",
  dueAt: "",
  maxScore: 100,
  status: "draft",
  allowLateSubmission: false,
  attachmentUrl: "",
  description: "",
};

const DEFAULT_ASSIGNMENTS_META = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 };
const DEFAULT_ASSIGNMENTS_STATS = { total: 0, published: 0, pendingReview: 0, dueSoon: 0 };
const isManageableCourse = (course = {}) =>
  !course?.classEndedAt && !course?.classCancelledAt && course?.status !== "cancelled";

const formatDateTime = (value, language) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(language === "fa" ? "fa-IR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
};

const statusBadge = {
  draft: "bg-[#DBEAFE] text-[#0B4FD8]",
  published: "bg-[#DCFCE7] text-[#10B981]",
  closed: "bg-[#FEE2E2] text-[#EF4444]",
};

const getApiOrigin = () => {
  try {
    return new URL(getApiBase()).origin;
  } catch {
    return "";
  }
};

const resolveSubmissionAttachmentUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const apiOrigin = getApiOrigin();

  if (raw.startsWith("/uploads/")) {
    return apiOrigin ? `${apiOrigin}${raw}` : raw;
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith("/uploads/") && apiOrigin) {
        const apiHost = new URL(apiOrigin).host;
        if (parsed.host !== apiHost) {
          return `${apiOrigin}${parsed.pathname}${parsed.search}`;
        }
      }
      return raw;
    } catch {
      return raw;
    }
  }

  return raw;
};

export default function TeacherAssignments() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const isFa = language === "fa";
  const requestedCourseId = useMemo(
    () => new URLSearchParams(location.search).get("courseId") || "",
    [location.search],
  );
  const requestedSearch = useMemo(
    () => new URLSearchParams(location.search).get("q") || "",
    [location.search],
  );
  const initialAssignmentsCache = readTeacherPageCache(getAssignmentsCacheKey({
    page: 1,
    search: requestedSearch,
    courseId: requestedCourseId,
    status: "",
    type: "",
  }));
  const [courses, setCourses] = useState(initialAssignmentsCache?.courses || []);
  const [items, setItems] = useState(initialAssignmentsCache?.items || []);
  const [meta, setMeta] = useState(initialAssignmentsCache?.meta || DEFAULT_ASSIGNMENTS_META);
  const [stats, setStats] = useState(initialAssignmentsCache?.stats || DEFAULT_ASSIGNMENTS_STATS);
  const [search, setSearch] = useState(requestedSearch);
  const [courseId, setCourseId] = useState(requestedCourseId);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(!initialAssignmentsCache);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [deleteBusyId, setDeleteBusyId] = useState("");
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [submissionStats, setSubmissionStats] = useState({});
  const [reviewDraft, setReviewDraft] = useState({});
  const [reviewErrors, setReviewErrors] = useState({});
  const [reviewBusyId, setReviewBusyId] = useState("");
  const [selectedSubmissionDetail, setSelectedSubmissionDetail] = useState(null);
  const [downloadBusyId, setDownloadBusyId] = useState("");
  const [refreshSeed, setRefreshSeed] = useState(0);
  const assignmentsRequestRef = useRef(0);
  const submissionsRequestRef = useRef(0);
  const assignmentDraftId = `assignment:${editing?.id || "create"}`;
  usePersistentFormDraft({
    draftId: assignmentDraftId,
    value: form,
    setValue: setForm,
    enabled: openForm,
  });

  useLiveDataRefresh(() => setRefreshSeed((prev) => prev + 1), {
    intervalMs: 0,
    refreshOnFocus: false,
    refreshOnVisible: false,
  });

  const teacher = useMemo(() => {
    const user = getAuthUser();
    return user || { name: "Teacher", email: "teacher@edutech.study", role: "teacher" };
  }, []);

  const clearFormFieldError = (field) => {
    setFormErrors((prev) => {
      if (!prev?.[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const setFormField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearFormFieldError(field);
  };

  const loadAssignments = useCallback(async (targetPage = page) => {
    const requestId = ++assignmentsRequestRef.current;
    const cacheKey = getAssignmentsCacheKey({
      page: targetPage,
      search,
      courseId,
      status,
      type,
    });
    const cached = readTeacherPageCache(cacheKey);
    if (cached) {
      setCourses(cached.courses || []);
      setItems(cached.items || []);
      setMeta(cached.meta || DEFAULT_ASSIGNMENTS_META);
      setStats(cached.stats || DEFAULT_ASSIGNMENTS_STATS);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      setError("");

      const [listRes, publishedRes, pendingRes] = await Promise.all([
        fetchTeacherAssignments({
          page: targetPage,
          limit: PAGE_SIZE,
          search,
          courseId,
          status,
          type,
          sortBy: "newest",
          sortOrder: "desc",
        }),
        fetchTeacherAssignments({
          page: 1,
          limit: 1,
          status: "published",
          ...(courseId ? { courseId } : {}),
        }),
        fetchTeacherAssignments({
          page: 1,
          limit: 100,
          status: "published",
          ...(courseId ? { courseId } : {}),
        }),
      ]);
      if (requestId !== assignmentsRequestRef.current) return;

      const rows = Array.isArray(listRes?.items) ? listRes.items : [];
      const listMeta = listRes?.meta || {};
      const nextMeta = {
        page: Number(listMeta.page || targetPage || 1),
        limit: Number(listMeta.limit || PAGE_SIZE),
        total: Number(listMeta.total || 0),
        totalPages: Math.max(1, Number(listMeta.totalPages || 1)),
      };

      const pendingReview = (Array.isArray(pendingRes?.items) ? pendingRes.items : []).reduce(
        (sum, row) => sum + Number(row?.pendingReviewCount || 0),
        0,
      );
      const now = Date.now();
      const dueSoon = rows.filter((row) => {
        const dueAt = new Date(row?.dueAt || 0).getTime();
        if (!Number.isFinite(dueAt) || dueAt <= now) return false;
        const diffHours = (dueAt - now) / (1000 * 60 * 60);
        return diffHours <= 72;
      }).length;

      const nextStats = {
        total: Number(listMeta.total || 0),
        published: Number(publishedRes?.meta?.total || 0),
        pendingReview,
        dueSoon,
      };

      setItems(rows);
      setMeta(nextMeta);
      setStats(nextStats);
      writeTeacherPageCache(cacheKey, {
        courses,
        items: rows,
        meta: nextMeta,
        stats: nextStats,
      });
    } catch (err) {
      if (requestId !== assignmentsRequestRef.current) return;
      setError(err?.message || (isFa ? "بارگذاری تمرین‌ها ناموفق بود." : "Failed to load assignments."));
    } finally {
      if (requestId === assignmentsRequestRef.current) setLoading(false);
    }
  }, [courseId, isFa, page, search, status, type]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const { courses: rows } = await fetchTeacherCourses({ page: 1, limit: 100 });
        if (!mounted) return;
        setCourses((Array.isArray(rows) ? rows : []).filter(isManageableCourse));
      } catch {
        if (!mounted) return;
      }
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCourseId(requestedCourseId);
      setPage(1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [requestedCourseId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(requestedSearch);
      setPage(1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [requestedSearch]);

  useEffect(() => {
    loadAssignments(page);
    return () => {
      assignmentsRequestRef.current += 1;
    };
  }, [loadAssignments, page, refreshSeed]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2300);
    return () => clearTimeout(timer);
  }, [toast]);

  const validateAssignmentForm = () => {
    const errors = {};
    const title = String(form.title || "").trim();
    const description = String(form.description || "").trim();
    const attachmentUrl = String(form.attachmentUrl || "").trim();
    const dueAtMs = new Date(form.dueAt).getTime();
    const maxScore = Number(form.maxScore);

    if (!form.courseId) {
      errors.courseId = isFa ? "انتخاب کورس الزامی است." : "Course is required.";
    }

    if (!title) {
      errors.title = isFa ? "عنوان تمرین الزامی است." : "Title is required.";
    } else if (title.length < 3) {
      errors.title = isFa ? "عنوان باید حداقل ۳ کاراکتر باشد." : "Title must be at least 3 characters.";
    } else if (title.length > 180) {
      errors.title = isFa ? "عنوان باید حداکثر ۱۸۰ کاراکتر باشد." : "Title must be at most 180 characters.";
    }

    if (!form.dueAt || Number.isNaN(dueAtMs)) {
      errors.dueAt = isFa ? "تاریخ مهلت معتبر نیست." : "Due date is invalid.";
    } else if (!editing && dueAtMs <= Date.now()) {
      errors.dueAt = isFa
        ? "مهلت تمرین جدید باید در آینده باشد."
        : "A new assignment deadline must be in the future.";
    }

    if (!Number.isFinite(maxScore) || maxScore < 1 || maxScore > 1000) {
      errors.maxScore = isFa ? "نمره کامل باید بین 1 تا 1000 باشد." : "Max score must be between 1 and 1000.";
    }

    if (description.length > 4000) {
      errors.description = isFa ? "توضیحات باید حداکثر ۴۰۰۰ کاراکتر باشد." : "Description must be at most 4000 characters.";
    }

    if (attachmentUrl) {
      try {
        new URL(attachmentUrl);
      } catch {
        errors.attachmentUrl = isFa ? "لینک ضمیمه معتبر نیست." : "Attachment URL is invalid.";
      }
    }

    return errors;
  };

  const parseAssignmentFieldError = (message = "") => {
    const text = String(message || "");
    if (!text) return { field: "", message: "" };

    const quotedField = text.match(/"([^"]+)"/)?.[1] || "";
    const normalized = text.toLowerCase();
    const fieldCandidates = ["title", "courseId", "dueAt", "maxScore", "attachmentUrl", "description"];
    const field =
      fieldCandidates.find((key) => quotedField === key) ||
      fieldCandidates.find((key) => normalized.includes(key.toLowerCase())) ||
      "";

    return { field, message: text };
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
    setFormErrors({});
  };

  const openCreate = () => {
    resetForm();
    setOpenForm(true);
  };

  useEffect(() => {
    if (!location.state?.openCreate) return undefined;
    const timer = window.setTimeout(() => {
      setForm(emptyForm);
      setEditing(null);
      setFormErrors({});
      setOpenForm(true);
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: null,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search, location.state, navigate]);

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item?.title || "",
      courseId: item?.courseId || "",
      type: item?.type || "homework",
      dueAt: toDateInputValue(item?.dueAt),
      maxScore: Number(item?.maxScore || 100),
      status: item?.status || "draft",
      allowLateSubmission: Boolean(item?.allowLateSubmission),
      attachmentUrl: item?.attachmentUrl || "",
      description: item?.description || "",
    });
    setFormErrors({});
    setOpenForm(true);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    const clientErrors = validateAssignmentForm();
    if (Object.keys(clientErrors).length) {
      setFormErrors(clientErrors);
      return;
    }

    try {
      setError("");
      setSaving(true);
      const payload = {
        title: form.title.trim(),
        courseId: form.courseId,
        type: form.type,
        dueAt: new Date(form.dueAt).toISOString(),
        maxScore: Number(form.maxScore || 100),
        status: form.status,
        allowLateSubmission: Boolean(form.allowLateSubmission),
        attachmentUrl: String(form.attachmentUrl || "").trim(),
        description: String(form.description || "").trim(),
      };

      if (editing?.id) {
        await updateTeacherAssignment(editing.id, payload);
        setToast(isFa ? "تمرین بروزرسانی شد." : "Assignment updated.");
      } else {
        await createTeacherAssignment(payload);
        setToast(isFa ? "تمرین ایجاد شد." : "Assignment created.");
      }

      window.dispatchEvent(new Event("edutech_data_changed"));
      clearTeacherFormDraft(assignmentDraftId);
      setOpenForm(false);
      resetForm();
      await loadAssignments(page);
    } catch (err) {
      const backendMessage = err?.message || "";
      const parsed = parseAssignmentFieldError(backendMessage);
      if (parsed.field) {
        setFormErrors((prev) => ({ ...prev, [parsed.field]: parsed.message }));
      } else {
        setError(backendMessage || (isFa ? "ذخیره تمرین ناموفق بود." : "Failed to save assignment."));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const ok = window.confirm(
      isFa
        ? "این تمرین و همه تسلیمی‌ها و نمره‌های مرتبط برای همیشه حذف شود؟"
        : "Permanently delete this assignment and all related submissions and grades?",
    );
    if (!ok) return;

    try {
      setDeleteBusyId(item.id);
      await deleteTeacherAssignment(item.id);
      setToast(isFa ? "تمرین حذف شد." : "Assignment deleted.");
      window.dispatchEvent(new Event("edutech_data_changed"));
      await loadAssignments(page);
    } catch (err) {
      setError(err?.message || (isFa ? "حذف تمرین ناموفق بود." : "Failed to delete assignment."));
    } finally {
      setDeleteBusyId("");
    }
  };

  const openSubmissions = async (item) => {
    const requestId = ++submissionsRequestRef.current;
    try {
      setSubmissionsOpen(true);
      setSubmissionLoading(true);
      setSelectedAssignment(item);
      setSelectedSubmissionDetail(null);
      const data = await fetchTeacherAssignmentSubmissions(item.id, {
        page: 1,
        limit: 100,
        status: "all",
      });
      if (requestId !== submissionsRequestRef.current) return;
      const rows = Array.isArray(data?.submissions) ? data.submissions : [];
      setSubmissions(rows);
      setSubmissionStats(data?.stats || {});
      setReviewErrors({});
      setReviewDraft(
        rows.reduce((acc, row) => {
          acc[row.studentId] = {
            score: row.score ?? "",
            feedback: row.feedback || "",
          };
          return acc;
        }, {}),
      );
    } catch (err) {
      if (requestId !== submissionsRequestRef.current) return;
      setError(err?.message || (isFa ? "بارگذاری تسلیمی‌ها ناموفق بود." : "Failed to load submissions."));
      setSubmissionsOpen(false);
      setSelectedAssignment(null);
      setSelectedSubmissionDetail(null);
    } finally {
      if (requestId === submissionsRequestRef.current) setSubmissionLoading(false);
    }
  };

  const closeSubmissionsModal = () => {
    submissionsRequestRef.current += 1;
    setSubmissionsOpen(false);
    setSelectedAssignment(null);
    setSelectedSubmissionDetail(null);
  };

  const getDownloadFilename = (url, fallback = "submission-file") => {
    try {
      const parsed = new URL(url);
      const name = parsed.pathname.split("/").filter(Boolean).pop() || "";
      return name || fallback;
    } catch {
      return fallback;
    }
  };

  const downloadSubmissionAttachment = async (row) => {
    const fileUrl = resolveSubmissionAttachmentUrl(row?.attachmentUrl || "");
    if (!fileUrl) return;

    const busyKey = `${row?.studentId || "student"}-${row?.id || "submission"}`;
    try {
      setDownloadBusyId(busyKey);
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(isFa ? "دانلود فایل ناموفق بود." : "File download failed.");
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = getDownloadFilename(fileUrl, `submission-${Date.now()}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
      setError(isFa ? "دانلود مستقیم ممکن نشد؛ فایل در تب جدید باز شد." : "Direct download failed; file opened in a new tab.");
    } finally {
      setDownloadBusyId("");
    }
  };

  const saveReview = async (studentId) => {
    const row = submissions.find((item) => item.studentId === studentId);
    const draft = reviewDraft[studentId] || {};
    const maxScore = Number(selectedAssignment?.maxScore || 100);
    const parsedScore = Number(draft.score);

    if (row?.status === "missing") {
      setReviewErrors((prev) => ({
        ...prev,
        [studentId]: { score: "", feedback: "", general: isFa ? "این شاگرد هنوز تمرینی ارسال نکرده است." : "This student has not submitted yet." },
      }));
      return;
    }

    if (row?.status === "reviewed") {
      setReviewErrors((prev) => ({
        ...prev,
        [studentId]: { score: "", feedback: "", general: isFa ? "این تسلیمی قبلاً بازبینی شده و قفل است." : "This submission is already reviewed and locked." },
      }));
      return;
    }

    if (draft.score === "" || draft.score === null || draft.score === undefined || Number.isNaN(parsedScore)) {
      setReviewErrors((prev) => ({
        ...prev,
        [studentId]: { score: isFa ? "نمره را وارد کنید." : "Enter a score.", feedback: "", general: "" },
      }));
      return;
    }

    if (parsedScore < 0 || parsedScore > maxScore) {
      setReviewErrors((prev) => ({
        ...prev,
        [studentId]: {
          score: isFa ? `نمره باید بین 0 تا ${maxScore} باشد.` : `Score must be between 0 and ${maxScore}.`,
          feedback: "",
          general: "",
        },
      }));
      return;
    }

    try {
      setReviewBusyId(studentId);
      setReviewErrors((prev) => ({ ...prev, [studentId]: { score: "", feedback: "", general: "" } }));
      const updated = await reviewTeacherAssignmentSubmission(selectedAssignment.id, studentId, {
        score: parsedScore,
        feedback: String(draft.feedback || ""),
      });
      setSubmissions((prev) => prev.map((row) => (row.studentId === studentId ? { ...row, ...updated } : row)));
      setReviewDraft((prev) => ({
        ...prev,
        [studentId]: {
          score: updated?.score ?? parsedScore,
          feedback: updated?.feedback || String(draft.feedback || ""),
        },
      }));
      setToast(isFa ? "بازبینی ثبت شد." : "Review saved.");
      window.dispatchEvent(new Event("edutech_data_changed"));
    } catch (err) {
      setReviewErrors((prev) => ({
        ...prev,
        [studentId]: {
          score: "",
          feedback: "",
          general: err?.message || (isFa ? "ثبت بازبینی ناموفق بود." : "Failed to save review."),
        },
      }));
    } finally {
      setReviewBusyId("");
    }
  };

  const summaryCards = [
    {
      id: "total",
      title: isFa ? "کل تمرین‌ها" : "Total Assignments",
      value: String(stats.total),
      subtitle: isFa ? "در تمام کورس‌های شما" : "Across all your courses",
      icon: ClipboardCheck,
    },
    {
      id: "published",
      title: isFa ? "تمرین‌های فعال" : "Published",
      value: String(stats.published),
      subtitle: isFa ? "قابل ارسال برای شاگردان" : "Open for student submissions",
      icon: Users,
    },
    {
      id: "pending",
      title: isFa ? "نیازمند بازبینی" : "Pending Reviews",
      value: String(stats.pendingReview),
      subtitle: isFa ? "تسلیمی‌های بررسی‌نشده" : "Submitted but not reviewed",
      icon: Clock,
    },
    {
      id: "dueSoon",
      title: isFa ? "مهلت نزدیک" : "Due Soon",
      value: String(stats.dueSoon),
      subtitle: isFa ? "تا 72 ساعت آینده" : "In the next 72 hours",
      icon: RefreshCw,
    },
  ];

  const typeOptions = useMemo(
    () => [
      { value: "", label: isFa ? "همه نوع‌ها" : "All Types" },
      { value: "homework", label: isFa ? "تمرین" : "Homework" },
      { value: "project", label: isFa ? "پروژه" : "Project" },
      { value: "quiz", label: isFa ? "کوییز" : "Quiz" },
    ],
    [isFa],
  );

  return (
    <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
      <section className={`space-y-5 ${isRTL ? "text-right" : "text-left"}`}>
        <header className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#0F172A]">{isFa ? "تمرین‌ها" : "Assignments"}</h1>
              <p className="mt-2 text-sm font-medium text-slate-600">
                {isFa
                  ? "مدیریت کامل تمرین: ایجاد، ویرایش، حذف، مشاهده تسلیمی‌ها و بازبینی نمرات."
                  : "Full assignment workflow: create, edit, delete, submissions, and grading."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openCreate}
                disabled={!courses.length}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} />
                {isFa ? "ایجاد تمرین" : "Create Assignment"}
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        {toast ? (
          <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm font-semibold text-[#166534]">
            {toast}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <article key={card.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500">{card.title}</p>
                <span className="rounded-xl bg-[#0B4FD8]/10 p-2 text-[#0B4FD8]">
                  <card.icon size={16} />
                </span>
              </div>
              <p className="mt-2 text-xl font-black text-[#0F172A]">{card.value}</p>
              <p className="mt-1 text-xs text-slate-500">{card.subtitle}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder={isFa ? "جستجو در عنوان تمرین..." : "Search assignment title..."}
              className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none transition focus:border-[#0B4FD8] lg:col-span-2"
            />

            <select
              value={courseId}
              onChange={(event) => {
                setPage(1);
                setCourseId(event.target.value);
              }}
              className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none transition focus:border-[#0B4FD8]"
            >
              <option value="">{isFa ? "همه کورس‌ها" : "All Courses"}</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>
                  {course.title}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
              className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none transition focus:border-[#0B4FD8]"
            >
              <option value="">{isFa ? "همه وضعیت‌ها" : "All Statuses"}</option>
              <option value="draft">{isFa ? "پیش‌نویس" : "Draft"}</option>
              <option value="published">{isFa ? "فعال" : "Published"}</option>
              <option value="closed">{isFa ? "بسته" : "Closed"}</option>
            </select>

            <select
              value={type}
              onChange={(event) => {
                setPage(1);
                setType(event.target.value);
              }}
              className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none transition focus:border-[#0B4FD8]"
            >
              {typeOptions.map((row) => (
                <option key={row.value || "all"} value={row.value}>
                  {row.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[1080px] w-full text-center">
              <thead className="bg-slate-50/80 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-center font-bold">{isFa ? "عنوان تمرین" : "Title"}</th>
                  <th className="px-4 py-3 text-center font-bold">{isFa ? "کورس" : "Course"}</th>
                  <th className="px-4 py-3 text-center font-bold">{isFa ? "نوع" : "Type"}</th>
                  <th className="px-4 py-3 text-center font-bold">{isFa ? "مهلت" : "Due"}</th>
                  <th className="px-4 py-3 text-center font-bold">{isFa ? "تسلیمی/بررسی" : "Submitted/Reviewed"}</th>
                  <th className="px-4 py-3 text-center font-bold">{isFa ? "وضعیت" : "Status"}</th>
                  <th className="px-4 py-3 text-center font-bold">{isFa ? "عملیات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6">
                      <TeacherPageLoader
                        label={isFa ? "در حال بارگذاری" : "Loading"}
                        minHeight="min-h-[220px]"
                      />
                    </td>
                  </tr>
                ) : items.length ? (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-[#E2E8F0] text-sm last:border-b-0 hover:bg-slate-50/70">
                      <td className="px-4 py-4 text-center">
                        <p className="font-bold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-1">{item.description || "-"}</p>
                      </td>
                      <td className="px-4 py-4 text-center text-slate-700">{item.courseTitle || "-"}</td>
                      <td className="px-4 py-4 text-center text-slate-700">{item.typeLabel}</td>
                      <td className="px-4 py-4 text-center text-slate-700">{formatDateTime(item.dueAt, language)}</td>
                      <td className="px-4 py-4 text-center text-slate-700">
                        {item.submittedCount} / {item.reviewedCount}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadge[item.status] || "bg-slate-100 text-slate-700"}`}>
                          {item.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openSubmissions(item)}
                            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#0B4FD8] hover:text-[#0B4FD8]"
                          >
                            {isFa ? "تسلیمی‌ها" : "Submissions"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#0B4FD8] hover:text-[#0B4FD8]"
                          >
                            {isFa ? "ویرایش" : "Edit"}
                          </button>
                          <button
                            type="button"
                            disabled={deleteBusyId === item.id}
                            onClick={() => handleDelete(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] px-2.5 py-1.5 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                            {isFa ? "حذف" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                      {isFa ? "تمرینی پیدا نشد." : "No assignments found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {loading ? (
              <TeacherPageLoader
                label={isFa ? "در حال بارگذاری" : "Loading"}
                minHeight="min-h-[220px]"
              />
            ) : items.length ? (
              items.map((item) => (
                <article key={item.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900">{item.title}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadge[item.status] || "bg-slate-100 text-slate-700"}`}>
                      {item.statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.courseTitle || "-"}</p>
                  <p className="mt-2 text-xs text-slate-600">{formatDateTime(item.dueAt, language)}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {isFa ? "تسلیمی/بررسی" : "Submitted/Reviewed"}: {item.submittedCount} / {item.reviewedCount}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => openSubmissions(item)}
                      className="rounded-lg border border-[#E2E8F0] px-2 py-2 text-xs font-semibold text-slate-700"
                    >
                      {isFa ? "تسلیمی‌ها" : "Submissions"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="rounded-lg border border-[#E2E8F0] px-2 py-2 text-xs font-semibold text-slate-700"
                    >
                      {isFa ? "ویرایش" : "Edit"}
                    </button>
                    <button
                      type="button"
                      disabled={deleteBusyId === item.id}
                      onClick={() => handleDelete(item)}
                      className="rounded-lg border border-[#FECACA] px-2 py-2 text-xs font-semibold text-[#B91C1C] disabled:opacity-50"
                    >
                      {isFa ? "حذف" : "Delete"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-6 text-center text-sm font-semibold text-slate-500">
                {isFa ? "تمرینی پیدا نشد." : "No assignments found."}
              </p>
            )}
          </div>

          <footer className="border-t border-[#E2E8F0] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-[#0B4FD8]">
                {isFa ? `صفحه ${meta.page} از ${Math.max(1, meta.totalPages)}` : `Page ${meta.page} of ${Math.max(1, meta.totalPages)}`}
              </p>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isFa ? "قبلی" : "Previous"}
                </button>
                <button
                  type="button"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                  className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isFa ? "بعدی" : "Next"}
                </button>
              </div>
              <p className="text-xs text-slate-500 sm:text-sm">{isFa ? `مجموع: ${meta.total}` : `Total: ${meta.total}`}</p>
            </div>
          </footer>
        </section>
      </section>

      {openForm ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-3" onClick={() => setOpenForm(false)}>
          <form
            onSubmit={submitForm}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <h3 className="text-xl font-black text-[#0F172A]">{editing ? (isFa ? "ویرایش تمرین" : "Edit Assignment") : (isFa ? "ایجاد تمرین جدید" : "Create Assignment")}</h3>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-600">{isFa ? "عنوان تمرین" : "Assignment title"}</span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setFormField("title", e.target.value)}
                  className={`h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#0B4FD8] ${
                    formErrors.title ? "border-[#FCA5A5] bg-[#FEF2F2]" : "border-[#E2E8F0]"
                  }`}
                />
                {formErrors.title ? <p className="mt-1 text-[11px] font-semibold text-[#B91C1C]">{formErrors.title}</p> : null}
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-600">{isFa ? "کورس" : "Course"}</span>
                <select
                  required
                  value={form.courseId}
                  onChange={(e) => setFormField("courseId", e.target.value)}
                  className={`h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#0B4FD8] ${
                    formErrors.courseId ? "border-[#FCA5A5] bg-[#FEF2F2]" : "border-[#E2E8F0]"
                  }`}
                >
                  <option value="">{isFa ? "انتخاب کورس" : "Select course"}</option>
                  {courses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.title}
                    </option>
                  ))}
                </select>
                {formErrors.courseId ? <p className="mt-1 text-[11px] font-semibold text-[#B91C1C]">{formErrors.courseId}</p> : null}
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-600">{isFa ? "نوع تمرین" : "Type"}</span>
                <select
                  value={form.type}
                  onChange={(e) => setFormField("type", e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]"
                >
                  <option value="homework">{isFa ? "تمرین" : "Homework"}</option>
                  <option value="project">{isFa ? "پروژه" : "Project"}</option>
                  <option value="quiz">{isFa ? "کوییز" : "Quiz"}</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-600">{isFa ? "مهلت تحویل" : "Due date"}</span>
                <input
                  required
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(e) => setFormField("dueAt", e.target.value)}
                  className={`h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#0B4FD8] ${
                    formErrors.dueAt ? "border-[#FCA5A5] bg-[#FEF2F2]" : "border-[#E2E8F0]"
                  }`}
                />
                {formErrors.dueAt ? <p className="mt-1 text-[11px] font-semibold text-[#B91C1C]">{formErrors.dueAt}</p> : null}
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-600">{isFa ? "نمره کامل" : "Max score"}</span>
                <input
                  required
                  min={1}
                  max={1000}
                  type="number"
                  value={form.maxScore}
                  onChange={(e) => setFormField("maxScore", e.target.value)}
                  className={`h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#0B4FD8] ${
                    formErrors.maxScore ? "border-[#FCA5A5] bg-[#FEF2F2]" : "border-[#E2E8F0]"
                  }`}
                />
                {formErrors.maxScore ? <p className="mt-1 text-[11px] font-semibold text-[#B91C1C]">{formErrors.maxScore}</p> : null}
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-600">{isFa ? "وضعیت" : "Status"}</span>
                <select
                  value={form.status}
                  onChange={(e) => setFormField("status", e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]"
                >
                  <option value="draft">{isFa ? "پیش‌نویس" : "Draft"}</option>
                  <option value="published">{isFa ? "فعال" : "Published"}</option>
                  <option value="closed">{isFa ? "بسته" : "Closed"}</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-600">{isFa ? "لینک ضمیمه (اختیاری)" : "Attachment URL (optional)"}</span>
                <input
                  value={form.attachmentUrl}
                  onChange={(e) => setFormField("attachmentUrl", e.target.value)}
                  className={`h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#0B4FD8] ${
                    formErrors.attachmentUrl ? "border-[#FCA5A5] bg-[#FEF2F2]" : "border-[#E2E8F0]"
                  }`}
                />
                {formErrors.attachmentUrl ? <p className="mt-1 text-[11px] font-semibold text-[#B91C1C]">{formErrors.attachmentUrl}</p> : null}
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-600">{isFa ? "توضیحات" : "Description"}</span>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setFormField("description", e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[#0B4FD8] ${
                    formErrors.description ? "border-[#FCA5A5] bg-[#FEF2F2]" : "border-[#E2E8F0]"
                  }`}
                />
                {formErrors.description ? <p className="mt-1 text-[11px] font-semibold text-[#B91C1C]">{formErrors.description}</p> : null}
              </label>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.allowLateSubmission}
                  onChange={(e) => setFormField("allowLateSubmission", e.target.checked)}
                />
                {isFa ? "اجازه ارسال بعد از مهلت" : "Allow late submissions"}
              </label>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setOpenForm(false);
                  resetForm();
                }}
                className="h-11 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-700"
              >
                {isFa ? "لغو" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-11 rounded-xl bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9] text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? (isFa ? "در حال ذخیره" : "Saving") : editing ? (isFa ? "ذخیره تغییرات" : "Save changes") : (isFa ? "ایجاد تمرین" : "Create assignment")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {submissionsOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-3" onClick={closeSubmissionsModal}>
          <div
            onClick={(event) => event.stopPropagation()}
            className="max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-[#0F172A]">{isFa ? "بازبینی تسلیمی‌ها" : "Submission Review"}</h3>
                <p className="mt-1 text-sm text-slate-600">{selectedAssignment?.title || "-"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {isFa
                    ? `کل: ${submissionStats.totalStudents || 0} | ارسال‌شده: ${submissionStats.submittedCount || 0} | بررسی‌شده: ${submissionStats.reviewedCount || 0}`
                    : `Total: ${submissionStats.totalStudents || 0} | Submitted: ${submissionStats.submittedCount || 0} | Reviewed: ${submissionStats.reviewedCount || 0}`}
                </p>
              </div>
              <button type="button" onClick={closeSubmissionsModal} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            {submissionLoading ? (
              <p className="py-10 text-center text-sm font-semibold text-slate-500">{isFa ? "در حال بارگذاری" : "Loading"}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1260px] w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold">{isFa ? "شاگرد" : "Student"}</th>
                      <th className="px-4 py-3 font-bold">{isFa ? "وضعیت" : "Status"}</th>
                      <th className="px-4 py-3 font-bold">{isFa ? "زمان ارسال" : "Submitted At"}</th>
                      <th className="px-4 py-3 font-bold">{isFa ? "پاسخ شاگرد" : "Student Answer"}</th>
                      <th className="px-4 py-3 font-bold">{isFa ? "نمره" : "Score"}</th>
                      <th className="px-4 py-3 font-bold">{isFa ? "بازخورد" : "Feedback"}</th>
                      <th className="px-4 py-3 font-bold">{isFa ? "عملیات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((row) => (
                      <tr key={row.studentId} className="border-b border-[#E2E8F0] last:border-b-0">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{row.studentName}</p>
                          <p className="text-xs text-slate-500">{row.studentEmail}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            row.status === "reviewed"
                              ? "bg-[#DCFCE7] text-[#10B981]"
                              : row.status === "submitted"
                                ? "bg-[#DBEAFE] text-[#0B4FD8]"
                                : "bg-slate-100 text-slate-700"
                          }`}>
                            {row.statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{formatDateTime(row.submittedAt, language)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedSubmissionDetail(row)}
                            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#0B4FD8] hover:text-[#0B4FD8]"
                          >
                            {isFa ? "مشاهده پاسخ" : "View Response"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            max={Number(selectedAssignment?.maxScore || 100)}
                            value={reviewDraft[row.studentId]?.score ?? ""}
                            disabled={row.status === "missing" || row.status === "reviewed"}
                            onChange={(event) =>
                              setReviewDraft((prev) => ({
                                ...prev,
                                [row.studentId]: {
                                  ...(prev[row.studentId] || {}),
                                  score: event.target.value,
                                },
                              }))
                            }
                            className="h-9 w-24 rounded-lg border border-[#E2E8F0] px-2 text-sm outline-none focus:border-[#0B4FD8] disabled:bg-slate-100"
                          />
                          {reviewErrors[row.studentId]?.score ? (
                            <p className="mt-1 text-[11px] font-semibold text-[#B91C1C]">{reviewErrors[row.studentId].score}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={reviewDraft[row.studentId]?.feedback || ""}
                            disabled={row.status === "missing" || row.status === "reviewed"}
                            onChange={(event) =>
                              setReviewDraft((prev) => ({
                                ...prev,
                                [row.studentId]: {
                                  ...(prev[row.studentId] || {}),
                                  feedback: event.target.value,
                                },
                              }))
                            }
                            className="h-9 w-full min-w-[240px] rounded-lg border border-[#E2E8F0] px-2 text-sm outline-none focus:border-[#0B4FD8] disabled:bg-slate-100"
                          />
                          {reviewErrors[row.studentId]?.feedback ? (
                            <p className="mt-1 text-[11px] font-semibold text-[#B91C1C]">{reviewErrors[row.studentId].feedback}</p>
                          ) : null}
                          {reviewErrors[row.studentId]?.general ? (
                            <p className="mt-1 text-[11px] font-semibold text-[#B91C1C]">{reviewErrors[row.studentId].general}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {row.status === "reviewed" ? (
                            <button
                              type="button"
                              onClick={() => setSelectedSubmissionDetail(row)}
                              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#0B4FD8] hover:text-[#0B4FD8]"
                            >
                              {isFa ? "ویرایش" : "Edit"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={row.status === "missing" || reviewBusyId === row.studentId}
                              onClick={() => saveReview(row.studentId)}
                              className="rounded-lg bg-[#0B4FD8] px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {reviewBusyId === row.studentId
                                ? (isFa ? "درحال ثبت" : "Saving")
                                : isFa
                                  ? "ثبت بازبینی"
                                  : "Save Review"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {selectedSubmissionDetail ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 p-3"
          onClick={() => setSelectedSubmissionDetail(null)}
        >
          {(() => {
            const detailRow =
              submissions.find((row) => row.studentId === selectedSubmissionDetail.studentId) || selectedSubmissionDetail;
            const isLocked = detailRow.status === "missing" || detailRow.status === "reviewed";
            return (
          <div
            onClick={(event) => event.stopPropagation()}
            className={`w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6 ${isRTL ? "text-right" : "text-left"}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-[#0F172A]">{isFa ? "جزئیات پاسخ شاگرد" : "Student Response Details"}</h3>
                <p className="mt-1 text-sm text-slate-600">{detailRow.studentName || "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmissionDetail(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#E2E8F0] bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-500">{isFa ? "ایمیل شاگرد" : "Student Email"}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{detailRow.studentEmail || "-"}</p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-500">{isFa ? "وضعیت" : "Status"}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{detailRow.statusLabel || "-"}</p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-500">{isFa ? "زمان ارسال" : "Submitted At"}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{formatDateTime(detailRow.submittedAt, language)}</p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-500">{isFa ? "نمره ثبت‌شده" : "Saved Score"}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {detailRow.score ?? (isFa ? "ثبت نشده" : "Not graded")}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-white px-3 py-3">
              <p className="text-xs font-semibold text-slate-500">{isFa ? "متن پاسخ شاگرد" : "Student Text Answer"}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                {detailRow.textAnswer || (isFa ? "متنی ثبت نشده است." : "No text answer submitted.")}
              </p>
            </div>

            <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-white px-3 py-3">
              <p className="text-xs font-semibold text-slate-500">{isFa ? "فایل یا لینک ضمیمه" : "Attachment Link/File"}</p>
              {detailRow.attachmentUrl ? (
                (() => {
                  const fileUrl = resolveSubmissionAttachmentUrl(detailRow.attachmentUrl);
                  const busyKey = `${detailRow?.studentId || "student"}-${detailRow?.id || "submission"}`;
                  return (
                    <div className="mt-2 flex items-center gap-3">
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex text-sm font-semibold text-[#0B4FD8] underline-offset-2 hover:underline"
                      >
                        {isFa ? "بازکردن ضمیمه" : "Open attachment"}
                      </a>
                      <button
                        type="button"
                        disabled={downloadBusyId === busyKey}
                        onClick={() => downloadSubmissionAttachment(detailRow)}
                        className="rounded-md border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#0B4FD8] hover:text-[#0B4FD8] disabled:opacity-50"
                      >
                        {downloadBusyId === busyKey ? (isFa ? "درحال دانلود" : "Downloading") : isFa ? "دانلود فایل" : "Download file"}
                      </button>
                    </div>
                  );
                })()
              ) : (
                <p className="mt-2 text-sm text-slate-500">{isFa ? "ضمیمه‌ای ثبت نشده است." : "No attachment provided."}</p>
              )}
            </div>

            <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-white px-3 py-3">
              <p className="text-xs font-semibold text-slate-500">{isFa ? "ویرایش بازبینی" : "Edit Review"}</p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-start">
                <div>
                  <input
                    type="number"
                    min={0}
                    max={Number(selectedAssignment?.maxScore || 100)}
                    value={reviewDraft[detailRow.studentId]?.score ?? ""}
                    disabled={isLocked}
                    onChange={(event) =>
                      setReviewDraft((prev) => ({
                        ...prev,
                        [detailRow.studentId]: {
                          ...(prev[detailRow.studentId] || {}),
                          score: event.target.value,
                        },
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8] disabled:bg-slate-100"
                    placeholder={isFa ? "نمره" : "Score"}
                  />
                  {reviewErrors[detailRow.studentId]?.score ? (
                    <p className="mt-1 text-[11px] font-semibold text-[#B91C1C]">{reviewErrors[detailRow.studentId].score}</p>
                  ) : null}
                </div>
                <div>
                  <input
                    value={reviewDraft[detailRow.studentId]?.feedback || ""}
                    disabled={isLocked}
                    onChange={(event) =>
                      setReviewDraft((prev) => ({
                        ...prev,
                        [detailRow.studentId]: {
                          ...(prev[detailRow.studentId] || {}),
                          feedback: event.target.value,
                        },
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8] disabled:bg-slate-100"
                    placeholder={isFa ? "بازخورد" : "Feedback"}
                  />
                  {reviewErrors[detailRow.studentId]?.feedback ? (
                    <p className="mt-1 text-[11px] font-semibold text-[#B91C1C]">{reviewErrors[detailRow.studentId].feedback}</p>
                  ) : null}
                  {reviewErrors[detailRow.studentId]?.general ? (
                    <p className="mt-1 text-[11px] font-semibold text-[#B91C1C]">{reviewErrors[detailRow.studentId].general}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={isLocked || reviewBusyId === detailRow.studentId}
                  onClick={() => saveReview(detailRow.studentId)}
                  className="h-10 rounded-lg bg-[#0B4FD8] px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reviewBusyId === detailRow.studentId
                    ? (isFa ? "درحال ثبت" : "Saving")
                    : detailRow.status === "reviewed"
                      ? (isFa ? "قفل شده" : "Locked")
                      : isFa
                        ? "ثبت بازبینی"
                        : "Save Review"}
                </button>
              </div>
            </div>
          </div>
            );
          })()}
        </div>
      ) : null}
    </TeacherLayout>
  );
}
