import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  GraduationCap,
  Plus,
  Search,
  SquarePen,
  Trash2,
  UserCheck,
  UserRound,
  UserX,
  X,
} from "lucide-react";
import { useSearchParams } from "react-router";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import useLatestRequest from "../hooks/useLatestRequest.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";
import {
  clearAdminPageCache,
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";

const PAGE_SIZE = 30;
const ADMIN_STUDENTS_CACHE_TTL_MS = 5 * 60 * 1000;
const ADMIN_STUDENTS_STATS_CACHE_KEY = getAdminPageCacheKey("students-stats");
const getAdminStudentsListCacheKey = ({ page, search, statusFilter }) =>
  getAdminPageCacheKey("students-list", {
    page,
    search,
    statusFilter,
  });
const getAdminStudentDetailsCacheKey = (studentId) =>
  getAdminPageCacheKey("student-details", { studentId });

const PAGE_TEXT = {
  "Student operations": "عملیات شاگردان",
  "Track student accounts, account health, enrollments, and direct actions from one clear workspace.":
    "حساب‌های شاگردان، وضعیت حساب، ثبت‌نام‌ها و اقدام‌های مستقیم را از یک فضای کاری روشن مدیریت کنید.",
  "Total students": "مجموع شاگردان",
  "Active students": "شاگردان فعال",
  "Pending verification": "در انتظار تایید",
  "Blocked students": "شاگردان مسدود",
  "Students on this page": "شاگردان این صفحه",
  "All student accounts in the platform": "همه حساب‌های شاگردان در پلتفرم",
  "Students with access and active status": "شاگردانی که دسترسی و وضعیت فعال دارند",
  "Students still waiting for account verification": "شاگردانی که هنوز منتظر تایید حساب هستند",
  "Students blocked by the system": "شاگردانی که توسط سیستم مسدود شده‌اند",
  "Students matching current filters": "شاگردانی که با فیلتر فعلی هم‌خوانی دارند",
  "Student directory": "فهرست شاگردان",
  "Search by name, email, or phone and manage each student from one table.":
    "با نام، ایمیل یا شماره تماس جستجو کنید و هر شاگرد را از یک جدول مدیریت کنید.",
  "Search name, email, or phone": "جستجوی نام، ایمیل یا شماره تماس",
  "All statuses": "همه وضعیت‌ها",
  "Add student": "افزودن شاگرد",
  Student: "شاگرد",
  "Phone number": "شماره تماس",
  Location: "موقعیت",
  Learning: "یادگیری",
  Status: "وضعیت",
  Joined: "تاریخ عضویت",
  Actions: "اقدام‌ها",
  Active: "فعال",
  Blocked: "مسدود",
  Unknown: "نامشخص",
  "No students found for the current filters.": "برای فیلترهای فعلی شاگردی پیدا نشد.",
  "Loading students": "در حال بارگذاری شاگردان",
  "Active courses": "کورس‌های فعال",
  "Total enrollments": "کل ثبت‌نام‌ها",
  "Last enrollment": "آخرین ثبت‌نام",
  "Never enrolled": "هنوز ثبت‌نام نکرده",
  "View details": "مشاهده جزئیات",
  "Edit student": "ویرایش شاگرد",
  "Block student": "مسدود کردن شاگرد",
  "Activate student": "فعال‌سازی شاگرد",
  "Delete student": "حذف شاگرد",
  "Create student": "ایجاد شاگرد",
  Name: "نام",
  Email: "ایمیل",
  Phone: "شماره تماس",
  Password: "رمز عبور",
  Cancel: "انصراف",
  Create: "ایجاد",
  Save: "ذخیره",
  "Create a student account that can sign in immediately.":
    "یک حساب شاگرد ایجاد کنید که فوراً بتواند وارد شود.",
  "Update core student information and account status.":
    "اطلاعات اصلی شاگرد و وضعیت حساب را به‌روزرسانی کنید.",
  "Student details": "جزئیات شاگرد",
  "Account overview": "نمای کلی حساب",
  "Enrollment snapshot": "خلاصه ثبت‌نام",
  "Recent courses": "کورس‌های اخیر",
  "Personal info": "اطلاعات شخصی",
  Country: "کشور",
  City: "شهر",
  Address: "آدرس",
  Language: "زبان",
  Gender: "جنسیت",
  "Birth date": "تاریخ تولد",
  "Parent phone": "شماره والد",
  "Emergency contact": "تماس اضطراری",
  Role: "نقش",
  "Paid payments": "پرداخت‌های موفق",
  Completed: "تکمیل‌شده",
  Pending: "در انتظار",
  "No recent courses yet.": "هنوز کورس اخیری وجود ندارد.",
  Monthly: "ماهانه",
  "Whole period": "تمام دوره",
  Allowed: "مجاز",
  "Access blocked": "دسترسی مسدود",
  "Student created successfully.": "شاگرد با موفقیت ایجاد شد.",
  "Student updated successfully.": "شاگرد با موفقیت به‌روزرسانی شد.",
  "Student status updated successfully.": "وضعیت شاگرد با موفقیت به‌روزرسانی شد.",
  "Student deleted successfully.": "شاگرد با موفقیت حذف شد.",
  "Failed to fetch students list.": "گرفتن فهرست شاگردان ناموفق بود.",
  "Failed to fetch students stats": "گرفتن آمار شاگردان ناموفق بود",
  "Failed to fetch student details": "گرفتن جزئیات شاگرد ناموفق بود",
  "Unable to open student details": "باز کردن جزئیات شاگرد ممکن نشد",
  "Unable to update student status": "به‌روزرسانی وضعیت شاگرد ممکن نشد",
  "Unable to delete student": "حذف شاگرد ممکن نشد",
  "Unable to create student": "ایجاد شاگرد ممکن نشد",
  "Unable to update student": "به‌روزرسانی شاگرد ممکن نشد",
  "Name, email, phone, and password are required.": "نام، ایمیل، شماره تماس و رمز عبور الزامی است.",
  "Name and email are required.": "نام و ایمیل الزامی است.",
  "Student details not found": "جزئیات شاگرد پیدا نشد",
  "This action cannot be undone.": "این عمل قابل بازگشت نیست.",
  Showing: "نمایش",
  to: "تا",
  of: "از",
};

const FALLBACK_STATS = {
  totalStudents: 0,
  activeStudents: 0,
  pendingStudents: 0,
  blockedStudents: 0,
};

const translateText = (text, language) => {
  if (language !== "fa") return text;
  return PAGE_TEXT[text] || text;
};

const formatNumber = (value, language = "en") =>
  new Intl.NumberFormat(language === "fa" ? "fa-AF" : "en-US").format(Number(value || 0));

const formatDate = (value, language = "en") => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  if (language === "fa") {
    return new Intl.DateTimeFormat("fa-AF-u-ca-persian", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
};

const mapApiStatusToLabel = (status, pageTr) => {
  if (status === "active") return pageTr("Active");
  if (status === "blocked") return pageTr("Blocked");
  return pageTr("Pending verification");
};

const getStatusStyle = (status) => {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "blocked") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
};

const getPaginationItems = (currentPage, totalPages) => {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 3) return [1, 2, 3, "...", totalPages];
  if (currentPage >= totalPages - 2) return [1, "...", totalPages - 2, totalPages - 1, totalPages];
  return [1, "...", currentPage, "...", totalPages];
};

