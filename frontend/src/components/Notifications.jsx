import { Bell, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import StudentLayout from "./StudentLayout.jsx";

export default function Notifications({ language = "fa" }) {
  return (
    <StudentLayout language={language}>
      <div className="mb-6 px-1 sm:px-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
        <Link
          className="transition hover:text-primary-700"
          to="/student/dashboard"
        >
          داشبورد
        </Link>
        <span>/</span>
        <span className="text-slate-900">اعلان‌ها</span>
      </div>

      <div className="mt-8 flex flex-col items-center justify-center rounded-[32px] border border-slate-200 bg-white px-6 py-24 text-center shadow-sm sm:px-12">
        <div className="relative mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <div className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-amber-100 text-amber-600 shadow-sm">
            <Wrench size={20} />
          </div>
          <Bell size={40} />
        </div>
        <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">
          بخش اعلان‌ها در حال توسعه است!
        </h1>
        <p className="mt-4 max-w-lg text-lg font-medium leading-8 text-slate-600">
          تیم ما در حال کار روی این ویژگی است تا به زودی امکان مشاهده و مدیریت
          اعلان‌ها را برای شما فراهم کند. از شکیبایی شما سپاسگزاریم.
        </p>
        <Link
          to="/student/dashboard"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-primary-600 px-8 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-primary-700"
        >
          بازگشت به داشبورد
        </Link>
      </div>
    </StudentLayout>
  );
}
