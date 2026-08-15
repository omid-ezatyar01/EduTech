import { lazy, Suspense, useState, useEffect, useCallback, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router";
import AdminLayout from "./layouts/AdminLayout";
import { enableAdminPushNotifications } from "../services/pushNotifications.js";
import { useAdminI18n } from "./i18n/AdminI18nContext.jsx";
import AdminPageLoader from "./components/common/AdminPageLoader.jsx";
import { applyEduTechLogoFallback } from "./utils/imageFallback.js";

const loadAdminLoginPage = () => import("./pages/AdminLoginPage");
const loadAdminDashboardPage = () => import("./pages/AdminDashboardPage");
const loadAdminStudentsPage = () => import("./pages/AdminStudentsPage");
const loadAdminTeachersPage = () => import("./pages/AdminTeachersPage");
const loadAdminCertificatesPage = () => import("./pages/AdminCertificatesPage");
const loadAdminCoursesPage = () => import("./pages/AdminCoursesPage");
const loadAdminLearningPackagesPage = () => import("./pages/AdminLearningPackagesPage");
const loadAdminBootcampsPage = () => import("./pages/AdminBootcampsPage");
const loadAdminCategoriesPage = () => import("./pages/AdminCategoriesPage");
const loadAdminVideosPage = () => import("./pages/AdminVideosPage");
const loadAdminArticlesPage = () => import("./pages/AdminArticlesPage");
const loadAdminGalleryPage = () => import("./pages/AdminGalleryPage");
const loadAdminHeroMediaPage = () => import("./pages/AdminHeroMediaPage");
const loadAdminPaymentsPage = () => import("./pages/AdminPaymentsPage");
const loadAdminTeacherIncomePage = () => import("./pages/AdminTeacherIncomePage");
const loadAdminTeacherBankReviewsPage = () => import("./pages/AdminTeacherBankReviewsPage");
const loadAdminCouponsPage = () => import("./pages/AdminCouponsPage");
const loadAdminMessagesPage = () => import("./pages/AdminMessagesPage");
const loadAdminReportsPage = () => import("./pages/AdminReportsPage");
const loadAdminSettingsPage = () => import("./pages/AdminSettingsPage");
const loadAdminFeedbackPage = () => import("./pages/AdminFeedbackPage");
const loadAdminSupportPage = () => import("./pages/AdminSupportPage");
const loadSupportStaffAccountsPage = () =>
  import("./features/supportStaff/pages/SupportStaffAccountsPage");

const AdminLoginPage = lazy(loadAdminLoginPage);
const AdminDashboardPage = lazy(loadAdminDashboardPage);
const AdminStudentsPage = lazy(loadAdminStudentsPage);
const AdminTeachersPage = lazy(loadAdminTeachersPage);
const AdminCertificatesPage = lazy(loadAdminCertificatesPage);
const AdminCoursesPage = lazy(loadAdminCoursesPage);
const AdminLearningPackagesPage = lazy(loadAdminLearningPackagesPage);
const AdminBootcampsPage = lazy(loadAdminBootcampsPage);
const AdminCategoriesPage = lazy(loadAdminCategoriesPage);
const AdminVideosPage = lazy(loadAdminVideosPage);
const AdminArticlesPage = lazy(loadAdminArticlesPage);
const AdminGalleryPage = lazy(loadAdminGalleryPage);
const AdminHeroMediaPage = lazy(loadAdminHeroMediaPage);
const AdminPaymentsPage = lazy(loadAdminPaymentsPage);
const AdminTeacherIncomePage = lazy(loadAdminTeacherIncomePage);
const AdminTeacherBankReviewsPage = lazy(loadAdminTeacherBankReviewsPage);
const AdminCouponsPage = lazy(loadAdminCouponsPage);
const AdminMessagesPage = lazy(loadAdminMessagesPage);
const AdminReportsPage = lazy(loadAdminReportsPage);
const AdminSettingsPage = lazy(loadAdminSettingsPage);
const AdminFeedbackPage = lazy(loadAdminFeedbackPage);
const AdminSupportPage = lazy(loadAdminSupportPage);
const SupportStaffAccountsPage = lazy(loadSupportStaffAccountsPage);

const preloadRoutes = [
  { key: "login", test: (path) => path === "/login", load: loadAdminLoginPage },
  { key: "dashboard", test: (path) => path === "/", load: loadAdminDashboardPage },
  { key: "students-legacy", test: (path) => path === "/users/students", load: loadAdminStudentsPage },
  { key: "students", test: (path) => path === "/students", load: loadAdminStudentsPage },
  { key: "teachers", test: (path) => path === "/teachers", load: loadAdminTeachersPage },
  { key: "certificates", test: (path) => path === "/certificates", load: loadAdminCertificatesPage },
  { key: "courses", test: (path) => path === "/courses", load: loadAdminCoursesPage },
  { key: "packages", test: (path) => path === "/packages", load: loadAdminLearningPackagesPage },
  { key: "bootcamps", test: (path) => path === "/bootcamps", load: loadAdminBootcampsPage },
  { key: "categories", test: (path) => path === "/categories", load: loadAdminCategoriesPage },
  { key: "videos", test: (path) => path === "/videos", load: loadAdminVideosPage },
  { key: "articles", test: (path) => path === "/articles", load: loadAdminArticlesPage },
  { key: "gallery", test: (path) => path === "/gallery", load: loadAdminGalleryPage },
  { key: "hero-media", test: (path) => path === "/hero-media", load: loadAdminHeroMediaPage },
  { key: "payments", test: (path) => path === "/payments", load: loadAdminPaymentsPage },
  { key: "teacher-income", test: (path) => path === "/teacher-income", load: loadAdminTeacherIncomePage },
  { key: "teacher-bank-reviews", test: (path) => path === "/teacher-bank-reviews", load: loadAdminTeacherBankReviewsPage },
  { key: "coupons", test: (path) => path === "/coupons", load: loadAdminCouponsPage },
  { key: "messages", test: (path) => path === "/messages", load: loadAdminMessagesPage },
  { key: "reports", test: (path) => path === "/reports", load: loadAdminReportsPage },
  { key: "feedback", test: (path) => path === "/feedback", load: loadAdminFeedbackPage },
  { key: "support", test: (path) => path === "/support", load: loadAdminSupportPage },
  { key: "support-staff", test: (path) => path === "/support-staff", load: loadSupportStaffAccountsPage },
  { key: "settings", test: (path) => path === "/settings", load: loadAdminSettingsPage },
  { key: "telegram-redirect", test: (path) => path === "/telegram", load: loadAdminSettingsPage },
];

const isConstrainedConnection = () => {
  if (typeof navigator === "undefined") return false;
  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return (
    Boolean(connection?.saveData) ||
    /(^|slow-)2g/i.test(String(connection?.effectiveType || ""))
  );
};

import {
  clearAuth,
  isAdminAuthenticated,
} from "../services/portal.js";

const KNOWN_ADMIN_ROUTE_SUFFIXES = [
  "/login",
  "/users/students",
  "/students",
  "/teachers",
  "/certificates",
  "/courses",
  "/packages",
  "/bootcamps",
  "/categories",
  "/videos",
  "/articles",
  "/gallery",
  "/hero-media",
  "/payments",
  "/teacher-income",
  "/teacher-bank-reviews",
  "/coupons",
  "/messages",
  "/reports",
  "/feedback",
  "/support",
  "/support-staff",
  "/telegram",
  "/settings",
];

function resolveAdminBasename() {
  const envBase = String(import.meta.env.VITE_ADMIN_BASE_PATH || "").trim();
  if (envBase) {
    const normalized = envBase.startsWith("/") ? envBase : `/${envBase}`;
    return normalized.replace(/\/+$/, "") || "/";
  }

  const viteBase = String(import.meta.env.BASE_URL || "").trim();
  if (viteBase && viteBase !== "/" && viteBase !== "./") {
    const normalized = viteBase.startsWith("/") ? viteBase : `/${viteBase}`;
    return normalized.replace(/\/+$/, "") || "/";
  }

  if (typeof window === "undefined") return "/";

  const pathname = window.location.pathname || "/";
  if (pathname === "/" || pathname === "/index.html") return "/";

  const matchedSuffix = KNOWN_ADMIN_ROUTE_SUFFIXES.find(
    (suffix) => pathname === suffix || pathname.endsWith(suffix),
  );

  if (matchedSuffix) {
    const basePath = pathname.slice(0, pathname.length - matchedSuffix.length) || "/";
    return basePath.replace(/\/+$/, "") || "/";
  }

  const trimmed = pathname.replace(/\/+$/, "");
  if (!trimmed) return "/";

  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  const basePath = `/${segments[0]}`;
  return basePath.replace(/\/+$/, "") || "/";
}

if (typeof window !== "undefined") {
  window.__EDUTECH_ADMIN_BASENAME__ = resolveAdminBasename();
}

function ProtectedLayout({ isAuthenticated, onLogout }) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AdminLayout onLogout={onLogout}>
      <Outlet />
    </AdminLayout>
  );
}

