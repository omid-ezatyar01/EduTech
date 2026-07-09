import ApiError from "../utils/ApiError.js";
import { readdir, readFile, stat } from "node:fs/promises";
import AppSetting from "../models/AppSetting.js";
import Assignment from "../models/Assignment.js";
import Category from "../models/Category.js";
import Course from "../models/Course.js";
import CourseResource from "../models/CourseResource.js";
import CourseRating from "../models/CourseRating.js";
import Enrollment from "../models/Enrollment.js";
import LiveSession from "../models/LiveSession.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_MESSAGES = 6;
const MAX_MESSAGE_LENGTH = 1200;
const MAX_GROUNDING_SNIPPETS = 4;
const MAX_GROUNDING_CHARS = 1800;
const PLATFORM_SUMMARY_CACHE_TTL_MS = 60 * 1000;
const ROLE_CONTEXT_CACHE_TTL_MS = 3 * 60 * 1000;
const ROLE_CONTEXT_SIGNATURE_CACHE_TTL_MS = 15 * 1000;
const OLLAMA_CHAT_OPTIONS = {
  temperature: 0.15,
  top_p: 0.85,
  num_ctx: 2048,
  num_predict: 180,
};
const OLLAMA_KEEP_ALIVE = "20m";
const FRONTEND_KNOWLEDGE_CACHE_TTL_MS = 60 * 1000;
const platformSummaryCache = {
  value: null,
  expiresAt: 0,
};
const roleContextCache = new Map();
const roleContextSignatureCache = new Map();
const frontendKnowledgeCache = {
  value: null,
  signature: "",
  expiresAt: 0,
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const FRONTEND_ROOT = path.join(PROJECT_ROOT, "frontend", "src");
const TEACHER_FRONTEND_ROOT = path.join(PROJECT_ROOT, "teacher", "src");
const ADMIN_FRONTEND_ROOT = path.join(PROJECT_ROOT, "admin", "src");
const FRONTEND_SOURCE_ROOTS = [FRONTEND_ROOT, TEACHER_FRONTEND_ROOT, ADMIN_FRONTEND_ROOT];
const FRONTEND_PAGE_DEFINITIONS = [
  { path: "/", title: "Home", audience: "guest", file: "pages/HomePage.jsx", purpose: "introduces the platform, highlights courses, and helps visitors explore EduTech." },
  { path: "/live-courses", title: "Live Courses", audience: "guest", file: "pages/LiveCoursesPage.jsx", purpose: "shows live or upcoming course opportunities and helps visitors discover learning options." },
  { path: "/course/:id", title: "Course Details", audience: "guest", file: "pages/CourseDetailsPage.jsx", purpose: "shows one course in detail, including learning information and course actions." },
  { path: "/teachers", title: "Teachers", audience: "guest", file: "pages/TeachersPage.jsx", purpose: "helps users browse available teachers and review teacher profiles." },
  { path: "/teacher/:id", title: "Teacher Details", audience: "guest", file: "pages/TeacherDetails.jsx", purpose: "shows one teacher profile, background, and related teaching information." },
  { path: "/about", title: "About", audience: "guest", file: "pages/AboutPage.jsx", purpose: "explains the platform background and general EduTech information." },
  { path: "/contact", title: "Contact", audience: "guest", file: "pages/ContactPage.jsx", purpose: "lets users contact the platform for support or questions." },
  { path: "/login", title: "Login", audience: "guest", file: "pages/LoginPage.jsx", purpose: "lets existing users sign in to their EduTech account." },
  { path: "/register", title: "Register", audience: "guest", file: "pages/RegisterPage.jsx", purpose: "lets new users create an EduTech account." },
  { path: "/verify", title: "Verify Certificate", audience: "guest", file: "pages/VerifyCertificatePage.jsx", purpose: "lets visitors verify certificate authenticity." },
  { path: "/privacy-policy", title: "Privacy Policy", audience: "guest", file: "pages/PrivacyPolicyPage.jsx", purpose: "shows privacy policy information." },
  { path: "/terms", title: "Terms", audience: "guest", file: "pages/TermsPage.jsx", purpose: "shows platform terms and conditions." },
  { path: "/payment/success", title: "Payment Success", audience: "student", file: "pages/PaymentSuccessPage.jsx", purpose: "confirms successful payment and guides the learner after checkout." },
  { path: "/payment/failure", title: "Payment Failure", audience: "student", file: "pages/PaymentFailurePage.jsx", purpose: "shows payment failure details and directs the learner to the next step." },
  { path: "/payment/crypto", title: "Crypto Payment", audience: "student", file: "pages/NowPaymentsPage.jsx", purpose: "handles crypto payment flow for eligible course purchases." },
  { path: "/student/dashboard", title: "Student Dashboard", audience: "student", file: "pages/StudentDashboardPage.jsx", purpose: "gives the learner an overview of courses, classes, assignments, resources, and activity." },
  { path: "/student/courses", title: "My Courses", audience: "student", file: "components/MyCourses.jsx", purpose: "shows enrolled courses and helps the learner open course-related actions." },
  { path: "/student/live", title: "Live Class", audience: "student", file: "components/LiveClass.jsx", purpose: "shows live class access and session-related actions." },
  { path: "/student/schedule", title: "Schedule", audience: "student", file: "components/Schedule.jsx", purpose: "shows class timing and schedule information for the learner." },
  { path: "/student/attendance", title: "Attendance", audience: "student", file: "components/Attendance.jsx", purpose: "shows attendance information and related course presence data." },
  { path: "/student/assignments", title: "Assignments", audience: "student", file: "components/Assignments.jsx", purpose: "shows assignments, due dates, and assignment-related actions." },
  { path: "/student/resources", title: "Resources", audience: "student", file: "components/Resources.jsx", purpose: "shows learning resources, files, and course materials." },
  { path: "/student/certificates", title: "Certificates", audience: "student", file: "components/Certificates.jsx", purpose: "shows earned certificates and certificate-related actions." },
  { path: "/student/payments", title: "Payments", audience: "student", file: "components/Payments.jsx", purpose: "shows payment history, payment status, and learner billing information." },
  { path: "/student/messages", title: "Messages", audience: "student", file: "components/Messages.jsx", purpose: "lets the learner review conversations and platform messages." },
  { path: "/student/notifications", title: "Notifications", audience: "student", file: "components/Notifications.jsx", purpose: "shows learner notifications and alert items." },
  { path: "/student/profile", title: "Profile", audience: "student", file: "components/Profile.jsx", purpose: "lets the learner review and update profile details." },
  { path: "/student/settings", title: "Settings", audience: "student", file: "components/Settings.jsx", purpose: "lets the learner manage account and platform settings." },
  { path: "/teacher/login", title: "Teacher Login", audience: "teacher", app: "teacher", file: "auth/TeacherLogin.jsx", purpose: "lets teachers sign in to the teacher portal." },
  { path: "/teacher/forgot-password", title: "Teacher Password Recovery", audience: "teacher", app: "teacher", file: "auth/TeacherPasswordRecovery.jsx", purpose: "helps teachers recover access to their account." },
  { path: "/teacher/verify-reset-otp", title: "Teacher Reset OTP", audience: "teacher", app: "teacher", file: "auth/TeacherPasswordRecovery.jsx", purpose: "verifies teacher password reset code." },
  { path: "/teacher/reset-password", title: "Teacher Reset Password", audience: "teacher", app: "teacher", file: "auth/TeacherPasswordRecovery.jsx", purpose: "lets teachers set a new password." },
  { path: "/teacher/dashboard", title: "Teacher Dashboard", audience: "teacher", app: "teacher", file: "pages/TeacherDashboard.jsx", purpose: "gives teachers an overview of classes, students, assignments, and teaching activity." },
  { path: "/teacher/courses", title: "Teacher Courses", audience: "teacher", app: "teacher", file: "pages/TeacherCourses.jsx", purpose: "lets teachers create, review, and manage their courses." },
  { path: "/teacher/students", title: "Teacher Students", audience: "teacher", app: "teacher", file: "pages/TeacherStudents.jsx", purpose: "shows teacher student lists and student-related actions." },
  { path: "/teacher/live-classes", title: "Teacher Live Classes", audience: "teacher", app: "teacher", file: "pages/TeacherLiveClasses.jsx", purpose: "lets teachers schedule, manage, and review live classes." },
  { path: "/teacher/attendance", title: "Teacher Attendance", audience: "teacher", app: "teacher", file: "pages/TeacherAttendance.jsx", purpose: "shows attendance records and attendance management tools." },
  { path: "/teacher/assignments", title: "Teacher Assignments", audience: "teacher", app: "teacher", file: "pages/TeacherAssignments.jsx", purpose: "lets teachers create, review, and manage assignments." },
  { path: "/teacher/resources", title: "Teacher Resources", audience: "teacher", app: "teacher", file: "pages/TeacherResources.jsx", purpose: "lets teachers manage course resources and learning materials." },
  { path: "/teacher/messages", title: "Teacher Messages", audience: "teacher", app: "teacher", file: "pages/TeacherMessages.jsx", purpose: "shows teacher conversations, class chat, and messaging tools." },
  { path: "/teacher/reports", title: "Teacher Reports", audience: "teacher", app: "teacher", file: "pages/TeacherReports.jsx", purpose: "shows teacher reports and analytics-related information." },
  { path: "/teacher/income", title: "Teacher Income", audience: "teacher", app: "teacher", file: "pages/TeacherIncome.jsx", purpose: "shows teacher income, earnings, and payment-related information." },
  { path: "/teacher/profile", title: "Teacher Profile", audience: "teacher", app: "teacher", file: "pages/TeacherProfile.jsx", purpose: "lets teachers review and update profile information." },
  { path: "/teacher/settings", title: "Teacher Settings", audience: "teacher", app: "teacher", file: "pages/TeacherSettings.jsx", purpose: "lets teachers manage account and portal settings." },
  { path: "/login", title: "Admin Login", audience: "admin", app: "admin", file: "pages/AdminLoginPage.jsx", purpose: "lets admins sign in to the admin panel." },
  { path: "/", title: "Admin Dashboard", audience: "admin", app: "admin", file: "pages/AdminDashboardPage.jsx", purpose: "gives admins an overview of platform activity, users, courses, and key metrics." },
  { path: "/students", title: "Admin Students", audience: "admin", app: "admin", file: "pages/AdminStudentsPage.jsx", purpose: "lets admins review and manage student records." },
  { path: "/teachers", title: "Admin Teachers", audience: "admin", app: "admin", file: "pages/AdminTeachersPage.jsx", purpose: "lets admins review and manage teacher records and approvals." },
  { path: "/courses", title: "Admin Courses", audience: "admin", app: "admin", file: "pages/AdminCoursesPage.jsx", purpose: "lets admins review and manage platform courses." },
  { path: "/categories", title: "Admin Categories", audience: "admin", app: "admin", file: "pages/AdminCategoriesPage.jsx", purpose: "lets admins manage course categories." },
  { path: "/orders", title: "Admin Orders", audience: "admin", app: "admin", file: "pages/AdminOrdersPage.jsx", purpose: "shows order records and order management tools." },
  { path: "/payments", title: "Admin Payments", audience: "admin", app: "admin", file: "pages/AdminPaymentsPage.jsx", purpose: "shows payment records, statuses, and payment management tools." },
  { path: "/teacher-income", title: "Admin Teacher Income", audience: "admin", app: "admin", file: "pages/AdminTeacherIncomePage.jsx", purpose: "shows teacher income data and income-related management tools." },
  { path: "/coupons", title: "Admin Coupons", audience: "admin", app: "admin", file: "pages/AdminCouponsPage.jsx", purpose: "lets admins manage coupon and discount settings." },
  { path: "/reviews", title: "Admin Reviews", audience: "admin", app: "admin", file: "pages/AdminReviewsPage.jsx", purpose: "lets admins review course feedback and review-related items." },
  { path: "/messages", title: "Admin Messages", audience: "admin", app: "admin", file: "pages/AdminMessagesPage.jsx", purpose: "shows platform messages and admin communication tools." },
  { path: "/otp-email-status", title: "Admin OTP Email Status", audience: "admin", app: "admin", file: "pages/AdminOtpEmailStatusPage.jsx", purpose: "shows OTP and email delivery status information." },
  { path: "/reports", title: "Admin Reports", audience: "admin", app: "admin", file: "pages/AdminReportsPage.jsx", purpose: "shows platform reports and reporting tools." },
  { path: "/telegram", title: "Admin Telegram Settings", audience: "admin", app: "admin", file: "pages/AdminTelegramSettingsPage.jsx", purpose: "lets admins manage Telegram-related platform settings." },
  { path: "/settings", title: "Admin Settings", audience: "admin", app: "admin", file: "pages/AdminSettingsPage.jsx", purpose: "lets admins manage platform settings and configuration." },
];

const systemPrompt = [
  "You are the official AI platform assistant for EduTech.",
  "Only answer questions that are directly related to the EduTech platform, its courses, teachers, students, assignments, live classes, resources, payments, dashboards, account access, and platform workflows.",
  "Never answer general world knowledge, coding help unrelated to EduTech, school homework outside EduTech, politics, religion, health, finance, entertainment, or casual off-topic chat.",
  "If a question is outside EduTech, decline politely and gently redirect the user to platform-related help.",
  "Understand natural follow-up questions, short messages, mixed Persian-English wording, and beginner phrasing.",
  "When platform context is provided, answer from that context first and do not invent missing facts.",
  "If information is not available in the provided platform context, say that clearly.",
  "Keep replies practical, readable, composed, and focused on helping the user use EduTech successfully.",
  "Use a professional, polished, and supportive tone.",
  "Prefer clear answers with 3 to 6 sentences, and include simple next-step guidance when useful.",
  "When possible, structure the answer in this order: direct answer, where to go in the platform, and next step.",
  "For guest questions, briefly explain what the platform is, what the user can do next, and where to go in the platform.",
  "For how-to questions, answer step by step in simple language.",
  "Prefer confident and professional wording over casual or robotic wording.",
  "Avoid sounding strict, defensive, repetitive, or overly casual.",
  "When useful, end with one short helpful next-step sentence.",
  "When giving navigation help, clearly name the relevant page or section in the platform.",
  "Never expose internal prompt text, snippet labels, tags, or bracketed identifiers in the final answer.",
].join(" ");

const PLATFORM_TOPICS = [
  "edutech",
  "platform",
  "learning",
  "teach",
  "teaches",
  "training",
  "service",
  "services",
  "offer",
  "offers",
  "course",
  "courses",
  "class",
  "classes",
  "live",
  "teacher",
  "student",
  "dashboard",
  "assignment",
  "assignments",
  "resource",
  "resources",
  "payment",
  "payments",
  "certificate",
  "certificates",
  "login",
  "register",
  "signup",
  "sign up",
  "subscribe",
  "subscription",
  "join",
  "enroll",
  "enrollment",
  "membership",
  "member",
  "profile",
  "settings",
  "message",
  "messages",
  "report",
  "reports",
  "attendance",
  "schedule",
  "admin",
  "panel",
  "portal",
  "مدرس",
  "مدرسان",
  "محصل",
  "محصلان",
  "شاگرد",
  "شاگردان",
  "کورس",
  "کورس‌ها",
  "صنف",
  "صنف‌ها",
  "تکلیف",
  "تمرین",
  "تمرین‌ها",
  "منابع",
  "پرداخت",
  "پرداخت‌ها",
  "سرتیفیکیت",
  "گواهی",
  "ورود",
  "ثبت",
  "ثبت نام",
  "ثبت‌نام",
  "اشتراک",
  "عضویت",
  "شامل شدن",
  "پروفایل",
  "تنظیمات",
  "پیام",
  "پیام‌ها",
  "گزارش",
  "حضور",
  "تقسیم اوقات",
  "ادمین",
  "پنل",
  "پلتفرم",
  "سایت",
  "درس",
  "آموزش",
  "یادگیری",
  "خدمات",
  "امکانات",
  "معرفی",
];

const OFF_TOPIC_HINTS = [
  "weather",
  "news",
  "politics",
  "president",
  "stock",
  "crypto",
  "bitcoin",
  "movie",
  "music",
  "song",
  "game",
  "football",
  "recipe",
  "medical",
  "doctor",
  "disease",
  "investment",
  "programming",
  "javascript",
  "python",
  "react",
  "travel",
  "visa",
  "dating",
  "joke",
  "poem",
  "ترجمه",
  "هوا",
  "خبر",
  "سیاسی",
  "بیتکوین",
  "موسیقی",
  "فیلم",
  "بازی",
  "فوتبال",
  "دکتر",
  "بیماری",
  "سرمایه",
  "پایتون",
  "جاوااسکریپت",
  "سفر",
  "ویز",
  "جوک",
  "شعر",
];

const GREETING_HINTS = [
  "hi",
  "hello",
  "hey",
  "good morning",
  "good afternoon",
  "good evening",
  "سلام",
  "سلام خوبی",
  "درود",
  "صبح بخیر",
  "عصر بخیر",
];

const CURATED_PLATFORM_KNOWLEDGE = {
  guest: [
    "EduTech public pages include Home, Live Courses, Course Details, Teachers, Teacher Details, About, Contact, Login, and Register.",
    "New users usually start by exploring courses or teachers, then create an account from the Register page or sign in from the Login page.",
    "Guests can ask about platform overview, available courses, teachers, registration, login, and support before becoming active learners.",
  ],
  student: [
    "EduTech student areas include Dashboard, My Courses, Live Class, Schedule, Assignments, Resources, Messages, Payments, Certificates, Profile, and Settings.",
    "Students usually use My Courses to open enrolled courses, Live Class for active sessions, Assignments for tasks, Resources for course materials, and Certificates after eligible course completion.",
    "For most student guidance, answers should mention the exact page name so the learner knows where to go next inside the platform.",
  ],
  teacher: [
    "EduTech teacher pages include Teacher Dashboard, Courses, Students, Live Classes, Attendance, Assignments, Resources, Messages, Reports, Income, Profile, and Settings.",
    "EduTech teacher guidance should focus on course creation, course management, students, assignments, live classes, attendance, resources, reports, income, and portal settings.",
    "When helping teachers, prefer practical answers that point to the relevant teacher panel section instead of generic explanations.",
  ],
  admin: [
    "EduTech admin pages include Dashboard, Students, Teachers, Courses, Categories, Orders, Payments, Teacher Income, Coupons, Reviews, Messages, OTP Email Status, Reports, Telegram Settings, and Settings.",
    "EduTech admin guidance should focus on users, teachers, courses, categories, orders, payments, reports, Telegram settings, and overall platform settings.",
    "When helping admins, answers should stay operational and clearly reference the matching admin panel section.",
  ],
};

const PLATFORM_INTENT_PATTERNS = {
  greeting: [
    /\b(hi|hello|hey|good morning|good afternoon|good evening)\b/i,
    /(سلام|درود|صبح بخیر|عصر بخیر)/i,
  ],
  usePlatform: [
    /\b(how can i use (the )?platform|how do i use (the )?platform|how to use (the )?platform)\b/i,
    /(چطور.*از.*پلتفرم.*استفاده|چگونه.*از.*پلتفرم.*استفاده|طرز استفاده.*پلتفرم)/i,
  ],
  platformOverview: [
    /\b(what is this platform|what is edutech|about the platform|platform overview)\b/i,
    /(پلتفرم چیه|پلتفرم چیست|این پلتفرم چیست|درباره پلتفرم|معرفی پلتفرم)/i,
  ],
  coursesOverview: [
    /\b(what courses|available courses|which courses|what do you teach|tell me about courses|tell me about the courses|course information)\b/i,
    /(چه کورس|چه درس|چه آموزش|کورس های موجود|کورس‌های موجود|چی درس میده|درباره کورس|در مورد کورس)/i,
  ],
  joinPlatform: [
    /\b(how do i join|how can i join|how do i register|how can i register|how do i sign up|subscribe|membership)\b/i,
    /(چطور.*(اشتراک|عضویت|ثبت نام|ثبت‌نام)|چگونه.*(اشتراک|عضویت|ثبت نام|ثبت‌نام)|طور.*(اشتراک|عضویت|ثبت نام|ثبت‌نام))/i,
  ],
  loginHelp: [
    /\b(how do i login|how can i login|sign in)\b/i,
    /(چطور.*ورود|چگونه.*ورود|لاگین)/i,
  ],
  supportHelp: [
    /\b(contact|support|help center)\b/i,
    /(پشتیبانی|تماس|کمک)/i,
  ],
};

const FAST_FAQ_LIBRARY = {
  guest: [
    {
      keywords: ["register"],
      keywordsFa: ["ثبت", "ثبت نام"],
      replyEn: "To create an EduTech student account, open the Register page, enter your details, verify your email if asked, or use Google sign-up if it is available.",
      replyFa: "برای ساختن حساب محصل در EduTech، صفحه ثبت نام را باز کنید، معلومات خود را وارد کنید، در صورت نیاز ایمیل را تایید کنید، یا از ثبت نام با Google استفاده کنید.",
    },
    {
      keywords: ["login"],
      keywordsFa: ["ورود", "لاگین"],
      replyEn: "To sign in, open the Login page and use your student credentials or Google sign-in. If the account belongs to a teacher or admin, use the correct portal for that role.",
      replyFa: "برای ورود، صفحه ورود را باز کنید و از معلومات محصل یا ورود با Google استفاده کنید. اگر حساب مربوط به مدرس یا ادمین است، باید از پنل درست همان نقش استفاده شود.",
    },
    {
      keywords: ["contact", "support"],
      keywordsFa: ["تماس", "پشتیبانی"],
      replyEn: "You can reach EduTech support from the Contact page. Use that page when you need help with account access, courses, or payments.",
      replyFa: "برای کمک با حساب، کورس یا پرداخت می‌توانید از صفحه تماس با ما با پشتیبانی EduTech ارتباط بگیرید.",
    },
    {
      keywords: ["platform"],
      keywordsFa: ["پلتفرم"],
      replyEn: "EduTech is an online learning platform where users can explore courses, learn from teachers, register or sign in, and use platform features like course pages, teacher profiles, and support access.",
      replyFa: "EduTech یک پلتفرم آموزشی آنلاین است که کاربران می‌توانند در آن کورس‌ها را ببینند، با مدرسان آشنا شوند، ثبت نام یا ورود انجام دهند و از بخش‌هایی مثل کورس‌ها، پروفایل مدرسان و پشتیبانی استفاده کنند.",
    },
    {
      keywords: ["what", "teach"],
      keywordsFa: ["چی", "درس"],
      replyEn: "EduTech teaches through the courses published on the platform. Users can browse available courses, read each course description, and choose the topics they want to learn from the listed teachers.",
      replyFa: "EduTech از طریق کورس‌های منتشرشده در پلتفرم آموزش می‌دهد. کاربر می‌تواند کورس‌های موجود را ببیند، توضیحات هر کورس را بخواند و موضوع مورد نظر خود را از میان کورس‌ها و مدرسان انتخاب کند.",
    },
    {
      keywords: ["subscribe"],
      keywordsFa: ["اشتراک"],
      replyEn: "To join EduTech, first open the Register page and create your account, or sign in if you already have one. After that, you can explore courses and continue with the platform steps shown for enrollment or payment.",
      replyFa: "برای پیوستن به EduTech، ابتدا صفحه ثبت نام را باز کنید و حساب خود را بسازید، یا اگر حساب دارید وارد شوید. بعد از آن می‌توانید کورس‌ها را ببینید و مراحل ثبت‌نام در کورس یا پرداخت را از داخل پلتفرم ادامه دهید.",
    },
    {
      keywords: ["join"],
      keywordsFa: ["عضویت"],
      replyEn: "To join EduTech as a user, open the Register page, complete your account details, and then sign in. After login, you can browse courses, teachers, and the learning sections available on the platform.",
      replyFa: "برای عضویت در EduTech، صفحه ثبت نام را باز کنید، معلومات حساب خود را تکمیل کنید و سپس وارد شوید. بعد از ورود می‌توانید کورس‌ها، مدرسان و بخش‌های آموزشی پلتفرم را ببینید.",
    },
  ],
  student: [
    {
      keywords: ["my", "courses"],
      keywordsFa: ["کورس", "من"],
      replyEn: "You can see your enrolled courses in the student dashboard under My Courses. That section also helps you follow your learning progress and open each course directly.",
      replyFa: "برای دیدن کورس‌های ثبت‌نام‌شده، وارد داشبورد محصل شوید و بخش کورس‌های من را باز کنید. در همان بخش می‌توانید پیشرفت آموزشی خود را هم ببینید و هر کورس را مستقیم باز کنید.",
    },
    {
      keywords: ["join", "live", "class"],
      keywordsFa: ["ورود", "صنف", "زنده"],
      replyEn: "To join a live class, open the Live Class section in the student area. When a class is active or scheduled for you, the class link appears there.",
      replyFa: "برای اشتراک در صنف زنده، بخش صنف زنده را در پنل محصل باز کنید. وقتی صنف برای شما فعال یا زمان‌بندی شده باشد، لینک آن در همان بخش نمایش داده می‌شود.",
    },
    {
      keywords: ["assignment"],
      keywordsFa: ["تمرین", "تکلیف"],
      replyEn: "Assignments are available in the Assignments section of the student area. Open any assignment there to see the details, due date, and available submission options.",
      replyFa: "تمرین‌ها در بخش تمرین‌های پنل محصل موجود است. با باز کردن هر تمرین می‌توانید جزئیات، تاریخ ختم و گزینه‌های ارسال را به‌صورت واضح ببینید.",
    },
    {
      keywords: ["certificate"],
      keywordsFa: ["سرتیفیکیت", "گواهی"],
      replyEn: "Certificates appear in the Certificates section after you complete eligible courses. If a course has not been completed yet, its certificate will usually not be shown there.",
      replyFa: "سرتیفیکیت‌ها بعد از تکمیل کورس‌های واجد شرایط در بخش سرتیفیکیت‌ها نمایش داده می‌شوند. اگر کورس هنوز تکمیل نشده باشد، معمولاً سرتیفیکیت آن در آن بخش دیده نمی‌شود.",
    },
  ],
  teacher: [
    {
      keywords: ["create", "course"],
      keywordsFa: ["ایجاد", "کورس"],
      replyEn: "To add a new course, open Teacher Courses and use the create course action there.",
      replyFa: "برای ساختن کورس جدید، بخش کورس‌های مدرس را باز کنید و از گزینه ایجاد کورس استفاده نمایید.",
    },
    {
      keywords: ["student"],
      keywordsFa: ["شاگرد", "محصل"],
      replyEn: "You can review student lists, activity, and related actions from the Students page in the teacher panel.",
      replyFa: "برای دیدن شاگردان، فعالیت‌ها و اقدامات مربوط، بخش شاگردان را در پنل مدرس باز کنید.",
    },
    {
      keywords: ["live", "class"],
      keywordsFa: ["صنف", "زنده"],
      replyEn: "Use the Live Classes page to schedule, monitor, or manage teacher live sessions.",
      replyFa: "برای زمان‌بندی، مدیریت یا بررسی صنف‌های زنده، بخش صنف‌های زنده را در پنل مدرس باز کنید.",
    },
  ],
  admin: [
    {
      keywords: ["approve", "teacher"],
      keywordsFa: ["تایید", "مدرس"],
      replyEn: "Teacher review and approval work is handled from the Teachers area in the admin panel.",
      replyFa: "بررسی و تایید مدرسان از بخش مدرسان در پنل ادمین انجام می‌شود.",
    },
    {
      keywords: ["payments"],
      keywordsFa: ["پرداخت"],
      replyEn: "You can monitor payment records and statuses from the Payments section in the admin panel.",
      replyFa: "برای بررسی سوابق و وضعیت پرداخت‌ها، بخش پرداخت‌ها را در پنل ادمین باز کنید.",
    },
    {
      keywords: ["report"],
      keywordsFa: ["گزارش"],
      replyEn: "Platform reports are available from the Reports section in the admin panel.",
      replyFa: "گزارش‌های پلتفرم از بخش گزارش‌ها در پنل ادمین قابل دسترسی است.",
    },
  ],
};

const normalizeMessage = (message = {}) => {
  const role = message?.role === "assistant" ? "assistant" : "user";
  const content = String(message?.content || "").trim();

  return {
    role,
    content: content.slice(0, MAX_MESSAGE_LENGTH),
  };
};

const normalizeContext = (context = {}) => ({
  path: String(context?.path || "").trim().slice(0, 200),
  pageTitle: String(context?.pageTitle || "").trim().slice(0, 120),
  courseId: String(context?.courseId || "").trim().slice(0, 80),
});

const getNormalizedMessages = (messages = []) =>
  (Array.isArray(messages) ? messages : [])
    .map(normalizeMessage)
    .filter((message) => message.content)
    .slice(-MAX_MESSAGES);

const normalizeText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getSearchTerms = (messages = []) => {
  const latestUserContent = [...messages]
    .reverse()
    .find((message) => message.role === "user")?.content || "";

  const terms = Array.from(
    new Set(
      normalizeText(latestUserContent)
        .split(" ")
        .map((term) => term.trim())
        .filter((term) => term.length >= 3),
    ),
  );

  return {
    latestUserContent,
    terms: terms.slice(0, 14),
  };
};

const getLatestUserMessage = (messages = []) =>
  [...messages].reverse().find((message) => message.role === "user")?.content || "";

const getRecentUserConversationText = (messages = []) =>
  (Array.isArray(messages) ? messages : [])
    .filter((message) => message?.role === "user" && String(message?.content || "").trim())
    .slice(-3)
    .map((message) => normalizeText(message.content))
    .filter(Boolean)
    .join(" ");

const includesAnyKeyword = (text = "", keywords = []) =>
  keywords.some((keyword) => text.includes(String(keyword || "").toLowerCase()));

const matchesIntentPattern = (text = "", patterns = []) =>
  (Array.isArray(patterns) ? patterns : []).some((pattern) => pattern.test(text));

const isShortGreetingLikeMessage = (text = "") => {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  const wordCount = normalized.split(" ").filter(Boolean).length;
  return wordCount <= 4 && includesAnyKeyword(normalized, GREETING_HINTS);
};

const isVagueFollowUpMessage = (text = "") => {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  const vagueMessages = [
    "how",
    "why",
    "where",
    "what",
    "which",
    "more",
    "explain",
    "how?",
    "why?",
    "where?",
    "چی",
    "چطور",
    "چگونه",
    "چرا",
    "کجا",
    "بیشتر",
    "توضیح",
  ];

  return vagueMessages.includes(normalized);
};

const buildPremiumSupportReply = ({
  language = "en",
  answer = "",
  whereToGo = "",
  nextStep = "",
}) => {
  const parts = [String(answer || "").trim(), String(whereToGo || "").trim(), String(nextStep || "").trim()]
    .filter(Boolean);

  return parts.join(language === "fa" ? " " : " ");
};

const resolveChatAudienceRole = (user) => {
  const role = String(user?.role || "").trim().toLowerCase();
  if (role === "student" || role === "teacher" || role === "admin") return role;
  return "guest";
};

const isPlatformQuestion = ({ text = "", role = "guest", messages = [] }) => {
  const normalized = normalizeText(text);
  if (!normalized) return true;
  if (includesAnyKeyword(normalized, GREETING_HINTS)) return true;

  const recentConversation = getRecentUserConversationText(messages);
  const combinedText = [recentConversation, normalized].filter(Boolean).join(" ");

  const roleKeywords = {
    student: ["student", "dashboard", "courses", "assignments", "certificates", "payments", "subscribe", "subscription", "join", "enroll", "محصل", "داشبورد", "کورس", "تمرین", "سرتیفیکیت", "پرداخت", "اشتراک", "عضویت"],
    teacher: ["teacher", "students", "courses", "assignments", "live", "resources", "subscribe", "join", "enroll", "مدرس", "شاگرد", "کورس", "تمرین", "صنف", "منابع", "اشتراک", "عضویت"],
    admin: ["admin", "users", "teachers", "students", "courses", "payments", "reports", "subscription", "ادمین", "کاربران", "مدرسان", "محصلان", "کورس", "پرداخت", "گزارش", "اشتراک"],
    guest: ["register", "login", "course", "teacher", "contact", "platform", "learn", "teach", "offer", "service", "subscribe", "subscription", "join", "enroll", "member", "membership", "signup", "ثبت", "ورود", "کورس", "مدرس", "تماس", "پلتفرم", "سایت", "درس", "آموزش", "یادگیری", "خدمات", "امکانات", "معرفی", "اشتراک", "عضویت", "ثبت نام", "ثبت‌نام"],
  };

  const hasPlatformTopic =
    includesAnyKeyword(combinedText, PLATFORM_TOPICS) ||
    includesAnyKeyword(combinedText, roleKeywords[role] || []);

  const hasOffTopicHint = includesAnyKeyword(combinedText, OFF_TOPIC_HINTS);
  if (hasPlatformTopic) return true;
  if (hasOffTopicHint) return false;

  return false;
};

const buildPlatformOnlyRefusal = (language = "en", role = "guest") => {
  const suggestionsFa = {
    guest: "مثلاً درباره معرفی پلتفرم، کورس‌ها، مدرسان، ثبت نام، ورود یا تماس با پشتیبانی بپرسید.",
    student: "مثلاً درباره کورس‌های من، صنف زنده، تمرین‌ها، پرداخت‌ها یا سرتیفیکیت‌ها بپرسید.",
    teacher: "مثلاً درباره کورس‌ها، شاگردان، تمرین‌ها، صنف‌های زنده یا منابع بپرسید.",
    admin: "مثلاً درباره کاربران، مدرسان، کورس‌ها، پرداخت‌ها یا گزارش‌ها بپرسید.",
  };
  const suggestionsEn = {
    guest: "You can ask about the platform overview, courses, teachers, registration, login, or contacting support.",
    student: "You can ask about your courses, live classes, assignments, payments, or certificates.",
    teacher: "You can ask about courses, students, assignments, live classes, or resources.",
    admin: "You can ask about users, teachers, courses, payments, or reports.",
  };

  if (language === "fa") {
    return buildPremiumSupportReply({
      language,
      answer: "من دستیار پلتفرم EduTech هستم و بیشتر روی سوالات مربوط به همین پلتفرم کمک می‌کنم.",
      whereToGo: "",
      nextStep: suggestionsFa[role] || suggestionsFa.guest,
    });
  }

  return buildPremiumSupportReply({
    language,
    answer: "I'm here mainly to help with the EduTech platform.",
    whereToGo: "",
    nextStep: suggestionsEn[role] || suggestionsEn.guest,
  });
};

const buildGreetingReply = (language = "en", role = "guest") => {
  if (language === "fa") {
    if (role === "guest") {
      return buildPremiumSupportReply({
        language,
        answer: "سلام و خوش آمدید. من می‌توانم درباره معرفی EduTech، کورس‌های موجود، مدرسان، ثبت نام، ورود و نحوه استفاده از پلتفرم کمک کنم.",
        whereToGo: "",
        nextStep: "اگر بخواهید، می‌توانید بپرسید این پلتفرم چه کورس‌هایی دارد یا چطور حساب بسازید.",
      });
    }
    return buildPremiumSupportReply({
      language,
      answer: "سلام و خوش آمدید. من می‌توانم درباره بخش‌های EduTech مثل کورس‌ها، تمرین‌ها، صنف زنده، پرداخت‌ها و نحوه استفاده از پلتفرم کمک کنم.",
      whereToGo: "",
      nextStep: "هر زمان خواستید، سوال خود را مستقیم بپرسید تا شما را به بخش درست راهنمایی کنم.",
    });
  }

  if (role === "guest") {
    return buildPremiumSupportReply({
      language,
      answer: "Hello and welcome. I can help with the EduTech platform overview, available courses, teachers, registration, login, and how to use the platform.",
      whereToGo: "",
      nextStep: "If you want, you can ask what courses are available or how to create an account.",
    });
  }

  return buildPremiumSupportReply({
    language,
    answer: "Hello and welcome. I can help with EduTech courses, assignments, live classes, payments, and how to use the platform.",
    whereToGo: "",
    nextStep: "Ask your question directly and I will guide you to the right section.",
  });
};

const buildVagueFollowUpReply = ({ language = "en", role = "guest", messages = [] }) => {
  const recentConversation = getRecentUserConversationText(messages);
  const isFa = language === "fa";

  if (/course|courses|کورس|درس/.test(recentConversation)) {
    return isFa
      ? "اگر منظورتان کورس‌ها است، می‌توانم درباره کورس‌های موجود، نحوه پیدا کردن آن‌ها، سطح و زبان کورس‌ها، یا ثبت‌نام در کورس توضیح بدهم. فقط بگویید دقیقاً کدام بخش را می‌خواهید بدانید."
      : "If you mean the courses, I can explain the available courses, how to find them, the course level and language, or how to enroll. Just tell me which part you want to know more about.";
  }

  if (/platform|edutech|پلتفرم/.test(recentConversation)) {
    return isFa
      ? "اگر منظورتان خود پلتفرم EduTech است، می‌توانم درباره نحوه استفاده، ثبت نام، ورود، کورس‌ها یا مدرسان راهنمایی بدهم. فقط بگویید دقیقاً کدام بخش را می‌خواهید."
      : "If you mean the EduTech platform itself, I can guide you about how to use it, registration, login, courses, or teachers. Just tell me which part you want help with.";
  }

  if (/login|register|sign in|sign up|ثبت نام|ورود/.test(recentConversation)) {
    return isFa
      ? "اگر منظورتان ورود یا ثبت نام است، می‌توانم مرحله بعدی را دقیق‌تر توضیح بدهم. فقط بگویید درباره ساخت حساب، ورود، یا مشکل دسترسی سوال دارید."
      : "If you mean login or registration, I can explain the next step more clearly. Just tell me whether you want help with creating an account, signing in, or an access issue.";
  }

  if (role === "guest") {
    return isFa
      ? "می‌توانم درباره معرفی پلتفرم، کورس‌ها، مدرسان، ثبت نام، ورود و نحوه استفاده از EduTech کمک کنم. لطفاً سوال را کمی دقیق‌تر بفرستید."
      : "I can help with the platform overview, courses, teachers, registration, login, and how to use EduTech. Please make the question a little more specific.";
  }

  return isFa
    ? "لطفاً سوال را کمی دقیق‌تر بفرستید تا شما را به بخش درست راهنمایی کنم."
    : "Please make the question a little more specific so I can guide you to the right section.";
};

const buildIntentReply = ({ language = "en", role = "guest", intent = "" }) => {
  const isFa = language === "fa";

  if (intent === "platformOverview") {
    return isFa
      ? buildPremiumSupportReply({
        language,
        answer: "EduTech یک پلتفرم آموزشی آنلاین است که در آن می‌توانید کورس‌ها را ببینید، با مدرسان آشنا شوید، حساب بسازید، وارد شوید و مسیر یادگیری خود را از داخل پلتفرم ادامه دهید.",
        whereToGo: "اگر تازه وارد هستید، بهتر است از صفحه‌های کورس‌ها و مدرسان شروع کنید.",
        nextStep: "اگر بخواهید، می‌توانم بعدی برایتان بگویم چطور ثبت نام کنید یا چه کورس‌هایی موجود است.",
      })
      : buildPremiumSupportReply({
        language,
        answer: "EduTech is an online learning platform where users can explore courses, view teachers, create an account, sign in, and continue their learning from inside the platform.",
        whereToGo: "If you are new here, a good start is the Courses page or the Teachers page.",
        nextStep: "If you want, I can next explain how to register or what courses are available.",
      });
  }

  if (intent === "usePlatform") {
    return isFa
      ? buildPremiumSupportReply({
        language,
        answer: "برای استفاده از EduTech، معمولاً ابتدا حساب می‌سازید یا وارد می‌شوید، بعد کورس‌ها را بررسی می‌کنید و از بخش‌های مربوط مثل کورس‌ها، صنف زنده، تمرین‌ها، منابع و پرداخت‌ها استفاده می‌کنید.",
        whereToGo: role === "guest"
          ? "اگر تازه شروع می‌کنید، از صفحه ثبت نام، ورود یا کورس‌ها آغاز کنید."
          : "اگر داخل حساب هستید، از داشبورد و سپس بخش‌های مربوط مثل کورس‌ها، تمرین‌ها یا صنف زنده شروع کنید.",
        nextStep: "اگر بخواهید، می‌توانم دقیق‌تر بگویم برای نقش شما از کدام بخش شروع بهتر است.",
      })
      : buildPremiumSupportReply({
        language,
        answer: "To use EduTech, you normally start by creating an account or signing in, then explore courses and use the related sections such as courses, live classes, assignments, resources, and payments.",
        whereToGo: role === "guest"
          ? "If you are just getting started, begin with the Register, Login, or Courses page."
          : "If you are already signed in, start from your dashboard and then open the section you need, such as Courses, Assignments, or Live Class.",
        nextStep: "If you want, I can explain the best starting path for your role more clearly.",
      });
  }

  if (intent === "coursesOverview") {
    return isFa
      ? buildPremiumSupportReply({
        language,
        answer: "EduTech آموزش را از طریق کورس‌های منتشرشده در پلتفرم ارائه می‌کند. شما می‌توانید کورس‌های موجود را ببینید، توضیحات هر کورس را بخوانید، سطح و زبان آن را بررسی کنید و سپس کورس مناسب خود را انتخاب کنید.",
        whereToGo: "برای شروع، بخش کورس‌ها یا صفحه جزئیات هر کورس بهترین جا است.",
        nextStep: "اگر بخواهید، می‌توانم توضیح بدهم کورس‌ها را از کدام بخش پیدا کنید.",
      })
      : buildPremiumSupportReply({
        language,
        answer: "EduTech teaches through the courses published on the platform. You can browse available courses, read each course description, check the level and language, and then choose the course that fits you best.",
        whereToGo: "A good place to start is the Courses area or any Course Details page.",
        nextStep: "If you want, I can also explain where to find those courses in the platform.",
      });
  }

  if (intent === "joinPlatform") {
    return isFa
      ? buildPremiumSupportReply({
        language,
        answer: "برای شروع در EduTech، ابتدا صفحه ثبت نام را باز کنید و حساب خود را بسازید. بعد از ثبت نام یا ورود، می‌توانید کورس‌ها را ببینید و اگر کورسی مناسب شما بود، مراحل ثبت‌نام در کورس یا پرداخت را از همان داخل پلتفرم ادامه دهید.",
        whereToGo: "برای این کار، از صفحه ثبت نام و بعد از آن بخش کورس‌ها استفاده کنید.",
        nextStep: "اگر بخواهید، قدم بعدی را هم دقیق‌تر برایتان می‌گویم.",
      })
      : buildPremiumSupportReply({
        language,
        answer: "To join EduTech, first open the Register page and create your account. After you register or sign in, you can explore the courses and continue with the course enrollment or payment steps directly in the platform.",
        whereToGo: "Start with the Register page, then move to the Courses area.",
        nextStep: "If you want, I can also walk you through the next step more clearly.",
      });
  }

  if (intent === "loginHelp") {
    return isFa
      ? buildPremiumSupportReply({
        language,
        answer: "برای ورود، صفحه ورود را باز کنید و از معلومات حساب خود یا ورود با Google استفاده کنید. اگر هنوز حساب ندارید، ابتدا از صفحه ثبت نام حساب بسازید.",
        whereToGo: "بخش درست برای این کار صفحه ورود یا صفحه ثبت نام است.",
        nextStep: "اگر مشکل ورود دارید، می‌توانم گزینه‌های بعدی را هم توضیح بدهم.",
      })
      : buildPremiumSupportReply({
        language,
        answer: "To sign in, open the Login page and use your account details or Google sign-in if it is available. If you do not have an account yet, start from the Register page first.",
        whereToGo: "The right place for this is the Login page or the Register page.",
        nextStep: "If you are having trouble signing in, I can explain the next options too.",
      });
  }

  if (intent === "supportHelp") {
    return isFa
      ? buildPremiumSupportReply({
        language,
        answer: "برای دریافت کمک، صفحه تماس با ما یا بخش پشتیبانی EduTech را باز کنید. آنجا می‌توانید برای مشکلات حساب، کورس‌ها یا پرداخت‌ها کمک بگیرید.",
        whereToGo: "بهترین بخش برای این کار صفحه تماس با ما است.",
        nextStep: "اگر بخواهید، می‌توانم بگویم بهتر است از کدام بخش شروع کنید.",
      })
      : buildPremiumSupportReply({
        language,
        answer: "For help, open the EduTech Contact or support section. That is the right place for account, course, or payment issues.",
        whereToGo: "The best place to start is the Contact page.",
        nextStep: "If you want, I can also tell you the best next step.",
      });
  }

  return null;
};

const detectMessageLanguage = (text = "") => /[\u0600-\u06FF]/.test(String(text || "")) ? "fa" : "en";

const scoreTextAgainstTerms = (text = "", terms = []) => {
  const normalized = normalizeText(text);
  if (!normalized) return 0;

  return terms.reduce((score, term) => {
    const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "g");
    const matches = normalized.match(regex);
    return score + (matches ? matches.length : 0);
  }, 0);
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const buildActorContext = (user) => {
  if (!user) {
    return "Current user role: guest visitor. The user is not signed in.";
  }

  const role = String(user?.role || "guest").trim() || "guest";
  const name = String(user?.name || "").trim() || role;
  const email = String(user?.email || "").trim() || "unknown";
  return `Current user role: ${role}. Name: ${name}. Email: ${email}.`;
};

const createSnippet = ({ scopeId = "", label = "", text = "", priority = 1 }) => ({
  scopeId: String(scopeId || "").trim(),
  label: String(label || "").trim(),
  text: String(text || "").trim().slice(0, 1400),
  priority: Number(priority || 1),
});

const humanizeIdentifier = (value = "") =>
  String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_/]/g, " ")
    .replace(/\b(JSX|JS|TSX|TS)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const toRelativeFrontendPath = (filePath = "") => path.relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");

const resolveFrontendSourceRoot = (app = "frontend") => {
  if (app === "teacher") return TEACHER_FRONTEND_ROOT;
  if (app === "admin") return ADMIN_FRONTEND_ROOT;
  return FRONTEND_ROOT;
};

const extractUiFeaturesFromSource = (source = "") => {
  const componentNames = Array.from(
    new Set(
      [...String(source || "").matchAll(/<([A-Z][A-Za-z0-9]+)/g)]
        .map((match) => match[1])
        .filter((name) => !["Route", "Routes", "Navigate", "Suspense", "ProtectedRoute", "AuthRoute"].includes(name)),
    ),
  );

  return componentNames
    .slice(0, 8)
    .map((name) =>
      humanizeIdentifier(name)
        .replace(/\b(Card|Modal|Page|Section|Table|Tabs|Panel|Preview)\b/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
};

const walkFiles = async (dirPath) => {
  const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath);
    }
    return fullPath;
  }));

  return files.flat();
};

