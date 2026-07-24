import { useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, Clock, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPageLoader from "../components/common/TeacherPageLoader";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import useLiveDataRefresh from "../hooks/useLiveDataRefresh";
import NewStudentsCard from "../components/students/NewStudentsCard";
import StudentProfileModal from "../components/students/StudentProfileModal";
import StudentQuickActionsCard from "../components/students/StudentQuickActionsCard";
import TeacherStudentFilterBar from "../components/students/TeacherStudentFilterBar";
import TeacherStudentStatsCard from "../components/students/TeacherStudentStatsCard";
import TeacherStudentsTable from "../components/students/TeacherStudentsTable";
import { fetchTeacherStudents } from "../../services/teacherPortalService";
import { getApiBase } from "../../services/http";
import { getAuthUser } from "../../services/portal";
import {
  getTeacherPageCacheKey,
  readTeacherPageCache,
  writeTeacherPageCache,
} from "../utils/teacherPageCache";

const STUDENT_AVATAR_FALLBACK = "/logo.png";

const resolveAssetUrl = (rawPath = "") => {
  const value = String(rawPath || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  if (value.startsWith("/")) {
    const backendOrigin = getApiBase().replace(/\/api\/v\d+$/i, "").replace(/\/+$/, "");
    return `${backendOrigin}${value}`;
  }
  return value;
};

const mapStudentRow = (row = {}) => ({
  ...row,
  avatar: resolveAssetUrl(row.avatar) || STUDENT_AVATAR_FALLBACK,
  progress: Math.max(0, Math.min(100, Number(row.progress || 0))),
  attendance: Math.max(0, Math.min(100, Number(row.attendance || 0))),
});

const getStudentsCacheKey = ({ page, search, course }) =>
  getTeacherPageCacheKey("students", {
    page,
    search: String(search || "").trim(),
    course,
  });

const DEFAULT_STUDENT_STATS = {
  totalStudents: 0,
  activeStudents: 0,
  followupStudents: 0,
  averageAttendance: 0,
};

const DEFAULT_STUDENT_META = { page: 1, limit: 20, total: 0, totalPages: 1 };

export default function TeacherStudents() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const initialCourse = useMemo(
    () =>
      new URLSearchParams(location.search).get("courseId") ||
      new URLSearchParams(location.search).get("course") ||
      "all",
    [location.search],
  );
  const initialStudentsCache = readTeacherPageCache(getStudentsCacheKey({
    page: 1,
    search: "",
    course: initialCourse,
  }));
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState(initialCourse);
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [profileStudent, setProfileStudent] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [students, setStudents] = useState(initialStudentsCache?.students || []);
  const [newStudents, setNewStudents] = useState(initialStudentsCache?.newStudents || []);
  const [courseOptions, setCourseOptions] = useState(initialStudentsCache?.courseOptions || []);
  const [statsData, setStatsData] = useState(initialStudentsCache?.statsData || DEFAULT_STUDENT_STATS);
  const [meta, setMeta] = useState(initialStudentsCache?.meta || DEFAULT_STUDENT_META);
  const [loading, setLoading] = useState(!initialStudentsCache);
  const [error, setError] = useState("");
  const [refreshSeed, setRefreshSeed] = useState(0);

  useLiveDataRefresh(() => setRefreshSeed((prev) => prev + 1), {
    intervalMs: 0,
    refreshOnFocus: false,
    refreshOnVisible: false,
  });

  const currentTeacher = useMemo(() => {
    const user = getAuthUser();
    return user || { name: "Teacher", email: "teacher@edutech.study", role: "teacher" };
  }, []);

  const teacherDisplayName = currentTeacher?.name || currentTeacher?.nameFa || "مدرس";

  useEffect(() => {
    const timer = setTimeout(async () => {
      const cacheKey = getStudentsCacheKey({ page, search, course });
      const cached = readTeacherPageCache(cacheKey);
      if (cached) {
        setStudents(cached.students || []);
        setNewStudents(cached.newStudents || []);
        setCourseOptions(cached.courseOptions || []);
        setStatsData(cached.statsData || DEFAULT_STUDENT_STATS);
        setMeta(cached.meta || DEFAULT_STUDENT_META);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        setError("");

        const data = await fetchTeacherStudents({
          page,
          limit: 20,
          search,
          course: course === "all" ? "" : course,
        });

        const nextStudents = Array.isArray(data?.students) ? data.students.map(mapStudentRow) : [];
        const nextNewStudents = Array.isArray(data?.newStudents) ? data.newStudents.map(mapStudentRow) : [];
        const nextCourseOptions = Array.isArray(data?.courses) ? data.courses : [];
        const nextStatsData = {
          totalStudents: Number(data?.stats?.totalStudents || 0),
          activeStudents: Number(data?.stats?.activeStudents || 0),
          followupStudents: Number(data?.stats?.followupStudents || 0),
          averageAttendance: Number(data?.stats?.averageAttendance || 0),
        };
        const nextMeta = {
          page: Number(data?.meta?.page || 1),
          limit: Number(data?.meta?.limit || 20),
          total: Number(data?.meta?.total || 0),
          totalPages: Number(data?.meta?.totalPages || 1),
        };

        setStudents(nextStudents);
        setNewStudents(nextNewStudents);
        setCourseOptions(nextCourseOptions);
        setStatsData(nextStatsData);
        setMeta(nextMeta);
        writeTeacherPageCache(cacheKey, {
          students: nextStudents,
          newStudents: nextNewStudents,
          courseOptions: nextCourseOptions,
          statsData: nextStatsData,
          meta: nextMeta,
        });
      } catch (err) {
        setError(err?.message || "خطا در دریافت اطلاعات شاگردان");
        setStudents([]);
        setNewStudents([]);
        setCourseOptions([]);
        setStatsData(DEFAULT_STUDENT_STATS);
        setMeta(DEFAULT_STUDENT_META);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [page, search, course, refreshSeed]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCourse(initialCourse);
      setPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialCourse]);

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  const handleCourseChange = (value) => {
    setCourse(value);
    setPage(1);
    navigate(
      value && value !== "all"
        ? `/teacher/students?courseId=${encodeURIComponent(value)}`
        : "/teacher/students",
      { replace: true },
    );
  };

  const visibleCourseOptions = useMemo(() => {
    const options = Array.isArray(courseOptions) ? [...courseOptions] : [];
    if (
      initialCourse &&
      initialCourse !== "all" &&
      !options.some((item) => item.id === initialCourse || item.title === initialCourse)
    ) {
      options.push({ id: initialCourse, title: initialCourse });
    }
    return options;
  }, [courseOptions, initialCourse]);

  const showToast = (message) => {
    setToastMessage(message);
  };

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleMoreAction = (action, student) => {
    setOpenMenuId(null);

    if (action === "مشاهده پروفایل") {
      setProfileStudent(student);
      return;
    }

    showToast(`عملیات «${action}» برای ${student.name} انجام شد`);
  };

  const handleQuickAction = (action) => {
    if (action === "downloadList") {
      const headers = ["Name", "Email", "Phone", "Course", "Progress", "Attendance", "Assignments", "Enrollment Status"];
      const rows = students.map((student) => [
        student.name || "",
        student.email || "",
        student.phone || "",
        student.course || "",
        `${student.progress || 0}%`,
        `${student.attendance || 0}%`,
        student.assignments || "",
        student.enrollmentStatus || "",
      ]);
      const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "teacher-students.csv";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast("لیست شاگردان دانلود شد");
      return;
    }

    if (action === "createAssignment") {
      navigate(
        course && course !== "all"
          ? `/teacher/assignments?courseId=${encodeURIComponent(course)}`
          : "/teacher/assignments",
      );
      return;
    }

    navigate(
      course && course !== "all"
        ? `/teacher/attendance?courseId=${encodeURIComponent(course)}`
        : "/teacher/attendance",
    );
  };

  const stats = [
    {
      id: 1,
      title: "همه شاگردان",
      value: String(statsData.totalStudents),
      subtitle: "مجموع کل شاگردان",
      icon: Users,
      color: "blue",
    },
    {
      id: 2,
      title: "شاگردان فعال",
      value: String(statsData.activeStudents),
      subtitle: "دسترسی فعال به کورس",
      icon: Activity,
      color: "green",
    },
    {
      id: 3,
      title: "نیازمند پیگیری",
      value: String(statsData.followupStudents),
      subtitle: "نیاز به بررسی بیشتر",
      icon: AlertCircle,
      color: "orange",
    },
    {
      id: 4,
      title: "میانگین حضور",
      value: `${statsData.averageAttendance}%`,
      subtitle: "بر اساس شاگردان موجود",
      icon: Clock,
      color: "purple",
    },
  ];

  return (
    <TeacherLayout teacher={currentTeacher} language={language} onLanguageChange={setLanguage}>
      <section className={`space-y-5 ${isRTL ? "text-right" : "text-left"}`}>
        <header className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          <p className="text-sm font-semibold text-slate-500">داشبورد / شاگردان</p>

          <div className="mt-3">
            <div>
              <div className="flex items-center gap-2">
                <Users size={22} className="text-[#0B4FD8]" />
                <h1 className="text-2xl font-black text-slate-900">شاگردان</h1>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                در این بخش می‌توانید شاگردان کورس‌های خود را مشاهده، پیگیری و مدیریت کنید. ویژه{" "}
                {teacherDisplayName}.
              </p>
            </div>
          </div>
        </header>

        <section className="w-full">
          <StudentQuickActionsCard onAction={handleQuickAction} />
        </section>

        {error ? (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <TeacherStudentStatsCard key={item.id} {...item} />
          ))}
        </section>

        <section className="w-full">
          <TeacherStudentFilterBar
            search={search}
            onSearchChange={handleSearchChange}
            course={course}
            onCourseChange={handleCourseChange}
            courses={visibleCourseOptions}
          />
        </section>

        <section className="w-full">
          <NewStudentsCard students={newStudents} />
        </section>

        <section className="w-full">
          {loading ? (
            <TeacherPageLoader label={language === "fa" ? "در حال بارگذاری شاگردان" : "Loading students"} />
          ) : (
            <TeacherStudentsTable
              students={students}
              onView={(student) => setProfileStudent(student)}
              onMoreToggle={(studentId) => setOpenMenuId((previous) => (previous === studentId ? null : studentId))}
              openMenuId={openMenuId}
              onMoreAction={handleMoreAction}
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onPageChange={setPage}
              loading={false}
            />
          )}
        </section>

        <StudentProfileModal
          open={Boolean(profileStudent)}
          student={profileStudent}
          onClose={() => setProfileStudent(null)}
        />

        {toastMessage ? (
          <div className="fixed bottom-5 left-1/2 z-[100] w-[92%] max-w-md -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl">
            {toastMessage}
          </div>
        ) : null}
      </section>
    </TeacherLayout>
  );
}
