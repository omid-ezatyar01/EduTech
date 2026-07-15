import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Footer from "./components/Footer.jsx";
import Header from "./components/Header.jsx";
import { translations } from "./data/translations.js";
import { isConstrainedConnection } from "../services/http.js";
import { getCurrentUser } from "../services/authService.js";
import {
  PORTAL_CONFIG,
  clearAuth,
  getAuthUser,
  isCorrectRole,
  setAuthNotice,
} from "../services/portal.js";
import { enableEduTechPushNotifications } from "../services/pushNotifications.js";
import useSeo from "./seo/useSeo.js";
import { RegionalPricingProvider } from "./context/RegionalPricingContext.jsx";
import FrontendPageLoader from "./components/common/FrontendPageLoader.jsx";

// Pages
const loadHomePage = () => import("./pages/HomePage.jsx");
const loadLiveCoursesPage = () => import("./pages/LiveCoursesPage.jsx");
const loadCourseDetailsPage = () => import("./pages/CourseDetailsPage.jsx");
const loadTeachersPage = () => import("./pages/TeachersPage.jsx");
const loadTeacherDetails = () => import("./pages/TeacherDetails.jsx");
const loadAboutPage = () => import("./pages/AboutPage.jsx");
const loadContactPage = () => import("./pages/ContactPage.jsx");
const loadLoginPage = () => import("./pages/LoginPage.jsx");
const loadRegisterPage = () => import("./pages/RegisterPage.jsx");
const loadStudentDashboardPage = () => import("./pages/StudentDashboardPage.jsx");
const loadPaymentSuccessPage = () => import("./pages/PaymentSuccessPage.jsx");
const loadPaymentFailurePage = () => import("./pages/PaymentFailurePage.jsx");
const loadNowPaymentsPage = () => import("./pages/NowPaymentsPage.jsx");
const loadVerifyCertificatePage = () => import("./pages/VerifyCertificatePage.jsx");
const loadPrivacyPolicyPage = () => import("./pages/PrivacyPolicyPage.jsx");
const loadTermsPage = () => import("./pages/TermsPage.jsx");

const HomePage = lazy(loadHomePage);
const LiveCoursesPage = lazy(loadLiveCoursesPage);
const CourseDetailsPage = lazy(loadCourseDetailsPage);
const TeachersPage = lazy(loadTeachersPage);
const TeacherDetails = lazy(loadTeacherDetails);
const AboutPage = lazy(loadAboutPage);
const ContactPage = lazy(loadContactPage);
const LoginPage = lazy(loadLoginPage);
const RegisterPage = lazy(loadRegisterPage);
const StudentDashboardPage = lazy(loadStudentDashboardPage);
const PaymentSuccessPage = lazy(loadPaymentSuccessPage);
const PaymentFailurePage = lazy(loadPaymentFailurePage);
const NowPaymentsPage = lazy(loadNowPaymentsPage);
const VerifyCertificatePage = lazy(loadVerifyCertificatePage);
const PrivacyPolicyPage = lazy(loadPrivacyPolicyPage);
const TermsPage = lazy(loadTermsPage);

// Student Dashboard Components
const loadMyCourses = () => import("./components/MyCourses.jsx");
const loadLiveClass = () => import("./components/LiveClass.jsx");
const loadAttendance = () => import("./components/Attendance.jsx");
const loadCertificates = () => import("./components/Certificates.jsx");
const loadPayments = () => import("./components/Payments.jsx");
const loadNotifications = () => import("./components/Notifications.jsx");
const loadSchedule = () => import("./components/Schedule.jsx");
const loadAssignments = () => import("./components/Assignments.jsx");
const loadResources = () => import("./components/Resources.jsx");
const loadProfile = () => import("./components/Profile.jsx");
const loadSettings = () => import("./components/Settings.jsx");

const MyCourses = lazy(loadMyCourses);
const LiveClass = lazy(loadLiveClass);
const Attendance = lazy(loadAttendance);
const Certificates = lazy(loadCertificates);
const Payments = lazy(loadPayments);
const Notifications = lazy(loadNotifications);
const Schedule = lazy(loadSchedule);
const Assignments = lazy(loadAssignments);
const Resources = lazy(loadResources);
const Profile = lazy(loadProfile);
const Settings = lazy(loadSettings);