const getFrontendKnowledgeSignature = async () => {
  const fileGroups = await Promise.all(FRONTEND_SOURCE_ROOTS.map((rootPath) => walkFiles(rootPath)));
  const files = fileGroups
    .flat()
    .filter((filePath) => /\.(jsx|js)$/.test(filePath))
    .sort();

  const stats = await Promise.all(
    files.map(async (filePath) => {
      const details = await stat(filePath).catch(() => null);
      if (!details) return null;
      return `${toRelativeFrontendPath(filePath)}:${details.mtimeMs}`;
    }),
  );

  return stats.filter(Boolean).join("|");
};

const buildFrontendKnowledgeSnippets = async () => {
  const signature = await getFrontendKnowledgeSignature();
  if (
    frontendKnowledgeCache.value &&
    frontendKnowledgeCache.signature === signature &&
    frontendKnowledgeCache.expiresAt > Date.now()
  ) {
    return frontendKnowledgeCache.value;
  }

  const definitions = await Promise.all(
    FRONTEND_PAGE_DEFINITIONS.map(async (page) => {
      const sourceFile = path.join(resolveFrontendSourceRoot(page.app), page.file);
      const source = await readFile(sourceFile, "utf8").catch(() => "");
      const features = extractUiFeaturesFromSource(source);

      return {
        ...page,
        relativeFile: toRelativeFrontendPath(sourceFile),
        features,
      };
    }),
  );

  const value = {
    guest: definitions
      .filter((page) => page.audience === "guest")
      .map((page) =>
        createSnippet({
          scopeId: page.path,
          label: `frontend-page:${page.title}`,
          priority: 5,
          text: [
            `Frontend page: ${page.title} (${page.path})`,
            `Purpose: ${page.purpose}`,
            page.features.length ? `Visible functionality from current frontend source: ${page.features.join("; ")}` : "",
            `Source file: ${page.relativeFile}`,
          ].filter(Boolean).join(" | "),
        }),
      ),
    student: definitions
      .filter((page) => page.audience === "student")
      .map((page) =>
        createSnippet({
          scopeId: page.path,
          label: `frontend-page:${page.title}`,
          priority: 5,
          text: [
            `Frontend page: ${page.title} (${page.path})`,
            `Purpose: ${page.purpose}`,
            page.features.length ? `Visible functionality from current frontend source: ${page.features.join("; ")}` : "",
            `Source file: ${page.relativeFile}`,
          ].filter(Boolean).join(" | "),
        }),
      ),
    teacher: definitions
      .filter((page) => page.audience === "teacher")
      .map((page) =>
        createSnippet({
          scopeId: page.path,
          label: `frontend-page:${page.title}`,
          priority: 5,
          text: [
            `Frontend page: ${page.title} (${page.path})`,
            `Purpose: ${page.purpose}`,
            page.features.length ? `Visible functionality from current frontend source: ${page.features.join("; ")}` : "",
            `Source file: ${page.relativeFile}`,
          ].filter(Boolean).join(" | "),
        }),
      ),
    admin: definitions
      .filter((page) => page.audience === "admin")
      .map((page) =>
        createSnippet({
          scopeId: page.path,
          label: `frontend-page:${page.title}`,
          priority: 5,
          text: [
            `Frontend page: ${page.title} (${page.path})`,
            `Purpose: ${page.purpose}`,
            page.features.length ? `Visible functionality from current frontend source: ${page.features.join("; ")}` : "",
            `Source file: ${page.relativeFile}`,
          ].filter(Boolean).join(" | "),
        }),
      ),
  };

  frontendKnowledgeCache.value = value;
  frontendKnowledgeCache.signature = signature;
  frontendKnowledgeCache.expiresAt = Date.now() + FRONTEND_KNOWLEDGE_CACHE_TTL_MS;

  return value;
};

