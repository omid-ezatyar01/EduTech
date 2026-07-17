import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { Link } from "react-router-dom";
import StudentLayout from "./StudentLayout";
import SettingsCategoryCard from "./SettingsCategoryCard";
import SettingsHelpCard from "./SettingsHelpCard";
import NotificationSettingsPanel from "./NotificationSettingsPanel";
import QuickSecurityCard from "./QuickSecurityCard";
import AppearanceLanguageCard from "./AppearanceLanguageCard";
import AccountSecurityModal from "./AccountSecurityModal";
import NotificationManagementModal from "./NotificationManagementModal";

const mockStudent = {
  id: "",
  firstNameFa: "",
  lastNameFa: "",
  nameFa: "",
  email: "",
  phone: "",
  avatar: "",
  birthDate: "",
  gender: "",
  country: "",
  city: "",
  bio: "",
  notifications: {
    course: false,
    assignments: false,
    payments: false,
    news: false,
    important: false,
  },
  security: {
    twoFactor: false,
    activeDevices: [],
  },
  appearance: {
    theme: "light",
    language: "fa",
  },
  socialLinks: [],
};

export default function Settings({ language = "fa" }) {
  const isFa = language === "fa";
  const t = {
    dashboard: isFa ? "داشبورد" : "Dashboard",
    settings: isFa ? "تنظیمات" : "Settings",
    subtitle: isFa
      ? "تنظیمات حساب کاربری و ترجیحات خود را مدیریت کنید."
      : "Manage your account settings and preferences.",
    inProgressTitle: isFa ? "در حال توسعه" : "Under Development",
    inProgressSubtitle: isFa
      ? "این بخش به زودی در دسترس خواهد بود."
      : "This section will be available soon.",
    paymentTitle: isFa ? "پرداخت و فاکتور" : "Payments & Invoices",
    paymentSubtitle: isFa
      ? "تنظیمات پرداخت در این بخش مدیریت می‌شود."
      : "Payment settings are managed in this section.",
    privacyTitle: isFa ? "حریم خصوصی" : "Privacy",
    privacyItems: isFa
      ? [
          "نمایش پروفایل برای دیگران",
          "اجازه پیام از شاگردان",
          "اشتراک‌گذاری پیشرفت یادگیری",
          "دانلود اطلاعات حساب",
        ]
      : [
          "Show profile to others",
          "Allow messages from students",
          "Share learning progress",
          "Download account data",
        ],
  };

  const [activeCategory, setActiveCategory] = useState("account");
  const [isSecurityModalOpen, setSecurityModalOpen] = useState(false);
  const [isNotifModalOpen, setNotifModalOpen] = useState(false);

  return (
    <StudentLayout language={language}>
      <div className="mb-8">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
          <Link className="transition hover:text-primary-700" to="/student/dashboard">
            {t.dashboard}
          </Link>
          <span>/</span>
          <span className="text-primary-600">{t.settings}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
            <SettingsIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">{t.settings}</h1>
            <p className="text-sm font-medium text-slate-500">
              {t.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h3 className="mb-2 text-xl font-black text-slate-900">{t.inProgressTitle}</h3>
        <p className="font-medium text-slate-500">
          {t.inProgressSubtitle}
        </p>
      </div>

      <div className="mb-6">
        <SettingsCategoryCard
          active={activeCategory}
          setActive={setActiveCategory}
          language={language}
        />
      </div>

      <div className="space-y-6">
        {activeCategory === "payment" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-2">
              {t.paymentTitle}
            </h3>
            <p className="text-slate-500 font-medium">
              {t.paymentSubtitle}
            </p>
          </div>
        )}
        {activeCategory === "privacy" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-6">
              {t.privacyTitle}
            </h3>
            <div className="space-y-4">
              {t.privacyItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-sm font-bold text-slate-700">
                    {item}
                  </span>
                  <button className="relative h-6 w-11 rounded-full bg-teal-500 transition-colors">
                    <span className="absolute top-1 bottom-1 left-1 w-4 rounded-full bg-white transition-all" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <NotificationSettingsPanel
          data={mockStudent.notifications}
          onOpenModal={() => setNotifModalOpen(true)}
          language={language}
        />
        <QuickSecurityCard onOpenModal={() => setSecurityModalOpen(true)} language={language} />
        <AppearanceLanguageCard language={language} />
        <SettingsHelpCard language={language} />
      </div>
      <div className="h-8" aria-hidden="true" />

      <AccountSecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setSecurityModalOpen(false)}
        language={language}
      />
      <NotificationManagementModal
        isOpen={isNotifModalOpen}
        onClose={() => setNotifModalOpen(false)}
        language={language}
      />
    </StudentLayout>
  );
}
