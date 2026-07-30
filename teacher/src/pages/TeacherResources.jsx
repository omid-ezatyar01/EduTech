import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Edit3, FileText, Link2, Plus, Trash2, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPageLoader from "../components/common/TeacherPageLoader";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import useLiveDataRefresh from "../hooks/useLiveDataRefresh";
import usePersistentFormDraft, {
  clearTeacherFormDraft,
  mergeTeacherFormDraft,
} from "../hooks/usePersistentFormDraft";
import { getAuthUser } from "../../services/portal";
import {
  createTeacherCourseResource,
  deleteTeacherCourseResource,
  fetchTeacherCourseById,
  fetchTeacherCourseResources,
  fetchTeacherCourses,
  updateTeacherCourseResource,
} from "../../services/courseService";
import { fetchTeacherLiveSessions } from "../../services/liveSessionService";
import { getApiBase } from "../../services/http";
import {
  getTeacherPageCacheKey,
  readTeacherPageCache,
  writeTeacherPageCache,
} from "../utils/teacherPageCache";
import { extractRouteIdentifier } from "../utils/routePaths";

const PDF_FILE_MAX_BYTES = 5 * 1024 * 1024;
const PDF_TOTAL_MAX_BYTES = 25 * 1024 * 1024;
const COURSES_PER_PAGE = 10;
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const getResourceCoursesCacheKey = (coursePage) =>
  getTeacherPageCacheKey("resources-courses", { coursePage });

const emptyForm = {
  title: "",
  module: "",
  linkText: "",
  pdfFiles: [],
};
const DEFAULT_COURSE_PAGINATION = {
  page: 1,
  limit: COURSES_PER_PAGE,
  total: 0,
  totalPages: 1,
};
const isManageableCourse = (course = {}) =>
  !course?.classEndedAt && !course?.classCancelledAt && course?.status !== "cancelled";

const bytesToMb = (bytes = 0) => `${Math.round(Number(bytes || 0) / 1024 / 1024)}MB`;

const parseLinks = (value = "") => {
  const matches = String(value || "").match(/https?:\/\/[^\s,]+/gi);
  return [...new Set(matches || [])];
};

const makeLinkTitle = (baseTitle, link, index) => {
  try {
    const host = new URL(link).hostname.replace(/^www\./i, "");
    return `${baseTitle} - ${host || `Link ${index + 1}`}`.slice(0, 140);
  } catch {
    return `${baseTitle} - Link ${index + 1}`.slice(0, 140);
  }
};

const makePdfTitle = (baseTitle, file, index) => {
  const cleanName = String(file?.name || `PDF ${index + 1}`).replace(/\.pdf$/i, "").trim();
  return `${baseTitle} - ${cleanName}`.slice(0, 140);
};

const getTypeIcon = (type) => (type === "Link" || type === "Video" ? Link2 : FileText);

const formatDateTimeRange = (startAt, endAt, locale) => {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime())) return "";

  const date = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(start);
  const startTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(start);
  const endTime = Number.isNaN(end.getTime())
    ? ""
    : new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(end);

  return endTime ? `${date} · ${startTime} - ${endTime}` : `${date} · ${startTime}`;
};

const getSessionId = (session) => String(session?.id || session?._id || "");
const getCourseId = (course) => String(course?.id || course?._id || "");
const getObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "object" && value.$oid) return String(value.$oid || "");
  return String(value || "");
};
const getResourceId = (resource) => {
  const candidates = [
    resource?.id,
    resource?._id,
    resource?.resourceId,
    resource?.resource?._id,
  ];

  for (const candidate of candidates) {
    const value = getObjectIdString(candidate).trim();
    if (OBJECT_ID_PATTERN.test(value)) return value;
  }

  return "";
};
const normalizeResource = (resource = {}) => {
  const resourceId = getResourceId(resource);
  return {
    ...resource,
    id: resourceId || String(resource?.id || ""),
    _id: resourceId || getObjectIdString(resource?._id),
    courseId: getObjectIdString(resource?.courseId),
    sessionId: getObjectIdString(resource?.sessionId),
  };
};