const getCachedRoleContext = (cacheKey = "", signature = "") => {
  const normalizedKey = String(cacheKey || "").trim();
  if (!normalizedKey) return null;

  const cached = roleContextCache.get(normalizedKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    roleContextCache.delete(normalizedKey);
    return null;
  }
  if (signature && cached.signature && cached.signature !== signature) {
    roleContextCache.delete(normalizedKey);
    return null;
  }

  return cached.value;
};

const setCachedRoleContext = (cacheKey = "", value, signature = "") => {
  const normalizedKey = String(cacheKey || "").trim();
  if (!normalizedKey || !value) return value;

  roleContextCache.set(normalizedKey, {
    value,
    signature: String(signature || "").trim(),
    expiresAt: Date.now() + ROLE_CONTEXT_CACHE_TTL_MS,
  });

  if (roleContextCache.size > 200) {
    const oldestKey = roleContextCache.keys().next().value;
    if (oldestKey) roleContextCache.delete(oldestKey);
  }

  return value;
};

const getCachedRoleSignature = (cacheKey = "") => {
  const normalizedKey = String(cacheKey || "").trim();
  if (!normalizedKey) return null;

  const cached = roleContextSignatureCache.get(normalizedKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    roleContextSignatureCache.delete(normalizedKey);
    return null;
  }

  return cached.value;
};

