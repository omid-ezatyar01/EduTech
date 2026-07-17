import {
  BookOpen,
  ClipboardList,
  Award,
  Video,
  CreditCard,
  MessageCircle,
} from "lucide-react";
import StudentLayout from "./StudentLayout.jsx";
import DashboardStatCard from "./DashboardStatCard.jsx";
import TodayClassCard from "./TodayClassCard.jsx";
import MyCoursesCard from "./MyCoursesCard.jsx";
import UpcomingScheduleCard from "./UpcomingScheduleCard.jsx";
import AnnouncementsCard from "./AnnouncementsCard.jsx";
import AssignmentsCard from "./AssignmentsCard.jsx";
import PaymentsCard from "./PaymentsCard.jsx";
import ProgressCard from "./ProgressCard.jsx";
import { getAuthUser } from "../../services/portal";

const mockStudent = {
  id: "",
  name: "",
  nameFa: "",
  email: "",
  avatar: "",
  role: "",
  language: "fa",
};

const dashboardStats = [
  {
    title: "کورس‌های فعال",
    value: 1,
    icon: BookOpen,
    colorClass: "bg-primary-50 text-primary-600",
  },
  {
    title: "جلسات این هفته",
    value: 4,
    icon: Video,
    colorClass: "bg-green-50 text-green-600",
  },
  {
    title: "کورس‌های تکمیل‌شده",
    value: 2,
    icon: Award,
    colorClass: "bg-purple-50 text-purple-600",
  },
  {
    title: "مجموع پرداختی",
    value: "3,500 دالر",
    icon: CreditCard,
    colorClass: "bg-amber-50 text-amber-600",
  },
];

const courses = [
  {
    id: 1,
    title: "مکالمه انگلیسی",
    teacher: "سارا احمدی",
    progress: 42,
    status: "فعال",
    nextClass: "امروز، 18:00",
    meetLink: null,
  },
  {
    id: 2,
    title: "توسعه MERN Stack",
    teacher: "احمد رحیمی",
    progress: 0,
    status: "در انتظار تایید",
    nextClass: "در انتظار تایید",
    meetLink: null,
  },
];

const upcomingSchedule = [
  { course: "مکالمه انگلیسی", date: "امروز", time: "18:00" },
  { course: "مکالمه انگلیسی", date: "چهارشنبه", time: "18:00" },
  { course: "MERN Stack", date: "در انتظار تایید", time: "-" },
];

const announcements = [
  {
    text: "صنف مکالمه انگلیسی امروز ساعت 18:00 برگزار می‌شود",
    time: "1 ساعت پیش",
  },
  { text: "تمرین جدید برای مکالمه انگلیسی اضافه شد", time: "3 ساعت پیش" },
  { text: "ثبت‌نام کورس MERN Stack در انتظار تایید است", time: "1 روز پیش" },
  { text: "پرداخت شما برای مکالمه انگلیسی تایید شد", time: "2 روز پیش" },
];

const assignments = [
  {
    title: "معرفی خود به انگلیسی",
    deadline: "مهلت: جمعه",
    status: "در انتظار ارسال",
  },
  { title: "تمرین Listening جلسه دوم", deadline: "", status: "ارسال شده" },
];

const payments = [
  { title: "مکالمه انگلیسی", amount: "29 دالر", status: "پرداخت شده" },
  { title: "کورس MERN Stack", amount: "59 دالر", status: "در انتظار تایید" },
];

export default function StudentDashboard({ language = "fa" }) {
  const user = getAuthUser() || mockStudent;

  return (
    <StudentLayout language={language} user={user}>
      <div className="relative mb-8 overflow-hidden rounded-[32px] bg-white p-8 shadow-sm">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-teal-50 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-primary-50 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <h1 className="text-3xl font-black text-slate-950 md:text-4xl">
              سلام، {user.nameFa || user.name}!
            </h1>
            <p className="mt-4 max-w-2xl text-lg font-medium leading-8 text-slate-600">
              به داشبورد آموزشی خود خوش آمدید. از اینجا می‌توانید صنف‌های زنده،
              آنلاین، کورس‌ها، تمرین‌ها و پرداخت‌های خود را مدیریت کنید.
            </p>
          </div>
          <div className="hidden md:block">
            <img
              src="/hero-student.png"
              alt="Welcome Student"
              className="h-32 rounded-2xl object-cover shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
            />
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardStats.map((stat, idx) => (
          <DashboardStatCard key={idx} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <TodayClassCard course={courses[0]} />
        </div>
        <div className="lg:col-span-1">
          <MyCoursesCard courses={courses} />
        </div>
        <div className="lg:col-span-1">
          <UpcomingScheduleCard schedule={upcomingSchedule} />
        </div>

        <div className="lg:col-span-1">
          <AnnouncementsCard announcements={announcements} />
        </div>
        <div className="lg:col-span-1">
          <AssignmentsCard assignments={assignments} />
        </div>
        <div className="lg:col-span-1">
          <PaymentsCard payments={payments} />
        </div>

        <div className="lg:col-span-1">
          <ProgressCard />
        </div>

        <div className="lg:col-span-2">
          <div className="flex flex-col h-full rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-black text-slate-950">
              دسترسی سریع
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 h-full">
              <button className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 p-4 transition hover:-translate-y-1 hover:bg-primary-50 hover:text-primary-700">
                <div className="rounded-full bg-white p-3 shadow-sm text-primary-600">
                  <Video size={20} />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  ورود به صنف آنلاین
                </span>
              </button>
              <button className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 p-4 transition hover:-translate-y-1 hover:bg-primary-50 hover:text-primary-700">
                <div className="rounded-full bg-white p-3 shadow-sm text-primary-600">
                  <ClipboardList size={20} />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  ارسال تمرین
                </span>
              </button>
              <button className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 p-4 transition hover:-translate-y-1 hover:bg-primary-50 hover:text-primary-700">
                <div className="rounded-full bg-white p-3 shadow-sm text-primary-600">
                  <CreditCard size={20} />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  دیدن پرداخت‌ها
                </span>
              </button>
              <button className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 p-4 transition hover:-translate-y-1 hover:bg-primary-50 hover:text-primary-700">
                <div className="rounded-full bg-white p-3 shadow-sm text-primary-600">
                  <MessageCircle size={20} />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  تماس با پشتیبانی
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
