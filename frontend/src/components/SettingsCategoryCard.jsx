import {
  User,
  Lock,
  Bell,
  Shield,
  Palette,
  CreditCard,
  Monitor,
  Headphones,
} from "lucide-react";

export default function SettingsCategoryCard({ active, setActive, language = "fa" }) {
  const isFa = language === "fa";
  const categories = [
    {
      id: "account",
      name: isFa ? "اطلاعات حساب" : "Account Info",
      subtitle: isFa ? "مدیریت اطلاعات شخصی" : "Manage personal details",
      icon: User,
    },
    {
      id: "security",
      name: isFa ? "امنیت و ورود" : "Security & Login",
      subtitle: isFa ? "رمز عبور و امنیت حساب" : "Password and account security",
      icon: Lock,
    },
    {
      id: "notifications",
      name: isFa ? "اعلان‌ها" : "Notifications",
      subtitle: isFa ? "تنظیم اعلان‌ها و پیام‌ها" : "Configure alerts and messages",
      icon: Bell,
    },
    {
      id: "privacy",
      name: isFa ? "حریم خصوصی" : "Privacy",
      subtitle: isFa ? "کنترل حریم خصوصی" : "Control your privacy",
      icon: Shield,
    },
    {
      id: "appearance",
      name: isFa ? "ظاهر و زبان" : "Appearance & Language",
      subtitle: isFa ? "تم، زبان و نمایش" : "Theme, language, and display",
      icon: Palette,
    },
    {
      id: "payment",
      name: isFa ? "پرداخت و فاکتور" : "Payments & Invoices",
      subtitle: isFa ? "روش‌های پرداخت و فاکتورها" : "Payment methods and invoices",
      icon: CreditCard,
    },
    {
      id: "devices",
      name: isFa ? "دستگاه‌های متصل" : "Connected Devices",
      subtitle: isFa ? "مدیریت دستگاه‌های فعال" : "Manage active devices",
      icon: Monitor,
    },
    {
      id: "support",
      name: isFa ? "پشتیبانی" : "Support",
      subtitle: isFa ? "کمک و پشتیبانی" : "Help and support",
      icon: Headphones,
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 px-2 text-lg font-black text-slate-900">
        {isFa ? "دسته‌بندی تنظیمات" : "Settings Categories"}
      </h3>
      <div
        className="flex flex-row gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActive(cat.id)}
            className={`flex min-w-[180px] sm:min-w-[200px] flex-shrink-0 items-center gap-3 sm:gap-4 rounded-xl px-3 sm:px-4 py-3 transition-colors lg:w-full lg:min-w-0 ${
              isFa ? "text-right" : "text-left"
            } ${active === cat.id ? "bg-primary-50 text-primary-600" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <cat.icon
              className={`h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 ${active === cat.id ? "text-primary-600" : "text-slate-400"}`}
            />
            <div>
              <div className="font-bold text-sm sm:text-base whitespace-nowrap">
                {cat.name}
              </div>
              <div
                className={`text-[10px] sm:text-xs whitespace-nowrap mt-0.5 ${active === cat.id ? "text-primary-500" : "text-slate-400"}`}
              >
                {cat.subtitle}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