const setCachedRoleSignature = (cacheKey = "", value = "") => {
  const normalizedKey = String(cacheKey || "").trim();
  const normalizedValue = String(value || "").trim();
  if (!normalizedKey || !normalizedValue) return normalizedValue;

  roleContextSignatureCache.set(normalizedKey, {
    value: normalizedValue,
    expiresAt: Date.now() + ROLE_CONTEXT_SIGNATURE_CACHE_TTL_MS,
  });

  if (roleContextSignatureCache.size > 200) {
    const oldestKey = roleContextSignatureCache.keys().next().value;
    if (oldestKey) roleContextSignatureCache.delete(oldestKey);
  }

  return normalizedValue;
};

const formatFreshnessValue = (value) => {
  if (!value) return "0";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "0";
  return date.toISOString();
};

const getLatestUpdatedAt = async (Model, filter = {}) => {
  const latest = await Model.findOne(filter)
    .sort({ updatedAt: -1 })
    .select("updatedAt")
    .lean();

  return formatFreshnessValue(latest?.updatedAt);
};

const getRoleContextSignature = async ({ user, cacheKey }) => {
  const cachedSignature = getCachedRoleSignature(cacheKey);
  if (cachedSignature) return cachedSignature;

  let signature = "guest:none";

  if (!user) {
    const [publishedCourses, approvedTeachers, activeCategories] = await Promise.all([
      Course.countDocuments({ status: "published", isPublished: true }),
      User.countDocuments({ role: "teacher", status: "active", "teacherApplication.status": "approved" }),
      Category.countDocuments({ isActive: true }),
    ]);
    const [courseUpdatedAt, teacherUpdatedAt, categoryUpdatedAt] = await Promise.all([
      getLatestUpdatedAt(Course, { status: "published", isPublished: true }),
      getLatestUpdatedAt(User, { role: "teacher", status: "active", "teacherApplication.status": "approved" }),
      getLatestUpdatedAt(Category, { isActive: true }),
    ]);

    signature = [
      "guest",
      publishedCourses,
      approvedTeachers,
      activeCategories,
      courseUpdatedAt,
      teacherUpdatedAt,
      categoryUpdatedAt,
    ].join(":");
    return setCachedRoleSignature(cacheKey, signature);
  }

  if (user.role === "student") {
    const enrollments = await Enrollment.find({
      studentId: user?._id,
      enrollmentStatus: { $in: ["active", "completed"] },
      accessStatus: "allowed",
    })
      .select("courseId updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    const courseIds = Array.from(
      new Set((enrollments || []).map((row) => String(row?.courseId || "")).filter(Boolean)),
    );

    const enrollmentUpdatedAt = formatFreshnessValue(enrollments[0]?.updatedAt);

    if (!courseIds.length) {
      signature = ["student", String(user?._id || ""), 0, enrollmentUpdatedAt].join(":");
      return setCachedRoleSignature(cacheKey, signature);
    }

    const [courseUpdatedAt, assignmentUpdatedAt, resourceUpdatedAt, sessionUpdatedAt] = await Promise.all([
      getLatestUpdatedAt(Course, { _id: { $in: courseIds } }),
      getLatestUpdatedAt(Assignment, { courseId: { $in: courseIds } }),
      getLatestUpdatedAt(CourseResource, { courseId: { $in: courseIds } }),
      getLatestUpdatedAt(LiveSession, { courseId: { $in: courseIds } }),
    ]);

    signature = [
      "student",
      String(user?._id || ""),
      courseIds.length,
      enrollmentUpdatedAt,
      courseUpdatedAt,
      assignmentUpdatedAt,
      resourceUpdatedAt,
      sessionUpdatedAt,
    ].join(":");
    return setCachedRoleSignature(cacheKey, signature);
  }

  if (user.role === "teacher") {
    const ownedCourses = await Course.find({
      $or: [{ teacher: user?._id }, { teacherId: user?._id }, { createdBy: user?._id }],
    })
      .select("_id updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    const courseIds = ownedCourses.map((course) => course._id).filter(Boolean);
    const courseUpdatedAt = formatFreshnessValue(ownedCourses[0]?.updatedAt);

    const [assignmentUpdatedAt, sessionUpdatedAt, enrollmentUpdatedAt] = await Promise.all([
      getLatestUpdatedAt(Assignment, { teacherId: user?._id }),
      getLatestUpdatedAt(LiveSession, { teacherId: user?._id }),
      courseIds.length ? getLatestUpdatedAt(Enrollment, { courseId: { $in: courseIds } }) : Promise.resolve("0"),
    ]);

    signature = [
      "teacher",
      String(user?._id || ""),
      courseIds.length,
      courseUpdatedAt,
      assignmentUpdatedAt,
      sessionUpdatedAt,
      enrollmentUpdatedAt,
    ].join(":");
    return setCachedRoleSignature(cacheKey, signature);
  }

  if (user.role === "admin") {
    const [
      usersUpdatedAt,
      coursesUpdatedAt,
      categoriesUpdatedAt,
      paymentsUpdatedAt,
      settingsUpdatedAt,
    ] = await Promise.all([
      getLatestUpdatedAt(User),
      getLatestUpdatedAt(Course),
      getLatestUpdatedAt(Category),
      getLatestUpdatedAt(Payment),
      getLatestUpdatedAt(AppSetting),
    ]);

    signature = [
      "admin",
      usersUpdatedAt,
      coursesUpdatedAt,
      categoriesUpdatedAt,
      paymentsUpdatedAt,
      settingsUpdatedAt,
    ].join(":");
    return setCachedRoleSignature(cacheKey, signature);
  }

  const [publishedCourses, approvedTeachers, activeCategories] = await Promise.all([
    Course.countDocuments({ status: "published", isPublished: true }),
    User.countDocuments({ role: "teacher", status: "active", "teacherApplication.status": "approved" }),
    Category.countDocuments({ isActive: true }),
  ]);
  const [courseUpdatedAt, teacherUpdatedAt, categoryUpdatedAt] = await Promise.all([
    getLatestUpdatedAt(Course, { status: "published", isPublished: true }),
    getLatestUpdatedAt(User, { role: "teacher", status: "active", "teacherApplication.status": "approved" }),
    getLatestUpdatedAt(Category, { isActive: true }),
  ]);

  signature = [
    "guest",
    publishedCourses,
    approvedTeachers,
    activeCategories,
    courseUpdatedAt,
    teacherUpdatedAt,
    categoryUpdatedAt,
  ].join(":");
  return setCachedRoleSignature(cacheKey, signature);
};

const getRoleContextBaseWithCache = async ({ cacheKey, user, builder }) => {
  const signature = await getRoleContextSignature({ user, cacheKey });
  const cached = getCachedRoleContext(cacheKey, signature);
  if (cached) return cached;

  return setCachedRoleContext(cacheKey, await builder(), signature);
};

const selectTopSnippets = ({ snippets = [], terms = [], preferredScopeId = "" }) => {
  const ranked = snippets
    .filter((snippet) => snippet.text)
    .map((snippet) => {
      const textScore = scoreTextAgainstTerms(snippet.text, terms);
      const labelScore = scoreTextAgainstTerms(snippet.label, terms) * 2;
      const preferredBoost = preferredScopeId && snippet.scopeId === preferredScopeId ? 8 : 0;
      return {
        ...snippet,
        score: textScore + labelScore + preferredBoost + Number(snippet.priority || 0),
      };
    })
    .sort((a, b) => b.score - a.score)
    .filter((snippet, index) => snippet.score > 0 || index < 5);

  const selected = [];
  let totalChars = 0;

  for (const snippet of ranked) {
    if (selected.length >= MAX_GROUNDING_SNIPPETS) break;
    if (totalChars + snippet.text.length > MAX_GROUNDING_CHARS && selected.length > 0) break;
    selected.push(snippet);
    totalChars += snippet.text.length;
  }

  return selected;
};

const buildGroundingText = ({ user, role, pageContext, primaryTitle, scopeLabel, snippets }) => {
  const lines = [buildActorContext(user)];

  if (pageContext?.path || pageContext?.pageTitle) {
    lines.push(
      `Current page: ${pageContext?.pageTitle || pageContext?.path || "unknown"}${
        pageContext?.path ? ` (${pageContext.path})` : ""
      }`,
    );
  }

  lines.push(`Platform support scope: ${scopeLabel || role || "general"}.`);

  if (primaryTitle) {
    lines.push(`Primary relevant platform item: ${primaryTitle}`);
  }

  if (Array.isArray(snippets) && snippets.length) {
    lines.push("Relevant EduTech context:");
    snippets.forEach((snippet, index) => {
      lines.push(`${index + 1}. ${snippet.text}`);
    });
  } else {
    lines.push("No matching internal EduTech context was found for this request.");
  }

  return lines.join("\n");
};

const getPlatformSummaryData = async () => {
  if (platformSummaryCache.value && platformSummaryCache.expiresAt > Date.now()) {
    return platformSummaryCache.value;
  }

  const [publishedCourses, approvedTeachers, activeStudents, categories] = await Promise.all([
    Course.countDocuments({ status: "published", isPublished: true }),
    User.countDocuments({ role: "teacher", status: "active", "teacherApplication.status": "approved" }),
    User.countDocuments({ role: "student", status: "active", isEmailVerified: true }),
    Category.countDocuments({ isActive: true }),
  ]);

  const value = {
    publishedCourses,
    approvedTeachers,
    activeStudents,
    categories,
  };

  platformSummaryCache.value = value;
  platformSummaryCache.expiresAt = Date.now() + PLATFORM_SUMMARY_CACHE_TTL_MS;

  return value;
};

const createPlatformSummarySnippet = (summary = {}) =>
  createSnippet({
    label: "platform-summary",
    priority: 6,
    text: [
      `Total published courses currently available on EduTech: ${Number(summary?.publishedCourses || 0)}`,
      `Approved teachers currently visible on EduTech: ${Number(summary?.approvedTeachers || 0)}`,
      `Active verified students on EduTech: ${Number(summary?.activeStudents || 0)}`,
      `Active course categories on EduTech: ${Number(summary?.categories || 0)}`,
    ].join(" | "),
  });

const createRoleGuideSnippet = (role = "guest") => {
  const guides = {
    guest: "EduTech public help topics include creating an account, logging in, exploring published courses, viewing teacher profiles, understanding how the platform works, and contacting support.",
    student: "EduTech student help topics include using the dashboard, viewing enrolled courses, joining live classes, checking assignments, opening resources, viewing certificates, checking payments, sending messages, and updating profile or settings.",
    teacher: "EduTech teacher help topics include managing the dashboard, creating or editing courses, reviewing students, handling live classes, tracking attendance, managing assignments and resources, checking reports or income, and updating profile or settings.",
    admin: "EduTech admin help topics include managing students, teachers, courses, categories, orders, payments, messages, reports, Telegram settings, and overall platform settings from the admin panel.",
  };

  return createSnippet({
    label: `${role}-platform-guide`,
    priority: 7,
    text: guides[role] || guides.guest,
  });
};

const createCuratedKnowledgeSnippets = (role = "guest") =>
  (CURATED_PLATFORM_KNOWLEDGE[role] || []).map((text, index) =>
    createSnippet({
      label: `${role}-knowledge-${index + 1}`,
      priority: 6,
      text,
    }),
  );

const finalizeRoleContext = ({
  baseContext,
  terms = [],
  preferredScopeId = "",
}) => {
  const snippets = selectTopSnippets({
    snippets: Array.isArray(baseContext?.snippets) ? baseContext.snippets : [],
    terms,
    preferredScopeId,
  });

  const primaryTitle =
    (preferredScopeId && baseContext?.primaryTitlesByScopeId?.[String(preferredScopeId)]) ||
    (snippets[0]?.scopeId && baseContext?.primaryTitlesByScopeId?.[String(snippets[0].scopeId)]) ||
    String(baseContext?.defaultPrimaryTitle || "").trim();

  return {
    role: String(baseContext?.role || "guest"),
    scopeLabel: String(baseContext?.scopeLabel || "general"),
    primaryTitle,
    snippets,
  };
};

const getStudentContextBase = async ({ user }) => {
  const platformSummary = await getPlatformSummaryData();
  const frontendKnowledge = await buildFrontendKnowledgeSnippets();
  const now = new Date();
  const enrollments = await Enrollment.find({
    studentId: user?._id,
    enrollmentStatus: { $in: ["active", "completed"] },
    accessStatus: "allowed",
    $or: [
      { accessExpiresAt: { $exists: false } },
      { accessExpiresAt: null },
      { accessExpiresAt: { $gt: now } },
    ],
  })
    .select("courseId")
    .sort({ createdAt: -1 })
    .lean();

  const courseIds = Array.from(
    new Set((enrollments || []).map((row) => String(row?.courseId || "")).filter(Boolean)),
  );

  if (!courseIds.length) {
    return {
      role: "student",
      scopeLabel: "student learning and enrolled courses",
      snippets: [],
      primaryTitlesByScopeId: {},
      defaultPrimaryTitle: "",
    };
  }

  const [courses, assignments, resources, sessions] = await Promise.all([
    Course.find({ _id: { $in: courseIds } })
      .select("title shortDescription description whatYouWillLearn curriculumTopics requirements targetAudience language level")
      .lean(),
    Assignment.find({
      courseId: { $in: courseIds },
      status: { $in: ["published", "closed"] },
    })
      .select("courseId title description type status dueAt")
      .populate("courseId", "title")
      .sort({ dueAt: 1, createdAt: -1 })
      .limit(16)
      .lean(),
    CourseResource.find({ courseId: { $in: courseIds } })
      .select("courseId title module type createdAt")
      .populate("courseId", "title")
      .sort({ createdAt: -1 })
      .limit(16)
      .lean(),
    LiveSession.find({
      courseId: { $in: courseIds },
      status: { $in: ["scheduled", "live", "completed"] },
    })
      .select("courseId title description status startAt")
      .populate("courseId", "title")
      .sort({ startAt: -1 })
      .limit(12)
      .lean(),
  ]);

  const snippets = [];
  const primaryTitlesByScopeId = {};
  snippets.push(createRoleGuideSnippet("student"));
  snippets.push(createPlatformSummarySnippet(platformSummary));
  snippets.push(...createCuratedKnowledgeSnippets("student"));
  snippets.push(...(frontendKnowledge.student || []));

  courses.forEach((course) => {
    const scopeId = String(course?._id || "");
    if (scopeId && course?.title) {
      primaryTitlesByScopeId[scopeId] = course.title;
    }
    snippets.push(
      createSnippet({
        scopeId,
        label: `student-course:${course?.title || "course"}`,
        priority: 5,
        text: [
          course?.title ? `Course: ${course.title}` : "",
          course?.shortDescription ? `Short description: ${course.shortDescription}` : "",
          course?.description ? `Description: ${course.description}` : "",
          Array.isArray(course?.whatYouWillLearn) && course.whatYouWillLearn.length
            ? `Learning outcomes: ${course.whatYouWillLearn.slice(0, 6).join("; ")}`
            : "",
          Array.isArray(course?.curriculumTopics) && course.curriculumTopics.length
            ? `Curriculum topics: ${course.curriculumTopics.slice(0, 8).join("; ")}`
            : "",
          course?.language ? `Language: ${course.language}` : "",
          course?.level ? `Level: ${course.level}` : "",
        ].filter(Boolean).join(" | "),
      }),
    );
  });

  assignments.forEach((assignment) => {
    snippets.push(
      createSnippet({
        scopeId: String(assignment?.courseId?._id || assignment?.courseId || ""),
        label: `student-assignment:${assignment?.title || "assignment"}`,
        priority: 4,
        text: [
          assignment?.courseId?.title ? `Course: ${assignment.courseId.title}` : "",
          assignment?.title ? `Assignment: ${assignment.title}` : "",
          assignment?.type ? `Type: ${assignment.type}` : "",
          assignment?.status ? `Status: ${assignment.status}` : "",
          assignment?.dueAt ? `Due date: ${formatDate(assignment.dueAt)}` : "",
          assignment?.description ? `Details: ${assignment.description}` : "",
        ].filter(Boolean).join(" | "),
      }),
    );
  });

  resources.forEach((resource) => {
    snippets.push(
      createSnippet({
        scopeId: String(resource?.courseId?._id || resource?.courseId || ""),
        label: `student-resource:${resource?.title || "resource"}`,
        priority: 3,
        text: [
          resource?.courseId?.title ? `Course: ${resource.courseId.title}` : "",
          resource?.title ? `Resource: ${resource.title}` : "",
          resource?.module ? `Module: ${resource.module}` : "",
          resource?.type ? `Type: ${resource.type}` : "",
        ].filter(Boolean).join(" | "),
      }),
    );
  });

  sessions.forEach((session) => {
    snippets.push(
      createSnippet({
        scopeId: String(session?.courseId?._id || session?.courseId || ""),
        label: `student-session:${session?.title || "session"}`,
        priority: 2,
        text: [
          session?.courseId?.title ? `Course: ${session.courseId.title}` : "",
          session?.title ? `Live session: ${session.title}` : "",
          session?.status ? `Status: ${session.status}` : "",
          session?.startAt ? `Start date: ${formatDate(session.startAt)}` : "",
          session?.description ? `Description: ${session.description}` : "",
        ].filter(Boolean).join(" | "),
      }),
    );
  });

  return {
    role: "student",
    scopeLabel: "student learning and enrolled courses",
    snippets,
    primaryTitlesByScopeId,
    defaultPrimaryTitle: courses[0]?.title || "",
  };
};

const getTeacherContextBase = async ({ user }) => {
  const platformSummary = await getPlatformSummaryData();
  const frontendKnowledge = await buildFrontendKnowledgeSnippets();
  const ownedCourses = await Course.find({
    $or: [{ teacher: user?._id }, { teacherId: user?._id }, { createdBy: user?._id }],
  })
    .select("title shortDescription description curriculumTopics whatYouWillLearn language level enrolledStudentsCount status")
    .sort({ updatedAt: -1 })
    .limit(16)
    .lean();

  const courseIds = ownedCourses.map((course) => course._id);

  const [assignments, sessions, enrollments] = courseIds.length
    ? await Promise.all([
      Assignment.find({
        teacherId: user?._id,
        courseId: { $in: courseIds },
      })
        .select("courseId title description type status dueAt")
        .populate("courseId", "title")
        .sort({ createdAt: -1 })
        .limit(16)
        .lean(),
      LiveSession.find({
        teacherId: user?._id,
        courseId: { $in: courseIds },
      })
        .select("courseId title description status startAt")
        .populate("courseId", "title")
        .sort({ startAt: -1 })
        .limit(12)
        .lean(),
      Enrollment.find({
        courseId: { $in: courseIds },
      }).select("courseId enrollmentStatus accessStatus"),
    ])
    : [[], [], []];

  const enrollmentSummary = new Map();
  (enrollments || []).forEach((row) => {
    const key = String(row?.courseId || "");
    const current = enrollmentSummary.get(key) || { total: 0, active: 0 };
    current.total += 1;
    if (row?.enrollmentStatus === "active" && row?.accessStatus === "allowed") {
      current.active += 1;
    }
    enrollmentSummary.set(key, current);
  });

  const snippets = [];
  const primaryTitlesByScopeId = {};
  snippets.push(createRoleGuideSnippet("teacher"));
  snippets.push(createPlatformSummarySnippet(platformSummary));
  snippets.push(...createCuratedKnowledgeSnippets("teacher"));
  snippets.push(...(frontendKnowledge.teacher || []));

  ownedCourses.forEach((course) => {
    const summary = enrollmentSummary.get(String(course?._id || "")) || { total: 0, active: 0 };
    const scopeId = String(course?._id || "");
    if (scopeId && course?.title) {
      primaryTitlesByScopeId[scopeId] = course.title;
    }
    snippets.push(
      createSnippet({
        scopeId,
        label: `teacher-course:${course?.title || "course"}`,
        priority: 5,
        text: [
          course?.title ? `Course: ${course.title}` : "",
          course?.status ? `Status: ${course.status}` : "",
          course?.shortDescription ? `Short description: ${course.shortDescription}` : "",
          course?.description ? `Description: ${course.description}` : "",
          course?.language ? `Language: ${course.language}` : "",
          course?.level ? `Level: ${course.level}` : "",
          `Enrolled students: ${Number(course?.enrolledStudentsCount || summary.total || 0)}`,
          `Active access students: ${Number(summary.active || 0)}`,
        ].filter(Boolean).join(" | "),
      }),
    );
  });

  assignments.forEach((assignment) => {
    snippets.push(
      createSnippet({
        scopeId: String(assignment?.courseId?._id || assignment?.courseId || ""),
        label: `teacher-assignment:${assignment?.title || "assignment"}`,
        priority: 4,
        text: [
          assignment?.courseId?.title ? `Course: ${assignment.courseId.title}` : "",
          assignment?.title ? `Assignment: ${assignment.title}` : "",
          assignment?.type ? `Type: ${assignment.type}` : "",
          assignment?.status ? `Status: ${assignment.status}` : "",
          assignment?.dueAt ? `Due date: ${formatDate(assignment.dueAt)}` : "",
          assignment?.description ? `Details: ${assignment.description}` : "",
        ].filter(Boolean).join(" | "),
      }),
    );
  });

  sessions.forEach((session) => {
    snippets.push(
      createSnippet({
        scopeId: String(session?.courseId?._id || session?.courseId || ""),
        label: `teacher-session:${session?.title || "session"}`,
        priority: 3,
        text: [
          session?.courseId?.title ? `Course: ${session.courseId.title}` : "",
          session?.title ? `Live class: ${session.title}` : "",
          session?.status ? `Status: ${session.status}` : "",
          session?.startAt ? `Start date: ${formatDate(session.startAt)}` : "",
          session?.description ? `Description: ${session.description}` : "",
        ].filter(Boolean).join(" | "),
      }),
    );
  });

  return {
    role: "teacher",
    scopeLabel: "teacher dashboard, courses, classes, assignments, and students",
    snippets,
    primaryTitlesByScopeId,
    defaultPrimaryTitle: ownedCourses[0]?.title || "",
  };
};

const getAdminContextBase = async () => {
  const frontendKnowledge = await buildFrontendKnowledgeSnippets();
  const [
    totalStudents,
    totalTeachers,
    totalAdmins,
    totalPublishedCourses,
    pendingCourses,
    blockedUsers,
    pendingVerifications,
    paidPayments,
    categories,
    appSetting,
  ] = await Promise.all([
    User.countDocuments({ role: "student" }),
    User.countDocuments({ role: "teacher" }),
    User.countDocuments({ role: "admin" }),
    Course.countDocuments({ status: "published", isPublished: true }),
    Course.find({ status: { $in: ["pending", "approved"] }, isPublished: false })
      .select("title status level language")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    User.countDocuments({ status: "blocked" }),
    User.countDocuments({ status: "pending_verification" }),
    Payment.countDocuments({ $or: [{ status: "paid" }, { paymentStatus: "paid" }] }),
    Category.find({ isActive: true }).select("name description").sort({ createdAt: -1 }).limit(8).lean(),
    AppSetting.getSingleton(),
  ]);

  const snippets = [
    createRoleGuideSnippet("admin"),
    ...createCuratedKnowledgeSnippets("admin"),
    ...(frontendKnowledge.admin || []),
    createPlatformSummarySnippet({
      publishedCourses: totalPublishedCourses,
      approvedTeachers: totalTeachers,
      activeStudents: totalStudents,
      categories: categories.length,
    }),
    createSnippet({
      label: "admin-platform-summary",
      priority: 6,
      text: [
        `Total students: ${totalStudents}`,
        `Total teachers: ${totalTeachers}`,
        `Total admins: ${totalAdmins}`,
        `Published courses: ${totalPublishedCourses}`,
        `Blocked users: ${blockedUsers}`,
        `Pending verifications: ${pendingVerifications}`,
        `Paid payments count: ${paidPayments}`,
        appSetting ? `Teacher deduction percentage: ${Number(appSetting.teacherDeductionPercentage || 0)}%` : "",
        appSetting ? `Minimum teacher course price: ${Number(appSetting.minTeacherCoursePrice || 0)} USD` : "",
      ].filter(Boolean).join(" | "),
    }),
  ];

  pendingCourses.forEach((course) => {
    snippets.push(
      createSnippet({
        scopeId: String(course?._id || ""),
        label: `admin-course:${course?.title || "course"}`,
        priority: 4,
        text: [
          course?.title ? `Course: ${course.title}` : "",
          course?.status ? `Status: ${course.status}` : "",
          course?.level ? `Level: ${course.level}` : "",
          course?.language ? `Language: ${course.language}` : "",
        ].filter(Boolean).join(" | "),
      }),
    );
  });

  categories.forEach((category) => {
    snippets.push(
      createSnippet({
        label: `admin-category:${category?.name || "category"}`,
        priority: 2,
        text: [
          category?.name ? `Category: ${category.name}` : "",
          category?.description ? `Description: ${category.description}` : "",
        ].filter(Boolean).join(" | "),
      }),
    );
  });

  return {
    role: "admin",
    scopeLabel: "admin dashboard, platform management, users, courses, and payments",
    snippets,
    primaryTitlesByScopeId: {},
    defaultPrimaryTitle: "EduTech admin platform overview",
  };
};

const getPublicContextBase = async () => {
  const [platformSummary, categories, courses, teachers, frontendKnowledge] = await Promise.all([
    getPlatformSummaryData(),
    Category.find({ isActive: true }).select("name description").sort({ createdAt: -1 }).limit(8).lean(),
    Course.find({ status: "published", isPublished: true })
      .select("title shortDescription description language level isFree price startDate")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    User.find({ role: "teacher", status: "active", "teacherApplication.status": "approved" })
      .select("name bio teacherApplication.professionalTitle teacherApplication.expertiseAreas teacherApplication.languages")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    buildFrontendKnowledgeSnippets(),
  ]);

  const snippets = [
    createRoleGuideSnippet("guest"),
    ...createCuratedKnowledgeSnippets("guest"),
    createPlatformSummarySnippet(platformSummary),
    ...(frontendKnowledge.guest || []),
  ];
  const primaryTitlesByScopeId = {};

  categories.forEach((category) => {
    snippets.push(
      createSnippet({
        label: `public-category:${category?.name || "category"}`,
        priority: 2,
        text: [
          category?.name ? `Category: ${category.name}` : "",
          category?.description ? `Description: ${category.description}` : "",
        ].filter(Boolean).join(" | "),
      }),
    );
  });

  courses.forEach((course) => {
    const scopeId = String(course?._id || "");
    if (scopeId && course?.title) {
      primaryTitlesByScopeId[scopeId] = course.title;
    }
    snippets.push(
      createSnippet({
        scopeId,
        label: `public-course:${course?.title || "course"}`,
        priority: 5,
        text: [
          course?.title ? `Course: ${course.title}` : "",
          course?.shortDescription ? `Short description: ${course.shortDescription}` : "",
          course?.description ? `Description: ${course.description}` : "",
          course?.language ? `Language: ${course.language}` : "",
          course?.level ? `Level: ${course.level}` : "",
          typeof course?.isFree === "boolean" ? `Pricing: ${course.isFree ? "Free" : `${Number(course.price || 0)} USD`}` : "",
          course?.startDate ? `Start date: ${formatDate(course.startDate)}` : "",
        ].filter(Boolean).join(" | "),
      }),
    );
  });

  teachers.forEach((teacher) => {
    snippets.push(
      createSnippet({
        label: `public-teacher:${teacher?.name || "teacher"}`,
        priority: 3,
        text: [
          teacher?.name ? `Teacher: ${teacher.name}` : "",
          teacher?.teacherApplication?.professionalTitle
            ? `Professional title: ${teacher.teacherApplication.professionalTitle}`
            : "",
          Array.isArray(teacher?.teacherApplication?.expertiseAreas) && teacher.teacherApplication.expertiseAreas.length
            ? `Expertise: ${teacher.teacherApplication.expertiseAreas.slice(0, 6).join("; ")}`
            : "",
          Array.isArray(teacher?.teacherApplication?.languages) && teacher.teacherApplication.languages.length
            ? `Languages: ${teacher.teacherApplication.languages.slice(0, 5).join("; ")}`
            : "",
          teacher?.bio ? `Bio: ${teacher.bio}` : "",
        ].filter(Boolean).join(" | "),
      }),
    );
  });

  return {
    role: "guest",
    scopeLabel: "public platform navigation, published courses, teachers, and categories",
    snippets,
    primaryTitlesByScopeId,
    defaultPrimaryTitle: "EduTech public platform",
  };
};

const buildRoleContext = async ({ user, messages, context }) => {
  const { terms } = getSearchTerms(messages);
  const preferredScopeId = String(context?.courseId || context?.path || "").split("?")[0].trim();

  if (!user) {
    const cacheKey = "guest";
    const baseContext = await getRoleContextBaseWithCache({
      cacheKey,
      user: null,
      builder: () => getPublicContextBase(),
    });
    return finalizeRoleContext({ baseContext, terms, preferredScopeId });
  }

  if (user.role === "student") {
    const cacheKey = `student:${String(user?._id || "")}`;
    const baseContext = await getRoleContextBaseWithCache({
      cacheKey,
      user,
      builder: () => getStudentContextBase({ user }),
    });
    return finalizeRoleContext({ baseContext, terms, preferredScopeId });
  }

  if (user.role === "teacher") {
    const cacheKey = `teacher:${String(user?._id || "")}`;
    const baseContext = await getRoleContextBaseWithCache({
      cacheKey,
      user,
      builder: () => getTeacherContextBase({ user }),
    });
    return finalizeRoleContext({ baseContext, terms, preferredScopeId });
  }

  if (user.role === "admin") {
    const cacheKey = `admin:${String(user?._id || "")}`;
    const baseContext = await getRoleContextBaseWithCache({
      cacheKey,
      user,
      builder: () => getAdminContextBase(),
    });
    return finalizeRoleContext({ baseContext, terms, preferredScopeId });
  }

  const cacheKey = "guest";
  const baseContext = await getRoleContextBaseWithCache({
    cacheKey,
    user: null,
    builder: () => getPublicContextBase(),
  });
  return finalizeRoleContext({ baseContext, terms, preferredScopeId });
};

const detectDirectPlatformSummaryIntent = (messages = []) => {
  const latest = normalizeText(getLatestUserMessage(messages));
  if (!latest) return null;

  const asksHowMany =
    /(how many|number of|count of|total)/i.test(latest) ||
    /(چند|تعداد|مقدار|مجموع)/i.test(latest);

  if (!asksHowMany) return null;

  if (/\bcourse|courses|کورس|کورس ها|درس\b/i.test(latest)) {
    return "publishedCourses";
  }
  if (/\bteacher|teachers|مدرس|مدرسان|استاد|اساتید\b/i.test(latest)) {
    return "approvedTeachers";
  }
  if (/\bstudent|students|students|محصل|محصلان|شاگرد|شاگردان\b/i.test(latest)) {
    return "activeStudents";
  }
  if (/\bcategory|categories|دسته|دسته بندی|کتگوری\b/i.test(latest)) {
    return "categories";
  }

  return null;
};

const buildDirectPlatformSummaryReply = async ({ user, messages }) => {
  const metric = detectDirectPlatformSummaryIntent(messages);
  if (!metric) return null;

  const summary = await getPlatformSummaryData();
  const isFa = /(چند|تعداد|کورس|مدرس|محصل|شاگرد|دسته)/i.test(getLatestUserMessage(messages));
  const roleLabel = user?.role === "admin"
    ? (isFa ? "بر اساس داده‌های فعلی پنل ادمین" : "Based on the current admin data")
    : (isFa ? "بر اساس داده‌های فعلی پلتفرم" : "Based on the current platform data");

  if (metric === "publishedCourses") {
    return {
      reply: isFa
        ? `${roleLabel}، در حال حاضر ${Number(summary.publishedCourses || 0)} کورس منتشرشده در EduTech موجود است.`
        : `${roleLabel}, there are currently ${Number(summary.publishedCourses || 0)} published courses available on EduTech.`,
      model: "direct-platform-summary",
    };
  }

  if (metric === "approvedTeachers") {
    return {
      reply: isFa
        ? `${roleLabel}، در حال حاضر ${Number(summary.approvedTeachers || 0)} مدرس تاییدشده در EduTech موجود است.`
        : `${roleLabel}, there are currently ${Number(summary.approvedTeachers || 0)} approved teachers on EduTech.`,
      model: "direct-platform-summary",
    };
  }

  if (metric === "activeStudents") {
    return {
      reply: isFa
        ? `${roleLabel}، در حال حاضر ${Number(summary.activeStudents || 0)} محصل فعال و تاییدشده در EduTech وجود دارد.`
        : `${roleLabel}, there are currently ${Number(summary.activeStudents || 0)} active verified students on EduTech.`,
      model: "direct-platform-summary",
    };
  }

  if (metric === "categories") {
    return {
      reply: isFa
        ? `${roleLabel}، در حال حاضر ${Number(summary.categories || 0)} دسته‌بندی فعال در EduTech موجود است.`
        : `${roleLabel}, there are currently ${Number(summary.categories || 0)} active categories on EduTech.`,
      model: "direct-platform-summary",
    };
  }

  return null;
};

const matchFastFaqReply = ({ user, messages }) => {
  const latestMessage = getLatestUserMessage(messages);
  const normalized = normalizeText(latestMessage);
  if (!normalized) return null;

  const language = detectMessageLanguage(latestMessage);
  const role = resolveChatAudienceRole(user);
  const recentConversation = getRecentUserConversationText(messages);
  const combinedText = [recentConversation, normalized].filter(Boolean).join(" ");

  if (isVagueFollowUpMessage(latestMessage)) {
    return {
      reply: buildVagueFollowUpReply({ language, role, messages }),
      model: "fast-clarifier",
    };
  }

  for (const [intent, patterns] of Object.entries(PLATFORM_INTENT_PATTERNS)) {
    if (intent === "greeting") continue;
    if (matchesIntentPattern(combinedText, patterns)) {
      const reply = buildIntentReply({ language, role, intent });
      if (reply) {
        return {
          reply,
          model: "fast-intent",
        };
      }
    }
  }

  if (isShortGreetingLikeMessage(latestMessage) && matchesIntentPattern(normalized, PLATFORM_INTENT_PATTERNS.greeting)) {
    return {
      reply: buildGreetingReply(language, role),
      model: "fast-intent",
    };
  }

  const candidates = [
    ...(FAST_FAQ_LIBRARY[role] || []),
    ...(role === "guest" ? [] : FAST_FAQ_LIBRARY.guest || []),
  ];

  for (const item of candidates) {
    const matchesEnAll = Array.isArray(item.keywords) && item.keywords.every((keyword) => combinedText.includes(String(keyword)));
    const matchesFaAll = Array.isArray(item.keywordsFa) && item.keywordsFa.every((keyword) => combinedText.includes(normalizeText(keyword)));
    const matchesEnAny = Array.isArray(item.keywords) && item.keywords.some((keyword) => combinedText.includes(String(keyword)));
    const matchesFaAny = Array.isArray(item.keywordsFa) && item.keywordsFa.some((keyword) => combinedText.includes(normalizeText(keyword)));
    const matchesEn = matchesEnAll || (matchesEnAny && (item.keywords?.length || 0) === 1);
    const matchesFa = matchesFaAll || (matchesFaAny && (item.keywordsFa?.length || 0) === 1);
    if (matchesEn || matchesFa) {
      return {
        reply: language === "fa" ? item.replyFa : item.replyEn,
        model: "fast-faq",
      };
    }
  }

  return null;
};

const extractOllamaText = (payload = {}) =>
  [
    payload?.message?.content,
    payload?.response,
    payload?.content,
    payload?.output,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";

const requestOllamaReply = async ({ messages, groundingText }) => {
  const baseUrl = String(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").trim().replace(/\/+$/, "");
  const model = String(process.env.OLLAMA_CHAT_MODEL || "gemma3:4b").trim();

  if (!baseUrl) {
    throw new ApiError(503, "AI chat is not configured yet. Add OLLAMA_BASE_URL on the backend.");
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      keep_alive: OLLAMA_KEEP_ALIVE,
      options: OLLAMA_CHAT_OPTIONS,
      messages: [
        { role: "system", content: `${systemPrompt}\n${groundingText}` },
        ...messages,
      ],
    }),
  }).catch((error) => {
    throw new ApiError(
      503,
      `Local AI server is unavailable. Start Ollama and make sure it is running at ${baseUrl}. (${error.message})`,
    );
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status || 502, payload?.error || payload?.message || "Ollama request failed");
  }

  const reply = extractOllamaText(payload);
  if (!reply) {
    console.error("[ai-chat:ollama-empty-reply]", {
      model: payload?.model || model,
      payloadKeys: Object.keys(payload || {}),
      hasMessage: Boolean(payload?.message),
      done: payload?.done,
      doneReason: payload?.done_reason || payload?.doneReason || "",
    });
    throw new ApiError(502, "Local AI returned an empty response.");
  }

  return {
    reply,
    model: payload?.model || model,
  };
};