const resolvePaymentPlanLabel = (value, pageTr) =>
  String(value || "").toLowerCase() === "whole_period" ? pageTr("Whole period") : pageTr("Monthly");

export default function AdminStudentsPage() {
  const { t, language, isRTL } = useAdminI18n();
  const pageTr = useCallback((text) => translateText(t(text), language), [t, language]);
  const [searchParams] = useSearchParams();
  const requestedSearch = searchParams.get("q") || "";
  const [statsData, setStatsData] = useState(FALLBACK_STATS);
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchText, setSearchText] = useState(requestedSearch);
  const debouncedSearch = useDebouncedValue(searchText.trim(), 350);
  const [statusFilter, setStatusFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    totalUsers: 0,
    totalPages: 1,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchText(requestedSearch);
      setPage(1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [requestedSearch]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [modalError, setModalError] = useState("");
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    status: "active",
    isEmailVerified: true,
  });
  const statsRequest = useLatestRequest();
  const studentsRequest = useLatestRequest();
  const lastStatsRequestKeyRef = useRef("");
  const lastStudentsRequestKeyRef = useRef("");

  useEffect(() => {
    const fetchStudentsStats = async () => {
      const cached = readAdminPageCache(ADMIN_STUDENTS_STATS_CACHE_KEY, {
        maxAgeMs: ADMIN_STUDENTS_CACHE_TTL_MS,
      });
      if (cached) {
        setStatsData(cached);
        if (refreshKey === 0) {
          return;
        }
      }

      const requestKey = `students-stats:${refreshKey}`;
      if (lastStatsRequestKeyRef.current === requestKey) {
        return;
      }
      lastStatsRequestKeyRef.current = requestKey;

      await statsRequest.runLatest(async () => {
        const apiUrl = getApiBase();
        const requestConfig = {
          headers: buildAuthHeaders(),
        };

        const [dashboardRes, blockedRes] = await Promise.all([
          fetch(`${apiUrl}/admin/dashboard`, requestConfig),
          fetch(`${apiUrl}/admin/users?role=student&status=blocked&page=1&limit=1`, requestConfig),
        ]);

        if (!dashboardRes.ok || !blockedRes.ok) {
          throw new Error(pageTr("Failed to fetch students stats"));
        }

        return Promise.all([dashboardRes.json(), blockedRes.json()]);
      }, {
        onSuccess: ([dashboardData, blockedData]) => {
          const nextStats = {
            totalStudents: Number(dashboardData?.stats?.totalStudents) || 0,
            activeStudents: Number(dashboardData?.stats?.activeStudents) || 0,
            pendingStudents: Number(dashboardData?.stats?.pendingStudents) || 0,
            blockedStudents: Number(blockedData?.pagination?.totalUsers) || 0,
          };
          setStatsData(nextStats);
          writeAdminPageCache(ADMIN_STUDENTS_STATS_CACHE_KEY, nextStats);
        },
        onError: (error) => {
          console.error("Error fetching students stats:", error);
        },
      });
    };

    fetchStudentsStats();
  }, [pageTr, refreshKey, statsRequest]);

  useEffect(() => {
    const fetchStudents = async () => {
      const cacheKey = getAdminStudentsListCacheKey({
        page,
        search: debouncedSearch,
        statusFilter,
      });

      const cached = readAdminPageCache(cacheKey, {
        maxAgeMs: ADMIN_STUDENTS_CACHE_TTL_MS,
      });
      const hasCachedRows = Boolean(cached);
      if (cached) {
        setStudents(Array.isArray(cached.students) ? cached.students : []);
        setPagination(cached.pagination || { page: 1, limit: PAGE_SIZE, totalUsers: 0, totalPages: 1 });
        setIsLoading(false);
        setErrorMessage("");
        if (refreshKey === 0) {
          return;
        }
      } else {
        setIsLoading(true);
        setErrorMessage("");
      }

      const requestKey = JSON.stringify({
        page,
        search: debouncedSearch,
        statusFilter,
        refreshKey,
        language,
      });
      if (lastStudentsRequestKeyRef.current === requestKey) {
        return;
      }
      lastStudentsRequestKeyRef.current = requestKey;

      await studentsRequest.runLatest(async () => {
        const apiUrl = getApiBase();
        const query = new URLSearchParams({
          role: "student",
          page: String(page),
          limit: String(PAGE_SIZE),
        });

        if (statusFilter !== "all") query.set("status", statusFilter);
        if (debouncedSearch) query.set("search", debouncedSearch);

        const response = await fetch(`${apiUrl}/admin/users?${query.toString()}`, {
          headers: buildAuthHeaders(),
        });

        return parseJsonResponse(response);
      }, {
        onSuccess: (data) => {
          const mappedStudents = (data?.users || []).map((student) => {
            const emailPrefix = student?.email?.split("@")[0] || "student";
            return {
              id: student?._id,
              name: student?.name || "-",
              username: student?.username ? `@${student.username}` : `@${emailPrefix}`,
              email: student?.email || "-",
              phone: student?.phone || "-",
              country: student?.country || "",
              city: student?.city || "",
              apiStatus: student?.status || "pending_verification",
              statusLabel: mapApiStatusToLabel(student?.status, pageTr),
              isEmailVerified: Boolean(student?.isEmailVerified),
              joinedAt: student?.createdAt || null,
              joinedLabel: formatDate(student?.createdAt, language),
              activeCoursesCount: Number(student?.studentMetrics?.activeCoursesCount || 0),
              totalEnrollmentsCount: Number(student?.studentMetrics?.totalEnrollmentsCount || 0),
              lastEnrollmentAt: student?.studentMetrics?.lastEnrollmentAt || null,
            };
          });

          const nextPagination = {
            page: Number(data?.pagination?.page) || 1,
            limit: Number(data?.pagination?.limit) || PAGE_SIZE,
            totalUsers: Number(data?.pagination?.totalUsers) || 0,
            totalPages: Number(data?.pagination?.totalPages) || 1,
          };

          setStudents(mappedStudents);
          setPagination(nextPagination);
          writeAdminPageCache(cacheKey, {
            students: mappedStudents,
            pagination: nextPagination,
          });
        },
        onError: (error) => {
          console.error("Error fetching students:", error);
          if (!hasCachedRows) {
            setStudents([]);
            setPagination({ page: 1, limit: PAGE_SIZE, totalUsers: 0, totalPages: 1 });
          }
          setErrorMessage(error.message || pageTr("Failed to fetch students list."));
        },
        onFinally: () => setIsLoading(false),
      });
    };

    fetchStudents();
  }, [debouncedSearch, language, page, pageTr, statusFilter, studentsRequest, refreshKey]);

  const resetStudentForm = () => {
    setStudentForm({
      name: "",
      email: "",
      phone: "",
      password: "",
      status: "active",
      isEmailVerified: true,
    });
  };

  const loadStudentDetails = async (studentId) => {
    const cacheKey = getAdminStudentDetailsCacheKey(studentId);
    const cached = readAdminPageCache(cacheKey, {
      maxAgeMs: ADMIN_STUDENTS_CACHE_TTL_MS,
    });
    if (cached) return cached;

    const apiUrl = getApiBase();
    const response = await fetch(`${apiUrl}/admin/users/${studentId}`, {
      headers: buildAuthHeaders(),
    });
    const data = await parseJsonResponse(response);
    const payload = {
      ...(data?.user || {}),
      studentInsights: data?.studentInsights || null,
    };
    writeAdminPageCache(cacheKey, payload);
    return payload;
  };

  const handleViewStudent = async (studentId) => {
    try {
      setActionLoadingId(studentId);
      const user = await loadStudentDetails(studentId);
      if (!user?._id) throw new Error(pageTr("Student details not found"));
      setSelectedStudent(user);
      setIsDetailsOpen(true);
    } catch (error) {
      window.alert(error.message || pageTr("Unable to open student details"));
    } finally {
      setActionLoadingId("");
    }
  };

  const handleToggleStudentStatus = async (student) => {
    const nextStatus = student.apiStatus === "blocked" ? "active" : "blocked";
    const confirmed = window.confirm(
      nextStatus === "blocked"
        ? `${pageTr("Block student")}: ${student.name}?`
        : `${pageTr("Activate student")}: ${student.name}?`,
    );
    if (!confirmed) return;

    try {
      setActionLoadingId(student.id);
      const apiUrl = getApiBase();
      const response = await fetch(`${apiUrl}/admin/users/${student.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(),
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      await parseJsonResponse(response);
      clearAdminPageCache("admin:students");
      setSelectedStudent((prev) => (prev?._id === student.id ? { ...prev, status: nextStatus } : prev));
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      window.alert(error.message || pageTr("Unable to update student status"));
    } finally {
      setActionLoadingId("");
    }
  };

  const handleDeleteStudent = async (student) => {
    const confirmed = window.confirm(
      `${pageTr("Delete student")}: ${student.name}? ${pageTr("This action cannot be undone.")}`,
    );
    if (!confirmed) return;

    try {
      setActionLoadingId(student.id);
      const apiUrl = getApiBase();
      const response = await fetch(`${apiUrl}/admin/users/${student.id}`, {
        method: "DELETE",
        headers: buildAuthHeaders(),
      });
      await parseJsonResponse(response);
      clearAdminPageCache("admin:students");
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      window.alert(error.message || pageTr("Unable to delete student"));
    } finally {
      setActionLoadingId("");
    }
  };

  const openCreateModal = () => {
    resetStudentForm();
    setEditingStudent(null);
    setModalError("");
    setIsCreateModalOpen(true);
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setStudentForm({
      name: student.name || "",
      email: student.email || "",
      phone: student.phone || "",
      password: "",
      status: student.apiStatus || "active",
      isEmailVerified: Boolean(student.isEmailVerified),
    });
    setModalError("");
    setIsEditModalOpen(true);
  };

  const handleCreateStudent = async (event) => {
    event.preventDefault();
    if (
      !studentForm.name.trim() ||
      !studentForm.email.trim() ||
      !studentForm.phone.trim() ||
      !studentForm.password.trim()
    ) {
      setModalError(pageTr("Name, email, phone, and password are required."));
      return;
    }

    setIsSavingStudent(true);
    setModalError("");

    try {
      const apiUrl = getApiBase();
      const response = await fetch(`${apiUrl}/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(),
        },
        body: JSON.stringify({
          name: studentForm.name.trim(),
          email: studentForm.email.trim().toLowerCase(),
          phone: studentForm.phone.trim(),
          password: studentForm.password,
          role: "student",
          status: studentForm.status,
          isEmailVerified: studentForm.isEmailVerified,
        }),
      });
      await parseJsonResponse(response);
      setIsCreateModalOpen(false);
      resetStudentForm();
      clearAdminPageCache("admin:students");
      setRefreshKey((prev) => prev + 1);
      setPage(1);
    } catch (error) {
      setModalError(error.message || pageTr("Unable to create student"));
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleEditStudent = async (event) => {
    event.preventDefault();
    if (!editingStudent?.id) {
      setModalError(pageTr("Student details not found"));
      return;
    }
    if (!studentForm.name.trim() || !studentForm.email.trim()) {
      setModalError(pageTr("Name and email are required."));
      return;
    }

    setIsSavingStudent(true);
    setModalError("");

    try {
      const apiUrl = getApiBase();
      const response = await fetch(`${apiUrl}/admin/users/${editingStudent.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(),
        },
        body: JSON.stringify({
          name: studentForm.name.trim(),
          email: studentForm.email.trim().toLowerCase(),
          phone: studentForm.phone.trim(),
          status: studentForm.status,
          isEmailVerified: studentForm.isEmailVerified,
        }),
      });
      await parseJsonResponse(response);
      setIsEditModalOpen(false);
      setEditingStudent(null);
      clearAdminPageCache("admin:students");
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      setModalError(error.message || pageTr("Unable to update student"));
    } finally {
      setIsSavingStudent(false);
    }
  };

  const statsCards = useMemo(() => {
    return [
      {
        title: pageTr("Total students"),
        value: formatNumber(statsData.totalStudents, language),
        icon: UserRound,
        tone: "bg-blue-50 text-blue-700",
      },
      {
        title: pageTr("Active students"),
        value: formatNumber(statsData.activeStudents, language),
        icon: GraduationCap,
        tone: "bg-emerald-50 text-emerald-700",
      },
      {
        title: pageTr("Blocked students"),
        value: formatNumber(statsData.blockedStudents, language),
        icon: UserX,
        tone: "bg-rose-50 text-rose-700",
      },
    ];
  }, [language, pageTr, statsData]);

  const paginationItems = getPaginationItems(pagination.page, pagination.totalPages);
  const startItem = pagination.totalUsers === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.totalUsers);

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={`w-full max-w-full overflow-x-hidden space-y-6 ${isRTL ? "text-right" : "text-left"}`}
    >
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-600">{pageTr("Student operations")}</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-800">{t("pages.students.title")}</h1>
            <p className="mt-2 max-w-3xl text-sm font-normal leading-7 text-slate-600">
              {pageTr("Track student accounts, account health, enrollments, and direct actions from one clear workspace.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-blue-50"
            >
              <Plus size={16} />
              {pageTr("Add student")}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-nowrap gap-4">
        {statsCards.map((card) => (
          <article key={card.title} className="min-w-0 flex-1 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
              <card.icon size={22} />
            </div>
            <p className="mt-4 text-sm font-bold text-slate-700">{card.title}</p>
            <p className="mt-2 text-2xl font-extrabold text-slate-800">{card.value}</p>
          </article>
        ))}
      </div>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">{pageTr("Student directory")}</h2>
            <p className="mt-1 text-sm font-normal text-slate-600">
              {pageTr("Search by name, email, or phone and manage each student from one table.")}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(180px,0.4fr))]">
          <label className="relative block">
            <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-slate-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setPage(1);
              }}
              placeholder={pageTr("Search name, email, or phone")}
              className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-11 pe-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
          >
            <option value="all">{pageTr("All statuses")}</option>
            <option value="active">{pageTr("Active")}</option>
            <option value="blocked">{pageTr("Blocked")}</option>
          </select>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
          {errorMessage}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-700">
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Student")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Phone number")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Email")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Location")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Status")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Joined")}</th>
                <th className="px-5 py-4 text-center font-bold text-slate-500">{pageTr("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-6">
                    <AdminPageLoader
                      label={pageTr("Loading students")}
                      minHeight="min-h-[160px]"
                      className="border-0 bg-transparent p-0"
                    />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center font-bold text-slate-900">
                    {pageTr("No students found for the current filters.")}
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="align-middle transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 font-bold text-slate-700">
                          {(student.name || "-").trim().charAt(0) || "-"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-800">{student.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <p className="whitespace-nowrap font-semibold text-slate-700" dir="ltr">{student.phone}</p>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <p className="truncate whitespace-nowrap font-semibold text-slate-700" dir="ltr">{student.email}</p>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex min-h-[44px] flex-col justify-center">
                        <p className="truncate whitespace-nowrap font-semibold leading-5 text-slate-700">
                          {student.country || pageTr("Unknown")}
                        </p>
                        {student.city ? (
                          <p className="mt-1 truncate whitespace-nowrap text-xs font-semibold leading-4 text-slate-500">
                            {student.city}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-black ${getStatusStyle(student.apiStatus)}`}>
                        {student.statusLabel}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle font-semibold text-slate-600">
                      <span className="whitespace-nowrap">{student.joinedLabel}</span>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewStudent(student.id)}
                          disabled={actionLoadingId === student.id}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title={pageTr("View details")}
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(student)}
                          disabled={actionLoadingId === student.id}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-violet-50 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title={pageTr("Edit student")}
                        >
                          <SquarePen size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStudentStatus(student)}
                          disabled={actionLoadingId === student.id}
                          className={`rounded-xl p-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            student.apiStatus === "blocked"
                              ? "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                              : "text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                          }`}
                          title={student.apiStatus === "blocked" ? pageTr("Activate student") : pageTr("Block student")}
                        >
                          {student.apiStatus === "blocked" ? <UserCheck size={18} /> : <UserX size={18} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(student)}
                          disabled={actionLoadingId === student.id}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title={pageTr("Delete student")}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-700">
            {pageTr("Showing")} <span className="text-slate-950">{formatNumber(startItem, language)}</span> {pageTr("to")}{" "}
            <span className="text-slate-950">{formatNumber(endItem, language)}</span> {pageTr("of")}{" "}
            <span className="text-slate-950">{formatNumber(pagination.totalUsers, language)}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition enabled:hover:bg-slate-50 enabled:hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRTL ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            {paginationItems.map((pageItem, idx) =>
              pageItem === "..." ? (
                <span key={`dots-${idx}`} className="px-2 text-sm font-bold text-slate-400">...</span>
              ) : (
                <button
                  key={`page-${pageItem}`}
                  type="button"
                  onClick={() => setPage(Number(pageItem))}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black transition ${
                    Number(pageItem) === pagination.page
                      ? "bg-primary-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {formatNumber(pageItem, language)}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition enabled:hover:bg-slate-50 enabled:hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRTL ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        </div>
      </section>

      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">
                  {isCreateModalOpen ? pageTr("Create student") : pageTr("Edit student")}
                </p>
                <h3 className="mt-2 text-xl font-extrabold text-slate-800">
                  {isCreateModalOpen ? pageTr("Create student") : pageTr("Edit student")}
                </h3>
                <p className="mt-1 text-sm font-normal text-slate-600">
                  {isCreateModalOpen
                    ? pageTr("Create a student account that can sign in immediately.")
                    : pageTr("Update core student information and account status.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                  setEditingStudent(null);
                  setModalError("");
                }}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={isCreateModalOpen ? handleCreateStudent : handleEditStudent} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Name")}</span>
                  <input
                    type="text"
                    value={studentForm.name}
                    onChange={(event) => setStudentForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Phone")}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={studentForm.phone}
                    onChange={(event) => setStudentForm((prev) => ({ ...prev, phone: event.target.value }))}
                    className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Email")}</span>
                <input
                  type="email"
                  dir="ltr"
                  value={studentForm.email}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                />
              </label>

              {isCreateModalOpen ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Password")}</span>
                  <input
                    type="password"
                    dir="ltr"
                    value={studentForm.password}
                    onChange={(event) => setStudentForm((prev) => ({ ...prev, password: event.target.value }))}
                    className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                  />
                </label>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Status")}</span>
                  <select
                    value={studentForm.status}
                    onChange={(event) => setStudentForm((prev) => ({ ...prev, status: event.target.value }))}
                    className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                  >
                    <option value="active">{pageTr("Active")}</option>
                    <option value="blocked">{pageTr("Blocked")}</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={studentForm.isEmailVerified}
                    onChange={(event) => setStudentForm((prev) => ({ ...prev, isEmailVerified: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-bold text-slate-700">{pageTr("Email verified")}</span>
                </label>
              </div>

              {modalError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
                  {modalError}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                    setEditingStudent(null);
                    setModalError("");
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  {pageTr("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingStudent ? t("common.loading") : isCreateModalOpen ? pageTr("Create") : pageTr("Save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailsOpen && selectedStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-4xl overflow-hidden border border-slate-200 bg-white shadow-2xl">
            <div className="max-h-[90vh] overflow-hidden [direction:ltr]">
              <div className="max-h-[90vh] overflow-y-auto [direction:ltr]">
                <div dir={isRTL ? "rtl" : "ltr"}>
                  <div className="border-b border-slate-200 bg-white">
                <div className="bg-gradient-to-br from-slate-900 via-[#2459c7] to-[#38bdf8] px-6 py-6 text-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-50/80">{pageTr("Student details")}</p>
                      <h3 className="mt-2 truncate text-2xl font-extrabold text-slate-50">{selectedStudent.name || "-"}</h3>
                      <p className="mt-1 truncate text-sm font-normal text-slate-100/85" dir="ltr">{selectedStudent.email || "-"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailsOpen(false);
                        setSelectedStudent(null);
                      }}
                      className="rounded-xl bg-white/10 p-2 text-slate-50 transition hover:bg-white/16"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                  </div>

                  <div className="p-6">
                    <div className="space-y-6">
                  <div className="grid gap-3 md:grid-cols-3">
                    <article className="border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{pageTr("Status")}</p>
                      <p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusStyle(selectedStudent.status)}`}>
                        {mapApiStatusToLabel(selectedStudent.status, pageTr)}
                      </p>
                    </article>
                    <article className="border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{pageTr("Role")}</p>
                      <p className="mt-2 text-sm font-bold text-slate-700">{selectedStudent.role || "-"}</p>
                    </article>
                    <article className="border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{pageTr("Paid payments")}</p>
                      <p className="mt-2 text-sm font-bold text-slate-700">
                        {formatNumber(selectedStudent?.studentInsights?.paidPaymentsCount || 0, language)}
                      </p>
                    </article>
                  </div>

                  <section className="border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-base font-extrabold text-slate-800">{pageTr("Personal info")}</h4>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <InfoRow label={pageTr("Name")} value={selectedStudent.name} />
                      <InfoRow label={pageTr("Phone")} value={selectedStudent.phone} dir="ltr" />
                      <InfoRow label={pageTr("Country")} value={selectedStudent.country} />
                      <InfoRow label={pageTr("City")} value={selectedStudent.city} />
                      <InfoRow label={pageTr("Gender")} value={selectedStudent.gender} />
                    </div>
                    {selectedStudent.address ? (
                      <div className="mt-3">
                        <InfoRow label={pageTr("Address")} value={selectedStudent.address} />
                      </div>
                    ) : null}
                  </section>

                  <section className="border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-base font-extrabold text-slate-800">{pageTr("Enrollment snapshot")}</h4>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {formatNumber(selectedStudent?.studentInsights?.totalEnrollmentsCount || 0, language)}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <StatTile label={pageTr("Total enrollments")} value={formatNumber(selectedStudent?.studentInsights?.totalEnrollmentsCount || 0, language)} tone="blue" />
                      <StatTile label={pageTr("Active courses")} value={formatNumber(selectedStudent?.studentInsights?.activeCoursesCount || 0, language)} tone="emerald" />
                      <StatTile label={pageTr("Completed")} value={formatNumber(selectedStudent?.studentInsights?.completedCoursesCount || 0, language)} tone="violet" />
                      <StatTile label={pageTr("Paid payments")} value={formatNumber(selectedStudent?.studentInsights?.paidPaymentsCount || 0, language)} tone="amber" />
                    </div>

                    <div className="mt-6">
                      <h5 className="text-sm font-extrabold text-slate-800">{pageTr("Recent courses")}</h5>
                      <div className="mt-3 space-y-3">
                        {(selectedStudent?.studentInsights?.recentCourses || []).length ? (
                          selectedStudent.studentInsights.recentCourses.map((course) => (
                            <div key={course.id} className="border border-slate-200 bg-slate-50 px-4 py-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <p className="truncate font-bold text-slate-800">{course.title}</p>
                                  <p className="mt-1 text-xs font-semibold text-slate-800">
                                    {resolvePaymentPlanLabel(course.paymentPlan, pageTr)} • {formatDate(course.enrolledAt, language)}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusStyle(course.enrollmentStatus === "completed" ? "active" : course.enrollmentStatus === "pending" ? "pending" : "active")}`}>
                                    {course.enrollmentStatus === "completed"
                                      ? pageTr("Completed")
                                      : course.enrollmentStatus === "pending"
                                        ? pageTr("Pending")
                                        : pageTr("Active")}
                                  </span>
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                                    course.accessStatus === "allowed"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border-slate-200 bg-slate-100 text-slate-600"
                                  }`}>
                                    {course.accessStatus === "allowed" ? pageTr("Allowed") : pageTr("Access blocked")}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm font-semibold text-slate-800">{pageTr("No recent courses yet.")}</p>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({ label, value, dir }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-700" dir={dir || undefined}>{value || "-"}</p>
    </div>
  );
}

function StatTile({ label, value, tone = "blue" }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone] || "bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-2xl p-4 ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-800">{value}</p>
    </div>
  );
}