function AppContent() {
  const { language } = useAdminI18n();
  const location = useLocation();
  const prefetchedRoutesRef = useRef(new Set());

  const checkAuth = () => isAdminAuthenticated();

  const [isAuthenticated, setIsAuthenticated] = useState(checkAuth);

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(checkAuth());
    };
    window.addEventListener("admin_auth_change", handleAuthChange);
    handleAuthChange(); // Ensure kick-out on mount if role is wrong
    return () =>
      window.removeEventListener("admin_auth_change", handleAuthChange);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    enableAdminPushNotifications({ promptIfNeeded: false }).catch((error) => {
      console.warn(`Admin push notification setup failed: ${error.message}`);
    });
  }, [isAuthenticated]);

  useEffect(() => {
    document.body.classList.add("app-ready");
    const loader = document.getElementById("app-boot-loader");
    if (!loader) return undefined;
    loader.classList.add("app-boot-loader--hidden");
    const cleanupTimer = window.setTimeout(() => {
      loader.remove();
    }, 260);
    return () => window.clearTimeout(cleanupTimer);
  }, []);

  const prefetchPath = useCallback((pathToPrefetch) => {
    if (!pathToPrefetch) return;
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    prefetchPath(location.pathname);
  }, [location.pathname, prefetchPath]);

  useEffect(() => {
    if (!isAuthenticated || isConstrainedConnection()) return undefined;
    let cancelled = false;
    const preloadInBackground = async () => {
      for (const route of preloadRoutes) {
        if (cancelled) break;
        if (["login", "telegram-redirect"].includes(route.key)) continue;
        if (prefetchedRoutesRef.current.has(route.key)) continue;
        prefetchedRoutesRef.current.add(route.key);
        try {
          await route.load();
        } catch {
          prefetchedRoutesRef.current.delete(route.key);
        }
      }
    };
    const callback = () => {
      preloadInBackground();
    };
    const idleId =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(callback, { timeout: 2500 })
        : window.setTimeout(callback, 1200);

    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, [isAuthenticated]);

  const handleLogout = () => {
    clearAuth();
  };

  return (
    <div className="font-sans" onErrorCapture={applyEduTechLogoFallback} onPointerEnterCapture={handleRouteIntent} onFocusCapture={handleRouteIntent}>
      <Suspense
        fallback={
          <AdminPageLoader
            fullScreen
            label={language === "fa" ? "در حال بارگذاری" : "Loading"}
          />
        }
      >
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <AdminLoginPage />
            }
          />

          <Route element={<ProtectedLayout isAuthenticated={isAuthenticated} onLogout={handleLogout} />}>
            <Route path="/" element={<AdminDashboardPage />} />
            <Route path="/users/students" element={<Navigate to="/students" replace />} />
            <Route path="/students" element={<AdminStudentsPage />} />
            <Route path="/teachers" element={<AdminTeachersPage />} />
            <Route path="/certificates" element={<AdminCertificatesPage />} />
            <Route path="/courses" element={<AdminCoursesPage />} />
            <Route path="/packages" element={<AdminLearningPackagesPage />} />
            <Route path="/bootcamps" element={<AdminBootcampsPage />} />
            <Route path="/categories" element={<AdminCategoriesPage />} />
            <Route path="/videos" element={<AdminVideosPage />} />
            <Route path="/articles" element={<AdminArticlesPage />} />
            <Route path="/gallery" element={<AdminGalleryPage />} />
            <Route path="/hero-media" element={<AdminHeroMediaPage />} />
            <Route path="/payments" element={<AdminPaymentsPage />} />
            <Route path="/teacher-income" element={<AdminTeacherIncomePage />} />
            <Route path="/teacher-bank-reviews" element={<AdminTeacherBankReviewsPage />} />
            <Route path="/coupons" element={<AdminCouponsPage />} />
            <Route path="/messages" element={<AdminMessagesPage />} />
            <Route path="/reports" element={<AdminReportsPage />} />
            <Route path="/feedback" element={<AdminFeedbackPage />} />
            <Route path="/support" element={<AdminSupportPage />} />
            <Route path="/support-staff" element={<SupportStaffAccountsPage />} />
            <Route path="/telegram" element={<Navigate to="/settings" replace />} />
            <Route path="/settings" element={<AdminSettingsPage />} />
          </Route>

          <Route
            path="*"
            element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />}
          />
        </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <Router basename={resolveAdminBasename()}>
      <AppContent />
    </Router>
  );
}