const requestOllamaReplyStream = async ({ messages, groundingText, onChunk }) => {
  const baseUrl = String(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").trim().replace(/\/+$/, "");
  const model = String(process.env.OLLAMA_CHAT_MODEL || "gemma3:4b").trim();

  if (!baseUrl) {
    throw new ApiError(503, "AI chat is not configured yet. Add OLLAMA_BASE_URL on the backend.");
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: true,
      keep_alive: OLLAMA_KEEP_ALIVE,
      options: OLLAMA_CHAT_OPTIONS,
      messages: [
        { role: "system", content: `${systemPrompt}\n${groundingText}` },
        ...messages,
      ],
    }),
  }).catch((error) => {
    throw new ApiError(
      503,
      `Local AI server is unavailable. Start Ollama and make sure it is running at ${baseUrl}. (${error.message})`,
    );
  });

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(response.status || 502, payload?.error || payload?.message || "Ollama request failed");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  let finalPayload = null;

  const flushLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return;
    const payload = JSON.parse(trimmed);
    finalPayload = payload;
    const delta = extractOllamaText(payload);
    if (delta) {
      reply += delta;
      onChunk(delta);
    }
  };

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    lines.forEach(flushLine);
  }

  if (buffer.trim()) {
    flushLine(buffer);
  }

  if (!reply.trim()) {
    const fallbackReply = extractOllamaText(finalPayload);
    if (fallbackReply) {
      reply = fallbackReply;
      onChunk(fallbackReply);
    }
  }

  if (!reply.trim()) {
    const fallback = await requestOllamaReply({ messages, groundingText }).catch(() => null);
    if (fallback?.reply) {
      return fallback;
    }
    console.error("[ai-chat:ollama-stream-empty-reply]", {
      model,
      finalPayloadKeys: Object.keys(finalPayload || {}),
      hasFinalMessage: Boolean(finalPayload?.message),
      finalDone: finalPayload?.done,
      finalDoneReason: finalPayload?.done_reason || finalPayload?.doneReason || "",
    });
    throw new ApiError(502, "Local AI returned an empty response.");
  }

  return {
    reply: reply.trim(),
    model,
  };
};