const preloadRoutes = [
  { key: "home", test: (path) => path === "/", load: loadHomePage },
  { key: "live-courses", test: (path) => path === "/live-courses", load: loadLiveCoursesPage },
  { key: "course-details", test: (path) => path.startsWith("/course/"), load: loadCourseDetailsPage },
  { key: "teachers", test: (path) => path === "/teachers", load: loadTeachersPage },
  { key: "teacher-details", test: (path) => path.startsWith("/teacher/"), load: loadTeacherDetails },
  { key: "about", test: (path) => path === "/about", load: loadAboutPage },
  { key: "contact", test: (path) => path === "/contact", load: loadContactPage },
  { key: "verify", test: (path) => path === "/verify", load: loadVerifyCertificatePage },
  { key: "privacy-policy", test: (path) => path === "/privacy-policy", load: loadPrivacyPolicyPage },
  { key: "terms", test: (path) => path === "/terms", load: loadTermsPage },
  { key: "login", test: (path) => path === "/login", load: loadLoginPage },
  { key: "register", test: (path) => path === "/register", load: loadRegisterPage },
  {
    key: "student-dashboard",
    test: (path) => path === "/student/dashboard",
    load: loadStudentDashboardPage,
  },
  { key: "student-courses", test: (path) => path === "/student/courses", load: loadMyCourses },
  { key: "student-live", test: (path) => path === "/student/live", load: loadLiveClass },
  { key: "student-attendance", test: (path) => path === "/student/attendance", load: loadAttendance },
  { key: "student-schedule", test: (path) => path === "/student/schedule", load: loadSchedule },
  {
    key: "student-assignments",
    test: (path) => path === "/student/assignments",
    load: loadAssignments,
  },
  {
    key: "student-resources",
    test: (path) => path === "/student/resources",
    load: loadResources,
  },
  {
    key: "student-certificates",
    test: (path) => path === "/student/certificates",
    load: loadCertificates,
  },
  { key: "student-payments", test: (path) => path === "/student/payments", load: loadPayments },
  {
    key: "student-notifications",
    test: (path) => path === "/student/notifications",
    load: loadNotifications,
  },
  { key: "student-profile", test: (path) => path === "/student/profile", load: loadProfile },
  { key: "student-settings", test: (path) => path === "/student/settings", load: loadSettings },
  { key: "payment-success", test: (path) => path === "/payment/success", load: loadPaymentSuccessPage },
  { key: "payment-failure", test: (path) => path === "/payment/failure", load: loadPaymentFailurePage },
  { key: "payment-crypto", test: (path) => path === "/payment/crypto", load: loadNowPaymentsPage },
];

function getInitialLanguage() {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem("edutech-language");
    if (saved === "fa" || saved === "en") return saved;
  }
  return "fa";
}

