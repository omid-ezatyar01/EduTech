import { Palette, Sun, Moon, Monitor } from "lucide-react";
import { useState } from "react";

export default function AppearanceLanguageCard({ language = "fa" }) {
  const isFa = language === "fa";
  const [theme, setTheme] = useState("light");
  const [toastMsg, setToastMsg] = useState("");
  const t = {
    saved: isFa ? "تنظیمات ظاهر ذخیره شد" : "Appearance settings saved",
    title: isFa ? "ظاهر و زبان" : "Appearance & Language",
    theme: isFa ? "تم ظاهر" : "Theme",
    light: isFa ? "روشن" : "Light",
    dark: isFa ? "تاریک" : "Dark",
    system: isFa ? "سیستم" : "System",
    uiLanguage: isFa ? "زبان رابط کاربری" : "Interface Language",
    persian: isFa ? "فارسی" : "Persian",
  };

  const handleThemeChange = (val) => {
    setTheme(val);
    showToast();
  };

  const handleLangChange = (e) => {
    const nextLanguage = e.target.value === "en" ? "en" : "fa";
    localStorage.setItem("edutech-language", nextLanguage);
    window.dispatchEvent(
      new CustomEvent("edutech_language_change", {
        detail: { language: nextLanguage },
      }),
    );
    showToast();
  };

  const showToast = () => {
    setToastMsg(t.saved);
    setTimeout(() => setToastMsg(""), 2000);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-500">
          <Palette className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-black text-slate-900">{t.title}</h3>
      </div>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-3">
            {t.theme}
          </label>
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => handleThemeChange("light")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-all ${theme === "light" ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Sun className="h-4 w-4" />
              {t.light}
            </button>
            <button
              onClick={() => handleThemeChange("dark")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-all ${theme === "dark" ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Moon className="h-4 w-4" />
              {t.dark}
            </button>
            <button
              onClick={() => handleThemeChange("system")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-all ${theme === "system" ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Monitor className="h-4 w-4" />
              {t.system}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            {t.uiLanguage}
          </label>
          <select
            value={language}
            onChange={handleLangChange}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 transition"
          >
            <option value="fa">{t.persian}</option>
            <option value="en">English</option>
          </select>
        </div>
        {toastMsg && (
          <div className="text-xs font-bold text-purple-600 bg-purple-50 p-2 rounded text-center">
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
}