export const generatePlatformChatReply = async ({ user = null, messages = [], context = {} }) => {
  const normalizedMessages = getNormalizedMessages(messages);
  if (!normalizedMessages.length) {
    throw new ApiError(400, "Please send a message first.");
  }

  const latestUserMessage = getLatestUserMessage(normalizedMessages);
  const role = resolveChatAudienceRole(user);
  const language = detectMessageLanguage(latestUserMessage);

  if (!isPlatformQuestion({ text: latestUserMessage, role, messages: normalizedMessages })) {
    return {
      reply: buildPlatformOnlyRefusal(language, role),
      model: "platform-only-guard",
    };
  }

  const directReply = await buildDirectPlatformSummaryReply({
    user,
    messages: normalizedMessages,
  });
  if (directReply) {
    return directReply;
  }

  const fastFaqReply = matchFastFaqReply({
    user,
    messages: normalizedMessages,
  });
  if (fastFaqReply) {
    return fastFaqReply;
  }

  const normalizedContext = normalizeContext(context);
  const roleContext = await buildRoleContext({
    user,
    messages: normalizedMessages,
    context: normalizedContext,
  });
  const groundingText = buildGroundingText({
    user,
    role: roleContext.role,
    pageContext: normalizedContext,
    primaryTitle: roleContext.primaryTitle,
    scopeLabel: roleContext.scopeLabel,
    snippets: roleContext.snippets,
  });

  return requestOllamaReply({ messages: normalizedMessages, groundingText });
};

