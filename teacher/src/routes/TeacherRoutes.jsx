import { lazy, Suspense, useCallback, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import TeacherProtectedRoute from "./TeacherProtectedRoute";
import { getTeacherEntryPath, isTeacherAuthenticated } from "../../services/portal.js";
import TeacherPageLoader from "../components/common/TeacherPageLoader";

const loadTeacherLogin = () => import("../auth/TeacherLogin");
const loadTeacherDashboard = () => import("../pages/TeacherDashboard");
const loadTeacherCourses = () => import("../pages/TeacherCourses");
const loadTeacherReports = () => import("../pages/TeacherReports");
const loadTeacherStudents = () => import("../pages/TeacherStudents");
const loadTeacherLiveClasses = () => import("../pages/TeacherLiveClasses");
const loadTeacherAttendance = () => import("../pages/TeacherAttendance");
const loadTeacherAssignments = () => import("../pages/TeacherAssignments");
const loadTeacherResources = () => import("../pages/TeacherResources");
const loadTeacherMessages = () => import("../pages/TeacherMessages");
const loadTeacherIncome = () => import("../pages/TeacherIncome");
const loadTeacherProfile = () => import("../pages/TeacherProfile");
const loadTeacherSettings = () => import("../pages/TeacherSettings");
const loadTeacherPasswordRecovery = () => import("../auth/TeacherPasswordRecovery");

const TeacherLogin = lazy(loadTeacherLogin);
const TeacherDashboard = lazy(loadTeacherDashboard);
const TeacherCourses = lazy(loadTeacherCourses);
const TeacherReports = lazy(loadTeacherReports);
const TeacherStudents = lazy(loadTeacherStudents);
const TeacherLiveClasses = lazy(loadTeacherLiveClasses);
const TeacherAttendance = lazy(loadTeacherAttendance);
const TeacherAssignments = lazy(loadTeacherAssignments);
const TeacherResources = lazy(loadTeacherResources);
const TeacherMessages = lazy(loadTeacherMessages);
const TeacherIncome = lazy(loadTeacherIncome);
const TeacherProfile = lazy(loadTeacherProfile);
const TeacherSettings = lazy(loadTeacherSettings);
const TeacherPasswordRecovery = lazy(loadTeacherPasswordRecovery);

const preloadRoutes = [
  { key: "login", test: (path) => path === "/teacher/login", load: loadTeacherLogin },
  { key: "dashboard", test: (path) => path === "/teacher/dashboard", load: loadTeacherDashboard },
  { key: "courses", test: (path) => path === "/teacher/courses", load: loadTeacherCourses },
  { key: "students", test: (path) => path === "/teacher/students", load: loadTeacherStudents },
  {
    key: "live-classes",
    test: (path) => path === "/teacher/live-classes",
    load: loadTeacherLiveClasses,
  },
  {
    key: "attendance",
    test: (path) => path === "/teacher/attendance",
    load: loadTeacherAttendance,
  },
  {
    key: "assignments",
    test: (path) => path === "/teacher/assignments",
    load: loadTeacherAssignments,
  },
  { key: "resources", test: (path) => path === "/teacher/resources", load: loadTeacherResources },
  { key: "messages", test: (path) => path === "/teacher/messages", load: loadTeacherMessages },
  { key: "reports", test: (path) => path === "/teacher/reports", load: loadTeacherReports },
  { key: "income", test: (path) => path === "/teacher/income", load: loadTeacherIncome },
  { key: "profile", test: (path) => path === "/teacher/profile", load: loadTeacherProfile },
  { key: "settings", test: (path) => path === "/teacher/settings", load: loadTeacherSettings },
  {
    key: "password-recovery",
    test: (path) =>
      [
        "/teacher/forgot-password",
        "/teacher/verify-reset-otp",
        "/teacher/reset-password",
      ].includes(path),
    load: loadTeacherPasswordRecovery,
  },
];

const isConstrainedConnection = () => {
  if (typeof navigator === "undefined") return false;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return (
    Boolean(connection?.saveData) ||
    /(^|slow-)2g/i.test(String(connection?.effectiveType || ""))
  );
};

export default function TeacherRoutes() {
  const prefetchedRoutesRef = useRef(new Set());
  const isAuthenticated = isTeacherAuthenticated();
  const teacherEntryPath = getTeacherEntryPath();
  const shouldShowSuspenseFallback =
    typeof document === "undefined" || !document.getElementById("app-boot-loader");

  const prefetchPath = useCallback((pathToPrefetch) => {
    if (!pathToPrefetch) return;
    if (isConstrainedConnection()) return;
    const match = preloadRoutes.find((route) => route.test(pathToPrefetch));
    if (!match) return;
    if (prefetchedRoutesRef.current.has(match.key)) return;
    prefetchedRoutesRef.current.add(match.key);
    match.load().catch(() => {
      prefetchedRoutesRef.current.delete(match.key);
    });
  }, []);

  const handleRouteIntent = useCallback(
    (event) => {
      if (typeof window === "undefined") return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      let url;
      try {
        url = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      prefetchPath(url.pathname);
    },
    [prefetchPath],
  );

  return (
    <div onPointerEnterCapture={handleRouteIntent} onFocusCapture={handleRouteIntent}>
      <Suspense fallback={shouldShowSuspenseFallback ? <TeacherPageLoader fullScreen label="در حال بارگذاری" /> : null}>
        <Routes>
          <Route
            path="/"
            element={
              <Navigate
                to={isAuthenticated ? teacherEntryPath : "/teacher/login"}
                replace
              />
            }
          />
          <Route
            path="/teacher/login"
            element={
              isAuthenticated ? (
                <Navigate to={teacherEntryPath} replace />
              ) : (
                <TeacherLogin />
              )
            }
          />
          <Route
            path="/teacher/forgot-password"
            element={
              isAuthenticated ? (
                <Navigate to={teacherEntryPath} replace />
              ) : (
                <TeacherPasswordRecovery />
              )
            }
          />
          <Route
            path="/teacher/verify-reset-otp"
            element={
              isAuthenticated ? (
                <Navigate to={teacherEntryPath} replace />
              ) : (
                <TeacherPasswordRecovery />
              )
            }
          />
          <Route
            path="/teacher/reset-password"
            element={
              isAuthenticated ? (
                <Navigate to={teacherEntryPath} replace />
              ) : (
                <TeacherPasswordRecovery />
              )
            }
          />
          <Route
            path="/teacher/dashboard"
            element={
              <TeacherProtectedRoute>
                <TeacherDashboard />
              </TeacherProtectedRoute>
            }
          />
          <Route
            path="/teacher/courses"
            element={
              <TeacherProtectedRoute>
                <TeacherCourses />
              </TeacherProtectedRoute>
            }
          />
          <Route
            path="/teacher/students"
            element={
              <TeacherProtectedRoute>
                <TeacherStudents />
              </TeacherProtectedRoute>
            }
          />
          <Route
            path="/teacher/live-classes"
            element={
              <TeacherProtectedRoute>
                <TeacherLiveClasses />
              </TeacherProtectedRoute>
            }
          />
          <Route
            path="/teacher/attendance"
            element={
              <TeacherProtectedRoute>
                <TeacherAttendance />
              </TeacherProtectedRoute>
            }
          />
          <Route
            path="/teacher/assignments"
            element={
              <TeacherProtectedRoute>
                <TeacherAssignments />
              </TeacherProtectedRoute>
            }
          />
          <Route
            path="/teacher/resources"
            element={
              <TeacherProtectedRoute>
                <TeacherResources />
              </TeacherProtectedRoute>
            }
          />
          <Route
            path="/teacher/messages"
            element={
              <TeacherProtectedRoute>
                <TeacherMessages />
              </TeacherProtectedRoute>
            }
          />
          <Route
            path="/teacher/reports"
            element={
              <TeacherProtectedRoute>
                <TeacherReports />
              </TeacherProtectedRoute>
            }
          />
          <Route
            path="/teacher/income"
            element={
              <TeacherProtectedRoute>
                <TeacherIncome />
              </TeacherProtectedRoute>
            }
          />
          <Route
            path="/teacher/profile"
            element={
              <TeacherProtectedRoute>
                <TeacherProfile />
              </TeacherProtectedRoute>
            }
          />
          <Route
            path="/teacher/settings"
            element={
              <TeacherProtectedRoute>
                <TeacherSettings />
              </TeacherProtectedRoute>
            }
          />
          <Route
            path="*"
            element={
              <Navigate
                to={isAuthenticated ? teacherEntryPath : "/teacher/login"}
                replace
              />
            }
          />
        </Routes>
      </Suspense>
    </div>
  );
}
