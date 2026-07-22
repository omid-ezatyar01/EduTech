import {
  User,
  Lock,
  Palette,
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
      id: "appearance",
      name: isFa ? "ظاهر و زبان" : "Appearance & Language",
      subtitle: isFa ? "زبان و اندازه نمایش" : "Language and display size",
      icon: Palette,
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
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <h3 className="mb-3 px-1 text-base font-black text-slate-900 sm:mb-4 sm:px-2 sm:text-lg">
        {isFa ? "دسته‌بندی تنظیمات" : "Settings Categories"}
      </h3>

      <div className="relative lg:hidden">
        <select
          value={active}
          onChange={(event) => setActive(event.target.value)}
          aria-label={isFa ? "انتخاب دسته‌بندی تنظیمات" : "Select settings category"}
          className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 pe-11 text-sm font-bold text-slate-800 outline-none transition focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">▼</span>
        <p className="mt-2 px-1 text-xs font-medium leading-5 text-slate-500">
          {categories.find((category) => category.id === active)?.subtitle}
        </p>
      </div>

      <div
        className="hidden gap-2 lg:flex lg:flex-col"
      >
        {categories.map((cat) => (
          <button
            type="button"
            key={cat.id}
            onClick={() => setActive(cat.id)}
            className={`flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-3 transition-colors sm:gap-4 sm:px-4 ${
              isFa ? "text-right" : "text-left"
            } ${active === cat.id ? "bg-primary-50 text-primary-600" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <cat.icon
              className={`h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 ${active === cat.id ? "text-primary-600" : "text-slate-400"}`}
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold sm:text-base">
                {cat.name}
              </div>
              <div
                className={`mt-0.5 truncate text-[10px] sm:text-xs ${active === cat.id ? "text-primary-500" : "text-slate-400"}`}
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