const resolveMediaUrl = (rawUrl) => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/")) return value;

  try {
    return `${new URL(getApiBase()).origin}${value}`;
  } catch {
    return value;
  }
};

export default function TeacherResources() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const params = new URLSearchParams(location.search);
  const requestedCourseValue = params.get("courseId") || params.get("course") || "";
  const initialCourseId = extractRouteIdentifier(requestedCourseValue);
  const isFa = language === "fa";
  const locale = isFa ? "fa-AF" : "en-US";

  const teacher = useMemo(() => {
    const user = getAuthUser();
    return user || { name: "Teacher", email: "teacher@edutech.study", role: "teacher" };
  }, []);
  const initialResourceCoursesCache = readTeacherPageCache(getResourceCoursesCacheKey(1));

  const [courses, setCourses] = useState(initialResourceCoursesCache?.courses || []);
  const [coursePage, setCoursePage] = useState(1);
  const [coursePagination, setCoursePagination] = useState(
    initialResourceCoursesCache?.coursePagination || DEFAULT_COURSE_PAGINATION,
  );
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingResource, setEditingResource] = useState(null);
  const [editFile, setEditFile] = useState(null);
  const [error, setError] = useState("");
  const [loadingCourses, setLoadingCourses] = useState(!initialResourceCoursesCache);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const resourcesRequestRef = useRef(0);
  const sessionsRequestRef = useRef(0);
  const resourceDraftId = `resource:${selectedCourseId || "unselected"}`;
  usePersistentFormDraft({
    draftId: resourceDraftId,
    value: form,
    setValue: setForm,
    enabled: Boolean(selectedCourseId) && !editingResource,
    restore: false,
  });

  useLiveDataRefresh(() => setRefreshSeed((prev) => prev + 1), {
    intervalMs: 0,
    refreshOnFocus: false,
    refreshOnVisible: false,
  });

  const labels = {
    title: isFa ? "مدیریت محتوای کورس" : "Manage Course Content",
    chooseCourseTitle: isFa ? "کورس مورد نظر را انتخاب کنید" : "Choose a course",
    chooseCourseSubtitle: isFa
      ? "برای افزودن فایل‌ها و لینک‌های آموزشی، اول یکی از کورس‌های خود را انتخاب کنید."
      : "Select one of your courses first, then add PDFs and learning links.",
    subtitle: isFa
      ? "جلسه صنف را انتخاب کنید و PDFها یا لینک‌های آموزشی را اضافه کنید. هر PDF حداکثر ۵MB و مجموع هر کورس حداکثر ۲۵MB است."
      : "Select a class session and add PDFs or learning links. Each PDF is limited to 5 MB and each course to 25 MB total.",
    course: isFa ? "انتخاب کورس" : "Select Course",
    backToCourses: isFa ? "برگشت به کورس‌ها" : "Back to Courses",
    selectCourse: isFa ? "یک کورس را انتخاب کنید" : "Choose a course",
    add: editingResource ? (isFa ? "ذخیره تغییرات" : "Save Changes") : (isFa ? "افزودن محتوا" : "Add Content"),
    cancel: isFa ? "لغو ویرایش" : "Cancel Edit",
    resourceTitle: isFa ? "عنوان کلی محتوا" : "Content Title",
    session: isFa ? "بخش درس / جلسه صنف" : "Lesson Session",
    manualSession: isFa ? "نام بخش درس" : "Lesson section name",
    selectSession: isFa ? "جلسه صنف را انتخاب کنید" : "Select a class session",
    links: isFa ? "لینک‌ها" : "Links",
    linksHint: isFa ? "هر لینک را در یک خط جدا بنویسید" : "Put each link on a separate line",
    pdf: isFa ? "PDFها" : "PDF Files",
    replacePdf: isFa ? "تعویض PDF" : "Replace PDF",
    empty: isFa ? "هنوز محتوایی برای این کورس اضافه نشده است." : "No content has been added for this course yet.",
    list: isFa ? "محتوای کورس" : "Course Content",
    used: isFa ? "حجم استفاده‌شده PDF" : "PDF usage",
    loading: isFa ? "در حال بارگذاری" : "Loading",
    noCourses: isFa ? "ابتدا یک کورس بسازید تا بتوانید محتوا اضافه کنید." : "Create a course first before adding content.",
    noSessions: isFa ? "برای این کورس هنوز جلسه صنف ثبت نشده است." : "No class sessions exist for this course yet.",
    students: isFa ? "شاگرد" : "students",
    previous: isFa ? "قبلی" : "Previous",
    next: isFa ? "بعدی" : "Next",
  };

  const selectedCourse = useMemo(
    () => courses.find((course) => getCourseId(course) === String(selectedCourseId)),
    [courses, selectedCourseId],
  );

  const selectedSession = useMemo(
    () => sessions.find((session) => getSessionId(session) === String(selectedSessionId)),
    [sessions, selectedSessionId],
  );

  const sessionLabelById = useMemo(() => {
    const labelsById = new Map();
    sessions.forEach((session) => {
      const sessionId = getSessionId(session);
      if (!sessionId) return;
      const sessionTime = formatDateTimeRange(session.startAt, session.endAt, locale);
      labelsById.set(sessionId, sessionTime ? `${session.title} · ${sessionTime}` : session.title);
    });
    return labelsById;
  }, [locale, sessions]);

  const groupedResources = useMemo(() => {
    const groups = new Map();

    resources.forEach((item) => {
      const key = item.sessionId || item.module || item.description || "uncategorized";
      const title = item.sessionId
        ? sessionLabelById.get(item.sessionId) || item.module || item.description
        : item.module || item.description || (isFa ? "جلسه نامشخص" : "Unassigned session");

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title,
          items: [],
        });
      }

      groups.get(key).items.push(item);
    });

    return Array.from(groups.values());
  }, [isFa, resources, sessionLabelById]);

  const existingPdfTotal = useMemo(
    () => resources.reduce((sum, item) => sum + (item.type === "PDF" ? Number(item.fileSize || 0) : 0), 0),
    [resources],
  );

  const selectedPdfTotal = useMemo(
    () => form.pdfFiles.reduce((sum, file) => sum + Number(file.size || 0), 0),
    [form.pdfFiles],
  );
  const hasCourseSessions = sessions.length > 0;
  const formLockedBySession = !hasCourseSessions || !selectedSessionId;

  const resetForm = (clearError = true) => {
    setForm(emptyForm);
    setSelectedSessionId("");
    setEditingResource(null);
    setEditFile(null);
    if (clearError) setError("");
  };

  const selectCourse = (course) => {
    const courseId = getCourseId(course);
    setSelectedCourseId(courseId);
    navigate(`/teacher/resources?courseId=${encodeURIComponent(courseId)}`, { replace: false });
  };

  const clearCourseSelection = () => {
    setSelectedCourseId("");
    setSessions([]);
    setResources([]);
    resetForm();
    navigate("/teacher/resources", { replace: false });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedCourseId((current) =>
        current === initialCourseId ? current : initialCourseId,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialCourseId]);

  useEffect(() => {
    if (
      !selectedCourseId ||
      loadingCourses ||
      courses.some((course) => getCourseId(course) === String(selectedCourseId))
    ) {
      return undefined;
    }

    let active = true;
    fetchTeacherCourseById(selectedCourseId)
      .then((course) => {
        if (!active || !course) return;
        if (!isManageableCourse(course)) {
          setError(
            isFa
              ? "منابع کورس پایان‌یافته قابل ویرایش نیست."
              : "Resources for an ended course are read-only.",
          );
          setSelectedCourseId("");
          navigate("/teacher/resources", { replace: true });
          return;
        }
        setCourses((current) => [
          course,
          ...current.filter((item) => getCourseId(item) !== getCourseId(course)),
        ]);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError?.message ||
            (isFa ? "کورس انتخاب‌شده پیدا نشد." : "The selected course was not found."),
        );
      });

    return () => {
      active = false;
    };
  }, [courses, isFa, loadingCourses, navigate, selectedCourseId]);

  const applySessionToForm = (sessionId) => {
    setSelectedSessionId(sessionId);
    const session = sessions.find((row) => getSessionId(row) === String(sessionId));
    if (!session) return;

    const sessionTime = formatDateTimeRange(session.startAt, session.endAt, locale);
    const module = sessionTime ? `${session.title} · ${sessionTime}` : session.title;
    setForm((prev) => ({
      ...prev,
      title: session.title || prev.title,
      module: module.slice(0, 140),
    }));
  };

  const loadResources = useCallback(async (courseId = selectedCourseId) => {
    const requestId = ++resourcesRequestRef.current;
    if (!courseId) {
      setResources([]);
      setLoadingResources(false);
      return;
    }
    try {
      setLoadingResources(true);
      setError("");
      const rows = await fetchTeacherCourseResources(courseId);
      if (requestId !== resourcesRequestRef.current) return;
      setResources(rows.map(normalizeResource));
    } catch (err) {
      if (requestId !== resourcesRequestRef.current) return;
      setError(err?.message || (isFa ? "بارگذاری محتوا ناموفق بود." : "Failed to load content."));
    } finally {
      if (requestId === resourcesRequestRef.current) setLoadingResources(false);
    }
  }, [isFa, selectedCourseId]);

  const loadSessions = useCallback(async (courseId = selectedCourseId) => {
    const requestId = ++sessionsRequestRef.current;
    if (!courseId) {
      setSessions([]);
      setLoadingSessions(false);
      return;
    }
    try {
      setLoadingSessions(true);
      const result = await fetchTeacherLiveSessions({ courseId, limit: 100 });
      if (requestId !== sessionsRequestRef.current) return;
      setSessions(Array.isArray(result?.sessions) ? result.sessions : []);
    } catch (err) {
      if (requestId !== sessionsRequestRef.current) return;
      setError(err?.message || (isFa ? "بارگذاری جلسات صنف ناموفق بود." : "Failed to load class sessions."));
    } finally {
      if (requestId === sessionsRequestRef.current) setLoadingSessions(false);
    }
  }, [isFa, selectedCourseId]);

  useEffect(() => {
    let mounted = true;

    const loadCourses = async () => {
      const cacheKey = getResourceCoursesCacheKey(coursePage);
      const cached = readTeacherPageCache(cacheKey);
      if (cached) {
        setCourses(cached.courses || []);
        setCoursePagination(cached.coursePagination || DEFAULT_COURSE_PAGINATION);
        setLoadingCourses(false);
      } else {
        setLoadingCourses(true);
      }

      try {
        const result = await fetchTeacherCourses({ page: coursePage, limit: COURSES_PER_PAGE });
        if (!mounted) return;
        const rows = (Array.isArray(result?.courses) ? result.courses : []).filter(isManageableCourse);
        const meta = result?.meta || {};
        const nextPagination = {
          page: Number(meta.page || coursePage),
          limit: Number(meta.limit || COURSES_PER_PAGE),
          total: Number(meta.total || rows.length),
          totalPages: Math.max(1, Number(meta.totalPages || 1)),
        };
        setCourses(rows);
        setCoursePagination(nextPagination);
        writeTeacherPageCache(cacheKey, {
          courses: rows,
          coursePagination: nextPagination,
        });
      } catch (err) {
        if (mounted) setError(err?.message || (isFa ? "بارگذاری کورس‌ها ناموفق بود." : "Failed to load courses."));
      } finally {
        if (mounted) setLoadingCourses(false);
      }
    };

    loadCourses();
    return () => {
      mounted = false;
    };
  }, [coursePage, isFa, refreshSeed]);

  useEffect(() => {
    const timer = setTimeout(() => {
      resetForm(false);
      setForm(
        mergeTeacherFormDraft(
          `resource:${selectedCourseId || "unselected"}`,
          emptyForm,
        ),
      );
      loadResources(selectedCourseId);
      loadSessions(selectedCourseId);
    }, 0);
    return () => clearTimeout(timer);
  }, [loadResources, loadSessions, refreshSeed, selectedCourseId]);

  const validatePdfFiles = (files = []) => {
    for (const file of files) {
      const isPdf = file.type === "application/pdf" || String(file.name || "").toLowerCase().endsWith(".pdf");
      if (!isPdf) return isFa ? "فقط فایل PDF مجاز است." : "Only PDF files are allowed.";
    }

    if (files.some((file) => file.size > PDF_FILE_MAX_BYTES)) {
      return isFa ? "حجم هر PDF باید حداکثر ۵MB باشد." : "Each PDF must be 5 MB or less.";
    }

    const nextTotal = editingResource?.type === "PDF"
      ? existingPdfTotal - Number(editingResource.fileSize || 0) + (files[0]?.size || 0)
      : existingPdfTotal + selectedPdfTotal;

    if (nextTotal > PDF_TOTAL_MAX_BYTES) {
      return isFa
        ? "مجموع PDFهای این کورس نباید بیشتر از ۲۵MB باشد."
        : "Total PDFs for this course must not exceed 25 MB.";
    }

    return "";
  };

  const validateForm = () => {
    const module = form.module.trim();
    const links = parseLinks(form.linkText);

    if (!selectedCourseId) return isFa ? "اول یک کورس انتخاب کنید." : "Select a course first.";
    if (!hasCourseSessions) return labels.noSessions;
    if (!selectedSessionId) return labels.selectSession;
    if (!module || module.length < 2) return isFa ? "بخش درس الزامی است." : "Lesson session is required.";

    if (editingResource) {
      if (editingResource.type === "PDF" && editFile) return validatePdfFiles([editFile]);
      if (editingResource.type !== "PDF" && !/^https?:\/\//i.test(form.linkText.trim())) {
        return isFa ? "لینک معتبر با http یا https وارد کنید." : "Enter a valid http(s) link.";
      }
      return "";
    }

    if (!form.pdfFiles.length && !links.length) {
      return isFa ? "حداقل یک PDF یا لینک اضافه کنید." : "Add at least one PDF or link.";
    }

    const pdfError = validatePdfFiles(form.pdfFiles);
    if (pdfError) return pdfError;

    if (form.linkText.trim() && !links.length) {
      return isFa ? "لینک معتبر با http یا https وارد کنید." : "Enter a valid http(s) link.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError("");
      const module = form.module.trim();
      const title = (
        form.title ||
        selectedSession?.title ||
        module ||
        selectedCourse?.title ||
        "Course content"
      ).trim();

      if (editingResource) {
        const resourceId = getResourceId(editingResource);
        if (!resourceId) {
          setError(isFa ? "شناسه محتوا معتبر نیست. صفحه را تازه‌سازی کنید." : "Invalid resource id. Please refresh the page.");
          return;
        }
        const payload = {
          title,
          module,
          sessionId: selectedSessionId,
          type: editingResource.type === "PDF" ? "PDF" : "Link",
          url: editingResource.type === "PDF" ? "" : form.linkText.trim(),
          resourceFile: editingResource.type === "PDF" ? editFile : null,
        };
        await updateTeacherCourseResource(selectedCourseId, resourceId, payload);
      } else {
        for (let index = 0; index < form.pdfFiles.length; index += 1) {
          const file = form.pdfFiles[index];
          await createTeacherCourseResource(selectedCourseId, {
            title: makePdfTitle(title, file, index),
            module,
            sessionId: selectedSessionId,
            type: "PDF",
            url: "",
            resourceFile: file,
          });
        }

        const links = parseLinks(form.linkText);
        for (let index = 0; index < links.length; index += 1) {
          const link = links[index];
          await createTeacherCourseResource(selectedCourseId, {
            title: makeLinkTitle(title, link, index),
            module,
            sessionId: selectedSessionId,
            type: "Link",
            url: link,
            resourceFile: null,
          });
        }
      }

      window.dispatchEvent(new Event("edutech_data_changed"));
      clearTeacherFormDraft(resourceDraftId);
      resetForm();
      await loadResources(selectedCourseId);
    } catch (err) {
      setError(err?.message || (isFa ? "ذخیره محتوا ناموفق بود." : "Failed to save content."));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (resource) => {
    setEditingResource(resource);
    setSelectedSessionId(resource.sessionId || "");
    setEditFile(null);
    setForm({
      title: resource.title || "",
      module: resource.module || resource.description || "",
      linkText: resource.type === "PDF" ? "" : resource.url || "",
      pdfFiles: [],
    });
    setError("");
  };

  const handleDelete = async (resource) => {
    const resourceId = getResourceId(resource);
    if (!resourceId) {
      setError(isFa ? "شناسه محتوا معتبر نیست. صفحه را تازه‌سازی کنید." : "Invalid resource id. Please refresh the page.");
      return;
    }
    const confirmed = window.confirm(
      isFa
        ? "این منبع درسی برای همیشه حذف شود؟"
        : "Permanently delete this course resource?",
    );
    if (!confirmed) return;

    try {
      setError("");
      await deleteTeacherCourseResource(selectedCourseId, resourceId);
      window.dispatchEvent(new Event("edutech_data_changed"));
      await loadResources(selectedCourseId);
      if (getResourceId(editingResource) === resourceId) resetForm();
    } catch (err) {
      setError(err?.message || (isFa ? "حذف محتوا ناموفق بود." : "Failed to delete content."));
    }
  };

  const handleFileChange = (files) => {
    const nextFiles = Array.from(files || []);
    const validationError = validatePdfFiles(nextFiles);
    if (validationError) {
      setError(validationError);
      setForm({ ...form, pdfFiles: [] });
      return;
    }
    setError("");
    setForm({ ...form, pdfFiles: nextFiles });
  };

  const currentCoursePage = Number(coursePagination.page || 1);
  const courseLimit = Number(coursePagination.limit || COURSES_PER_PAGE);
  const courseTotal = Number(coursePagination.total || courses.length);
  const courseTotalPages = Math.max(1, Number(coursePagination.totalPages || 1));
  const courseStartIndex = courseTotal && courses.length ? (currentCoursePage - 1) * courseLimit + 1 : 0;
  const courseEndIndex = courseTotal && courses.length
    ? Math.min(courseStartIndex + courses.length - 1, courseTotal)
    : 0;
  const showCoursePagination = courseTotalPages > 1;
  const coursePageNumbers = Array.from({ length: courseTotalPages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === courseTotalPages || Math.abs(page - currentCoursePage) <= 1,
  );

  const courseGrid = (
    <section className={`space-y-5 ${isRTL ? "text-right" : "text-left"}`}>
      <header className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black text-[#0F172A]">{labels.chooseCourseTitle}</h1>
        <p className="mt-2 text-sm font-medium leading-7 text-slate-600">{labels.chooseCourseSubtitle}</p>
      </header>

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</p> : null}

      {loadingCourses ? (
        <TeacherPageLoader label={labels.loading} />
      ) : courses.length ? (
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => {
              const courseId = getCourseId(course);
              const thumbnail = resolveMediaUrl(course.thumbnail);
              return (
                <button
                  key={courseId}
                  type="button"
                  onClick={() => selectCourse(course)}
                  className="group rounded-2xl border border-[#E2E8F0] bg-white p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-[#0B4FD8]/40 hover:shadow-xl"
                >
                  <div className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-teal-700">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={course.title}
                        className="h-full w-full bg-slate-50 object-contain transition duration-300 group-hover:scale-[1.01]"
                        loading="lazy"
                      />
                    ) : (
                      <BookOpen size={28} className="text-white/85" />
                    )}
                  </div>
                  <h2 className="mt-3 line-clamp-2 text-base font-black text-[#0F172A]">{course.title}</h2>
                </button>
              );
            })}
          </div>

          <div className={`mt-5 flex flex-wrap items-center gap-3 border-t border-[#E2E8F0] pt-4 text-sm text-slate-600 ${
            showCoursePagination ? "justify-between" : "justify-center"
          }`}>
            <p className="text-center">
              {isFa
                ? `نمایش ${courseStartIndex} تا ${courseEndIndex} از ${courseTotal} کورس`
                : `Showing ${courseStartIndex} to ${courseEndIndex} of ${courseTotal} courses`}
            </p>
            {showCoursePagination ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentCoursePage <= 1}
                  onClick={() => setCoursePage(Math.max(1, currentCoursePage - 1))}
                  className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {labels.previous}
                </button>
                {coursePageNumbers.map((item, index) => {
                  const previous = coursePageNumbers[index - 1];
                  const showGap = previous && item - previous > 1;

                  return (
                    <span key={item} className="flex items-center gap-2">
                      {showGap ? <span className="text-xs font-bold text-slate-400">...</span> : null}
                      <button
                        type="button"
                        onClick={() => setCoursePage(item)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                          item === currentCoursePage
                            ? "bg-[#0B4FD8]/10 text-[#0B4FD8]"
                            : "border border-[#E2E8F0] hover:bg-slate-50"
                        }`}
                      >
                        {item}
                      </button>
                    </span>
                  );
                })}
                <button
                  type="button"
                  disabled={currentCoursePage >= courseTotalPages}
                  onClick={() => setCoursePage(Math.min(courseTotalPages, currentCoursePage + 1))}
                  className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {labels.next}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-10 text-center text-sm font-bold text-amber-600 shadow-sm">
          {labels.noCourses}
        </div>
      )}
    </section>
  );

  return (
    <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
      {!selectedCourseId ? courseGrid : (
        <section className={`space-y-5 ${isRTL ? "text-right" : "text-left"}`}>
          <header className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <button
                  type="button"
                  onClick={clearCourseSelection}
                  className="mb-3 inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-black text-slate-600 hover:border-[#0B4FD8] hover:text-[#0B4FD8]"
                >
                  {isRTL ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
                  {labels.backToCourses}
                </button>
                <p className="text-xs font-extrabold text-slate-500">{labels.title}</p>
                <div className="mt-2 flex items-center gap-2">
                  <BookOpen size={22} className="text-[#0B4FD8]" />
                  <h1 className="text-2xl font-black text-[#0F172A]">{selectedCourse?.title || labels.selectCourse}</h1>
                </div>
                <p className="mt-2 max-w-4xl text-sm font-medium leading-7 text-slate-600">{labels.subtitle}</p>
              </div>
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm font-black text-slate-700">
                {labels.used}: {bytesToMb(existingPdfTotal)} / 25MB
              </div>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-black text-slate-600">{labels.session}</span>
                {sessions.length || loadingSessions ? (
                  <select
                    value={selectedSessionId}
                    onChange={(event) => applySessionToForm(event.target.value)}
                    disabled={loadingSessions || saving}
                    className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold outline-none focus:border-[#0B4FD8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">{loadingSessions ? labels.loading : labels.selectSession}</option>
                    {sessions.map((session) => (
                      <option key={getSessionId(session)} value={getSessionId(session)}>
                        {session.title} · {formatDateTimeRange(session.startAt, session.endAt, locale)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex min-h-11 items-center rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-bold text-amber-700">
                    {labels.noSessions}
                  </div>
                )}
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black text-slate-600">
                  {editingResource?.type === "PDF" ? labels.replacePdf : labels.pdf}
                </span>
                <div className="flex min-h-11 cursor-pointer items-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-3 text-sm font-semibold text-slate-600">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple={!editingResource}
                    disabled={saving || formLockedBySession || (editingResource && editingResource.type !== "PDF")}
                    className="w-full cursor-pointer text-xs font-bold file:mr-3 file:rounded-lg file:border-0 file:bg-[#0B4FD8] file:px-3 file:py-2 file:text-xs file:font-black file:text-white disabled:cursor-not-allowed"
                    onChange={(event) => {
                      if (editingResource) {
                        const nextFile = event.target.files?.[0] || null;
                        const validationError = nextFile ? validatePdfFiles([nextFile]) : "";
                        if (validationError) {
                          setError(validationError);
                          setEditFile(null);
                          event.target.value = "";
                          return;
                        }
                        setError("");
                        setEditFile(nextFile);
                        return;
                      }
                      handleFileChange(event.target.files);
                    }}
                  />
                </div>
                {!editingResource && form.pdfFiles.length ? (
                  <p className="text-xs font-bold text-slate-500">
                    {form.pdfFiles.length} PDF · {bytesToMb(selectedPdfTotal)}
                  </p>
                ) : null}
                {editingResource?.type === "PDF" && editFile ? (
                  <p className="text-xs font-bold text-slate-500">{editFile.name} · {bytesToMb(editFile.size)}</p>
                ) : null}
              </label>
              <label className="space-y-2 lg:col-span-2">
                <span className="text-xs font-black text-slate-600">{labels.links}</span>
                <textarea
                  value={form.linkText}
                  onChange={(event) => setForm({ ...form, linkText: event.target.value })}
                  placeholder={labels.linksHint}
                  disabled={saving || formLockedBySession || (editingResource && editingResource.type === "PDF")}
                  rows={4}
                  className={`w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold outline-none focus:border-[#0B4FD8] disabled:cursor-not-allowed disabled:opacity-60 ${isRTL ? "text-right placeholder:text-right" : "text-left placeholder:text-left"}`}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button disabled={saving || !selectedCourseId || formLockedBySession} type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9] px-5 text-sm font-bold text-white disabled:opacity-60">
                <Plus size={16} />
                {labels.add}
              </button>
              {editingResource ? (
                <button type="button" onClick={resetForm} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E2E8F0] px-4 text-xs font-black text-slate-600 hover:text-[#0B4FD8]">
                  <X size={14} />
                  {labels.cancel}
                </button>
              ) : null}
            </div>
            {error ? <p className="mt-3 text-sm font-bold text-rose-600">{error}</p> : null}
          </form>

          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-[#0F172A]">{labels.list}</h2>
            <div className="mt-4 space-y-3">
              {groupedResources.map((group) => {
                return (
                  <div key={group.key} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0B4FD8]/10 text-[#0B4FD8]">
                          <BookOpen size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#0F172A]">{group.title}</p>
                          <p className="text-xs font-semibold text-slate-500">
                            {group.items.length} {isFa ? "مورد محتوا" : "content items"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {group.items.map((item) => {
                        const Icon = getTypeIcon(item.type);
                        const resourceId = getResourceId(item);
                        return (
                          <div key={resourceId || item.id || item.title} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-[#0B4FD8]">
                                <Icon size={16} />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-[#0F172A]">{item.title}</p>
                                <p className="text-xs font-semibold text-slate-500">
                                  {item.type} · {item.size || "-"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => handleEdit(item)} className="rounded-lg border border-[#E2E8F0] p-2 text-slate-600 hover:bg-white hover:text-[#0B4FD8]">
                                <Edit3 size={15} />
                              </button>
                              <button type="button" onClick={() => handleDelete(item)} className="rounded-lg border border-red-200 p-2 text-[#EF4444] hover:bg-red-50">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {!resources.length && !loadingResources ? (
                <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center text-sm font-semibold text-slate-500">
                  {labels.empty}
                </div>
              ) : null}
              {loadingResources ? (
                <TeacherPageLoader label={labels.loading} minHeight="min-h-[220px]" />
              ) : null}
            </div>
          </section>
        </section>
      )}
    </TeacherLayout>
  );
}