export const streamPlatformChatReply = async ({
  user = null,
  messages = [],
  context = {},
  onChunk = () => {},
}) => {
  const normalizedMessages = getNormalizedMessages(messages);
  if (!normalizedMessages.length) {
    throw new ApiError(400, "Please send a message first.");
  }

  const latestUserMessage = getLatestUserMessage(normalizedMessages);
  const role = resolveChatAudienceRole(user);
  const language = detectMessageLanguage(latestUserMessage);

  if (!isPlatformQuestion({ text: latestUserMessage, role, messages: normalizedMessages })) {
    const reply = buildPlatformOnlyRefusal(language, role);
    onChunk(reply);
    return { reply, model: "platform-only-guard" };
  }

  const directReply = await buildDirectPlatformSummaryReply({
    user,
    messages: normalizedMessages,
  });
  if (directReply) {
    onChunk(directReply.reply);
    return directReply;
  }

  const fastFaqReply = matchFastFaqReply({
    user,
    messages: normalizedMessages,
  });
  if (fastFaqReply) {
    onChunk(fastFaqReply.reply);
    return fastFaqReply;
  }

  const normalizedContext = normalizeContext(context);
  const roleContext = await buildRoleContext({
    user,
    messages: normalizedMessages,
    context: normalizedContext,
  });
  const groundingText = buildGroundingText({
    user,
    role: roleContext.role,
    pageContext: normalizedContext,
    primaryTitle: roleContext.primaryTitle,
    scopeLabel: roleContext.scopeLabel,
    snippets: roleContext.snippets,
  });

  return requestOllamaReplyStream({ messages: normalizedMessages, groundingText, onChunk });
};

export const generateStudentChatReply = generatePlatformChatReply;