function ProtectedRoute({ isAuthenticated, language, children }) {
  const [checking, setChecking] = useState(isAuthenticated);

  useEffect(() => {
    let mounted = true;

    const verifyAccount = async () => {
      if (!isAuthenticated) {
        setChecking(false);
        return;
      }

      const localUser = getAuthUser();
      if (!isCorrectRole(localUser)) {
        setAuthNotice("Please login again.");
        clearAuth();
        if (mounted) setChecking(false);
        return;
      }

      setChecking(true);
      try {
        const data = await getCurrentUser();
        const user = data?.user || data;
        if (!isCorrectRole(user)) {
          setAuthNotice("Please login again.");
          clearAuth();
          return;
        }
        localStorage.setItem("edutech_user", JSON.stringify(user));
      } catch {
        // The shared API interceptor clears auth and redirects for deleted or invalid accounts.
      } finally {
        if (mounted) setChecking(false);
      }
    };

    verifyAccount();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (checking) {
    const loadingLabel = language === "fa" ? "در حال بارگذاری" : "Loading";

    return (
      <div className="mx-auto w-full max-w-[1340px] px-4">
        <FrontendPageLoader label={loadingLabel} minHeight="min-h-[58vh]" className="border-0 bg-transparent p-0" />
      </div>
    );
  }

  return children;
}

function AuthRoute({ isAuthenticated, children }) {
  if (isAuthenticated) {
    return <Navigate to={PORTAL_CONFIG.dashboardPath} replace />;
  }

  return children;
}

export default function App() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("edutech_auth") === "true",
  );
  const prefetchedRoutesRef = useRef(new Set());

  const location = useLocation();
  const navigate = useNavigate();
  const t = translations[language];
  const dir = t.meta.dir;

  useSeo({ pathname: location.pathname, language });

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(localStorage.getItem("edutech_auth") === "true");
    };
    window.addEventListener("auth_change", handleAuthChange);
    return () => window.removeEventListener("auth_change", handleAuthChange);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    enableEduTechPushNotifications().catch((error) => {
      console.warn(`EduTech push notification setup failed: ${error.message}`);
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
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
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
    document.documentElement.dir = dir;
    document.documentElement.lang = t.meta.lang;
    window.localStorage.setItem("edutech-language", language);
  }, [dir, language, t.meta.lang]);

  useEffect(() => {
    const handleLanguageChange = (event) => {
      const next = event?.detail?.language;
      if (next === "fa" || next === "en") {
        setLanguage(next);
      }
    };
    window.addEventListener("edutech_language_change", handleLanguageChange);
    return () => {
      window.removeEventListener("edutech_language_change", handleLanguageChange);
    };
  }, []);

  useEffect(() => {
    const hash = location.hash || "";
    const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!normalized.startsWith("student/")) return;
    navigate(`/${normalized}`, { replace: true });
  }, [location.hash, navigate]);

  const path = location.pathname;
  const isAuthPage = path === "/login" || path === "/register";
  const isStudentPage = path.startsWith("/student/");
  const isLegalPage = path === "/privacy-policy" || path === "/terms";
  const hideGlobalLayout = isAuthPage || isStudentPage || isLegalPage;

  let activeHref = "/";
  if (path.startsWith("/teachers") || path.startsWith("/teacher/"))
    activeHref = "/teachers";
  else if (path.startsWith("/live-courses") || path.startsWith("/course/"))
    activeHref = "/live-courses";
  else if (path === "/about") activeHref = "/about";
  else if (path === "/contact") activeHref = "/contact";

  return (
    <RegionalPricingProvider>
      <div
        className="notranslate min-h-screen overflow-x-clip bg-slate-50 text-slate-950"
        dir={dir}
        translate="no"
        onPointerOver={handleRouteIntent}
        onFocusCapture={handleRouteIntent}
      >
        {!hideGlobalLayout && (
          <Header
            activeHref={activeHref}
            language={language}
            onLanguageChange={setLanguage}
            t={t}
          />
        )}
        <main>
          <Suspense fallback={null}>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage language={language} t={t} />} />
            <Route path="/live-courses" element={<LiveCoursesPage t={t} />} />
            <Route
              path="/course/:id"
              element={<CourseDetailsPage courseIndex={0} t={t} />}
            />
            <Route path="/teachers" element={<TeachersPage t={t} />} />
            <Route
              path="/teacher/:id"
              element={<TeacherDetails language={language} />}
            />
            <Route path="/about" element={<AboutPage language={language} />} />
            <Route
              path="/contact"
              element={<ContactPage language={language} />}
            />
            <Route path="/verify" element={<VerifyCertificatePage />} />
            <Route
              path="/privacy-policy"
              element={<PrivacyPolicyPage language={language} />}
            />
            <Route path="/terms" element={<TermsPage language={language} />} />
            <Route
              path="/login"
              element={
                <AuthRoute
                  isAuthenticated={isAuthenticated}
                >
                  <LoginPage language={language} t={t} />
                </AuthRoute>
              }
            />
            <Route
              path="/register"
              element={
                <AuthRoute
                  isAuthenticated={isAuthenticated}
                >
                  <RegisterPage language={language} t={t} />
                </AuthRoute>
              }
            />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/failure" element={<PaymentFailurePage />} />
            <Route
              path="/payment/crypto"
              element={<NowPaymentsPage language={language} />}
            />

            {/* Protected Student Routes */}
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  language={language}
                >
                  <StudentDashboardPage language={language} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/courses"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  language={language}
                >
                  <MyCourses language={language} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/live"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  language={language}
                >
                  <LiveClass language={language} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/schedule"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  language={language}
                >
                  <Schedule language={language} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/attendance"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  language={language}
                >
                  <Attendance language={language} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/assignments"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  language={language}
                >
                  <Assignments language={language} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/resources"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  language={language}
                >
                  <Resources language={language} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/certificates"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  language={language}
                >
                  <Certificates language={language} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/payments"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  language={language}
                >
                  <Payments language={language} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/messages"
              element={<Navigate to="/student/dashboard" replace />}
            />
            <Route
              path="/student/notifications"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  language={language}
                >
                  <Notifications language={language} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/profile"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  language={language}
                >
                  <Profile language={language} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/settings"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  language={language}
                >
                  <Settings language={language} />
                </ProtectedRoute>
              }
            />

            {/* Fallback to Dashboard for missing student pages, or to Home for unknown public pages */}
            <Route
              path="/student/*"
              element={<Navigate to="/student/dashboard" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        {!hideGlobalLayout && <Footer t={t} />}
      </div>
    </RegionalPricingProvider>
  );
}
