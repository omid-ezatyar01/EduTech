import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  KeyRound,
  Loader2,
  Percent,
  RefreshCw,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  buildAdminPath,
  clearAuth,
  getToken,
  PORTAL_CONFIG,
} from "../../services/portal.js";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import {
  fetchAdminTelegramSettings,
  sendAdminTelegramTestPost,
  updateAdminTelegramSettings,
} from "../../services/telegramService.js";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useLatestRequest from "../hooks/useLatestRequest.js";
import {
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";

const ADMIN_SETTINGS_CACHE_KEY = getAdminPageCacheKey("settings");
const ADMIN_SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;
const ADMIN_TELEGRAM_CACHE_KEY = getAdminPageCacheKey("telegram");
const ADMIN_TELEGRAM_CACHE_TTL_MS = 5 * 60 * 1000;

const EMPTY_TELEGRAM_SETTINGS = {
  publicChannelId: "",
  publicChannelUsername: "",
  autoPostCourses: true,
  autoPostTeachers: true,
  autoPostEvents: true,
};

const PAGE_TEXT = {
  "Settings control center": "مرکز کنترل تنظیمات",
  "Manage platform pricing, teacher deductions, student discounts, and Telegram publishing settings from one page.":
    "قیمت‌گذاری پلتفرم، کسر سهم مدرسان، تخفیف شاگردان و تنظیمات نشر تلگرام را از یک صفحه مدیریت کنید.",
  "Teacher deduction": "کسر سهم مدرس",
  "Minimum course price": "حداقل قیمت کورس",
  "Student discount": "تخفیف شاگردان",
  "Telegram automation": "خودکارسازی تلگرام",
  "Platform pricing settings": "تنظیمات قیمت‌گذاری پلتفرم",
  "Control deductions, minimum pricing, and discounts for the full platform.":
    "کسر سهم، حداقل قیمت و تخفیف‌های کل پلتفرم را مدیریت کنید.",
  "Telegram publishing settings": "تنظیمات نشر تلگرام",
  "Manage automatic channel announcements and confirm the live Telegram connection.":
    "اعلان‌های خودکار کانال را مدیریت کنید و اتصال فعال تلگرام را بررسی نمایید.",
  "Admin account security": "امنیت حساب مدیر",
  "Change your administrator password and protect access to the control panel.":
    "رمز عبور مدیر را تغییر دهید و دسترسی به پنل کنترل را محافظت کنید.",
  "Current password": "رمز عبور فعلی",
  "New password": "رمز عبور جدید",
  "Confirm new password": "تأیید رمز عبور جدید",
  "Enter your current password": "رمز عبور فعلی را وارد کنید",
  "Enter a strong new password": "یک رمز عبور جدید و قوی وارد کنید",
  "Enter the new password again": "رمز عبور جدید را دوباره وارد کنید",
  "Use at least 8 characters with uppercase, lowercase, and a number.":
    "حداقل ۸ نویسه شامل حرف بزرگ، حرف کوچک و عدد استفاده کنید.",
  "Change password": "تغییر رمز عبور",
  "Changing password": "در حال تغییر رمز عبور",
  "Password changed successfully. Please sign in again.":
    "رمز عبور با موفقیت تغییر کرد. لطفاً دوباره وارد شوید.",
  "All password fields are required.": "تکمیل همه فیلدهای رمز عبور الزامی است.",
  "New password must be at least 8 characters and include uppercase, lowercase, and a number.":
    "رمز جدید باید حداقل ۸ نویسه و شامل حرف بزرگ، حرف کوچک و عدد باشد.",
  "New password and confirmation do not match.": "رمز جدید و تأیید آن یکسان نیستند.",
  "New password must be different from current password.": "رمز جدید باید با رمز فعلی متفاوت باشد.",
  "Current password is incorrect": "رمز عبور فعلی نادرست است.",
  "Failed to change password.": "تغییر رمز عبور ناموفق بود.",
  "Teacher deduction percentage per paid student": "درصد کسر سهم برای هر شاگرد پرداخت‌کننده",
  "This value is applied to teacher income calculation for every paid student registration.":
    "این مقدار برای محاسبه درآمد مدرس در هر ثبت‌نام پرداختی اعمال می‌شود.",
  "Minimum course price teachers can set (USD)": "حداقل قیمت کورسی که مدرس می‌تواند تعیین کند (دالر)",
  "Prevents teachers from publishing paid courses below your minimum allowed price.":
    "از نشر کورس‌های پولی با قیمتی کمتر از حداقل مجاز شما جلوگیری می‌کند.",
  "Global course discount for students (%)": "درصد تخفیف عمومی کورس برای شاگردان",
  "Applied to all public course prices and checkout amounts in USD.":
    "بر همه قیمت‌های عمومی کورس و مبالغ پرداخت نهایی به دالر اعمال می‌شود.",
  "Save platform settings": "ذخیره تنظیمات پلتفرم",
  "Save Telegram settings": "ذخیره تنظیمات تلگرام",
  Refresh: "تازه‌سازی",
  Saving: "در حال ذخیره",
  Sending: "در حال ارسال",
  "Send test post": "ارسال پست آزمایشی",
  "Public channel ID": "شناسه کانال عمومی",
  "Public channel username": "نام کاربری کانال عمومی",
  "Not set in backend .env": "در فایل backend .env تنظیم نشده است",
  "This value now comes from backend .env and cannot be edited from the admin panel.":
    "این مقدار اکنون از backend .env خوانده می‌شود و از پنل ادمین قابل ویرایش نیست.",
  "This value now comes from backend .env and is shown here only for reference.":
    "این مقدار اکنون از backend .env خوانده می‌شود و فقط برای مرجع در اینجا نمایش داده می‌شود.",
  "Auto-post new courses": "نشر خودکار کورس‌های جدید",
  "Send a Telegram announcement whenever a course becomes publicly published.":
    "هر زمان یک کورس به‌صورت عمومی منتشر شود، اعلان تلگرام ارسال شود.",
  "Auto-post approved teachers": "نشر خودکار مدرسان تاییدشده",
  "Send a Telegram announcement when an admin approves a teacher profile.":
    "وقتی ادمین پروفایل یک مدرس را تایید می‌کند، اعلان تلگرام ارسال شود.",
  "Auto-post new events": "نشر خودکار رویدادهای جدید",
  "Keeps event announcements ready now and will activate once event creation exists in the platform.":
    "آماده‌سازی اعلان رویدادها را نگه می‌دارد و وقتی ساخت رویداد در پلتفرم فعال شود، شروع به کار می‌کند.",
  "Platform settings saved successfully.": "تنظیمات پلتفرم با موفقیت ذخیره شد.",
  "Telegram settings saved successfully.": "تنظیمات تلگرام با موفقیت ذخیره شد.",
  "Telegram test post sent successfully.": "پست آزمایشی تلگرام با موفقیت ارسال شد.",
  "Failed to load platform settings.": "بارگذاری تنظیمات پلتفرم ناموفق بود.",
  "Failed to load Telegram settings.": "بارگذاری تنظیمات تلگرام ناموفق بود.",
  "Failed to save platform settings.": "ذخیره تنظیمات پلتفرم ناموفق بود.",
  "Failed to save Telegram settings.": "ذخیره تنظیمات تلگرام ناموفق بود.",
  "Failed to send Telegram test post.": "ارسال پست آزمایشی تلگرام ناموفق بود.",
  "Please enter valid values for all platform settings.":
    "لطفاً برای همه تنظیمات پلتفرم مقدار معتبر وارد کنید.",
  "Authentication token not found.": "توکن احراز هویت پیدا نشد.",
};

const translateText = (text, language) => {
  if (language !== "fa") return text;
  return PAGE_TEXT[text] || text;
};

const normalizePercentInput = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  if (numeric < 0) return "0";
  if (numeric > 100) return "100";
  return String(Math.round(numeric * 100) / 100);
};

const normalizePriceInput = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  if (numeric < 0) return "0";
  if (numeric > 10000) return "10000";
  return String(Math.round(numeric));
};

function ToggleRow({ label, hint, checked, onChange, disabled }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="space-y-1">
        <p className="text-sm font-bold text-slate-800">{label}</p>
        <p className="text-xs font-semibold leading-6 text-slate-500">{hint}</p>
      </div>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-[#0B4FD8] peer-disabled:opacity-60" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export default function AdminSettingsPage() {
  const { t, language, isRTL } = useAdminI18n();
  const pageTr = useCallback((text) => translateText(t(text), language), [t, language]);
  const token = useMemo(() => getToken(), []);

  const [teacherDeductionPercentage, setTeacherDeductionPercentage] = useState("15");
  const [minTeacherCoursePrice, setMinTeacherCoursePrice] = useState("5");
  const [globalCourseDiscountPercentage, setGlobalCourseDiscountPercentage] = useState("0");
  const [telegramForm, setTelegramForm] = useState(EMPTY_TELEGRAM_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [loadingTelegram, setLoadingTelegram] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const settingsRequest = useLatestRequest();
  const telegramRequest = useLatestRequest();

  const loadPlatformSettings = useCallback(async ({ silent = false } = {}) => {
    if (!token) {
      setError(pageTr("Authentication token not found."));
      return;
    }

    const cached = readAdminPageCache(ADMIN_SETTINGS_CACHE_KEY, {
      maxAgeMs: ADMIN_SETTINGS_CACHE_TTL_MS,
    });

    if (cached) {
      setTeacherDeductionPercentage(cached.teacherDeductionPercentage || "15");
      setMinTeacherCoursePrice(cached.minTeacherCoursePrice || "5");
      setGlobalCourseDiscountPercentage(cached.globalCourseDiscountPercentage || "0");
      if (!silent) setLoadingSettings(false);
    }

    try {
      if (!silent) {
        setLoadingSettings(true);
        setError("");
      }

      await settingsRequest.runLatest(async () => {
        const response = await fetch(`${getApiBase()}/admin/settings`, {
          headers: buildAuthHeaders(),
        });
        return parseJsonResponse(response);
      }, {
        onSuccess: (data) => {
          const nextSettings = {
            teacherDeductionPercentage:
              normalizePercentInput(data?.data?.teacherDeductionPercentage) || "15",
            minTeacherCoursePrice: normalizePriceInput(data?.data?.minTeacherCoursePrice) || "5",
            globalCourseDiscountPercentage:
              normalizePercentInput(data?.data?.globalCourseDiscountPercentage) || "0",
          };
          setTeacherDeductionPercentage(nextSettings.teacherDeductionPercentage);
          setMinTeacherCoursePrice(nextSettings.minTeacherCoursePrice);
          setGlobalCourseDiscountPercentage(nextSettings.globalCourseDiscountPercentage);
          writeAdminPageCache(ADMIN_SETTINGS_CACHE_KEY, nextSettings);
        },
        onError: (err) => {
          setError(err?.message || pageTr("Failed to load platform settings."));
        },
      });
    } catch (err) {
      setError(err?.message || pageTr("Failed to load platform settings."));
    } finally {
      if (!silent) setLoadingSettings(false);
    }
  }, [pageTr, settingsRequest, token]);

  const loadTelegramSettings = useCallback(async ({ silent = false } = {}) => {
    const cached = readAdminPageCache(ADMIN_TELEGRAM_CACHE_KEY, {
      maxAgeMs: ADMIN_TELEGRAM_CACHE_TTL_MS,
    });

    if (cached?.form) {
      setTelegramForm(cached.form);
      if (!silent) setLoadingTelegram(false);
    }

    if (!silent) {
      setLoadingTelegram(true);
      setError("");
    }

    await telegramRequest.runLatest(fetchAdminTelegramSettings, {
      onSuccess: (settings) => {
        const nextForm = {
          publicChannelId: String(settings?.publicChannelId || ""),
          publicChannelUsername: String(settings?.publicChannelUsername || ""),
          autoPostCourses: Boolean(settings?.autoPostCourses),
          autoPostTeachers: Boolean(settings?.autoPostTeachers),
          autoPostEvents: Boolean(settings?.autoPostEvents),
        };
        setTelegramForm(nextForm);
        writeAdminPageCache(ADMIN_TELEGRAM_CACHE_KEY, { form: nextForm });
      },
      onError: (err) => {
        setError(err?.message || pageTr("Failed to load Telegram settings."));
      },
      onFinally: () => {
        if (!silent) setLoadingTelegram(false);
      },
    });
  }, [pageTr, telegramRequest]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const timer = window.setTimeout(() => {
      loadPlatformSettings();
      loadTelegramSettings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPlatformSettings, loadTelegramSettings]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const statsCards = useMemo(
    () => [
      {
        title: pageTr("Teacher deduction"),
        value: `${teacherDeductionPercentage || "0"}%`,
        icon: Percent,
        tone: "bg-blue-50 text-blue-700",
      },
      {
        title: pageTr("Minimum course price"),
        value: `${minTeacherCoursePrice || "0"} USD`,
        icon: ShieldCheck,
        tone: "bg-emerald-50 text-emerald-700",
      },
      {
        title: pageTr("Student discount"),
        value: `${globalCourseDiscountPercentage || "0"}%`,
        icon: Sparkles,
        tone: "bg-amber-50 text-amber-700",
      },
      {
        title: pageTr("Telegram automation"),
        value: telegramForm.autoPostCourses || telegramForm.autoPostTeachers || telegramForm.autoPostEvents
          ? pageTr("Active")
          : pageTr("Inactive"),
        icon: Send,
        tone: "bg-cyan-50 text-cyan-700",
      },
    ],
    [
      globalCourseDiscountPercentage,
      minTeacherCoursePrice,
      pageTr,
      teacherDeductionPercentage,
      telegramForm.autoPostCourses,
      telegramForm.autoPostEvents,
      telegramForm.autoPostTeachers,
    ],
  );

  const handleSavePlatformSettings = async (event) => {
    event.preventDefault();

    const normalizedDeduction = normalizePercentInput(teacherDeductionPercentage);
    const normalizedMinPrice = normalizePriceInput(minTeacherCoursePrice);
    const normalizedGlobalDiscount = normalizePercentInput(globalCourseDiscountPercentage);

    if (
      normalizedDeduction === "" ||
      normalizedMinPrice === "" ||
      normalizedGlobalDiscount === ""
    ) {
      setError(pageTr("Please enter valid values for all platform settings."));
      return;
    }

    try {
      setSavingSettings(true);
      setError("");
      setToast("");

      const response = await fetch(`${getApiBase()}/admin/settings`, {
        method: "PATCH",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          teacherDeductionPercentage: Number(normalizedDeduction),
          minTeacherCoursePrice: Number(normalizedMinPrice),
          globalCourseDiscountPercentage: Number(normalizedGlobalDiscount),
        }),
      });
      const data = await parseJsonResponse(response);

      const nextSettings = {
        teacherDeductionPercentage:
          normalizePercentInput(data?.data?.teacherDeductionPercentage) || normalizedDeduction,
        minTeacherCoursePrice: normalizePriceInput(data?.data?.minTeacherCoursePrice) || normalizedMinPrice,
        globalCourseDiscountPercentage:
          normalizePercentInput(data?.data?.globalCourseDiscountPercentage) || normalizedGlobalDiscount,
      };
      setTeacherDeductionPercentage(nextSettings.teacherDeductionPercentage);
      setMinTeacherCoursePrice(nextSettings.minTeacherCoursePrice);
      setGlobalCourseDiscountPercentage(nextSettings.globalCourseDiscountPercentage);
      writeAdminPageCache(ADMIN_SETTINGS_CACHE_KEY, nextSettings);
      setToast(pageTr("Platform settings saved successfully."));
    } catch (err) {
      setError(err?.message || pageTr("Failed to save platform settings."));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveTelegramSettings = async (event) => {
    event.preventDefault();

    try {
      setSavingTelegram(true);
      setError("");
      setToast("");

      const saved = await updateAdminTelegramSettings({
        autoPostCourses: Boolean(telegramForm.autoPostCourses),
        autoPostTeachers: Boolean(telegramForm.autoPostTeachers),
        autoPostEvents: Boolean(telegramForm.autoPostEvents),
      });

      const nextForm = {
        publicChannelId: String(saved?.publicChannelId || ""),
        publicChannelUsername: String(saved?.publicChannelUsername || ""),
        autoPostCourses: Boolean(saved?.autoPostCourses),
        autoPostTeachers: Boolean(saved?.autoPostTeachers),
        autoPostEvents: Boolean(saved?.autoPostEvents),
      };
      setTelegramForm(nextForm);
      writeAdminPageCache(ADMIN_TELEGRAM_CACHE_KEY, { form: nextForm });
      setToast(pageTr("Telegram settings saved successfully."));
    } catch (err) {
      setError(err?.message || pageTr("Failed to save Telegram settings."));
    } finally {
      setSavingTelegram(false);
    }
  };

  const handleSendTestPost = async () => {
    try {
      setTestingTelegram(true);
      setError("");
      setToast("");
      await sendAdminTelegramTestPost();
      setToast(pageTr("Telegram test post sent successfully."));
    } catch (err) {
      setError(err?.message || pageTr("Failed to send Telegram test post."));
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setError("");
    setToast("");

    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(pageTr("All password fields are required."));
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/.test(newPassword)) {
      setError(pageTr("New password must be at least 8 characters and include uppercase, lowercase, and a number."));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(pageTr("New password and confirmation do not match."));
      return;
    }
    if (newPassword === currentPassword) {
      setError(pageTr("New password must be different from current password."));
      return;
    }

    try {
      setSavingPassword(true);
      const response = await fetch(`${getApiBase()}/auth/change-password`, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify(passwordForm),
      });
      await parseJsonResponse(response);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setToast(pageTr("Password changed successfully. Please sign in again."));
      window.setTimeout(() => {
        clearAuth();
        window.location.replace(buildAdminPath(PORTAL_CONFIG.loginPath));
      }, 1400);
    } catch (err) {
      const requestMessage = String(err?.response?.data?.message || err?.message || "");
      setError(pageTr(requestMessage || "Failed to change password."));
    } finally {
      setSavingPassword(false);
    }
  };

  const disablePlatformActions = loadingSettings || savingSettings;
  const disableTelegramActions = loadingTelegram || savingTelegram || testingTelegram;

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={`w-full max-w-full space-y-6 overflow-x-hidden ${isRTL ? "text-right" : "text-left"}`}
    >
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Link to="/" className="transition hover:text-[#0B4FD8]">
                {t("common.home")}
              </Link>
              <ChevronLeft size={16} className={isRTL ? "rotate-180" : ""} />
              <span className="text-slate-900">{t("pages.settings.title")}</span>
            </nav>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-600">
              {pageTr("Settings control center")}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-800">{t("pages.settings.title")}</h1>
            <p className="mt-2 max-w-3xl text-sm font-normal leading-7 text-slate-600">
              {pageTr("Manage platform pricing, teacher deductions, student discounts, and Telegram publishing settings from one page.")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statsCards.map((card) => (
          <article key={card.title} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
              <card.icon size={22} />
            </div>
            <p className="mt-4 text-sm font-bold text-slate-700">{card.title}</p>
            <p className="mt-2 text-2xl font-extrabold text-slate-800">{card.value}</p>
          </article>
        ))}
      </div>

      {error ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
          {error}
        </div>
      ) : null}

      {toast ? (
        <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {toast}
        </div>
      ) : null}

      <div className="space-y-6">
        <form onSubmit={handleSavePlatformSettings} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">{pageTr("Platform pricing settings")}</h2>
              <p className="mt-1 text-sm font-normal text-slate-600">
                {pageTr("Control deductions, minimum pricing, and discounts for the full platform.")}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="teacherDeductionPercentage" className="text-sm font-bold text-slate-700">
                {pageTr("Teacher deduction percentage per paid student")}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-slate-400">
                  <Percent size={16} />
                </span>
                <input
                  id="teacherDeductionPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={teacherDeductionPercentage}
                  onChange={(event) => setTeacherDeductionPercentage(event.target.value)}
                  onBlur={() => setTeacherDeductionPercentage((prev) => normalizePercentInput(prev))}
                  disabled={disablePlatformActions}
                  className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                />
              </div>
              <p className="text-xs font-semibold leading-6 text-slate-500">
                {pageTr("This value is applied to teacher income calculation for every paid student registration.")}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="minTeacherCoursePrice" className="text-sm font-bold text-slate-700">
                {pageTr("Minimum course price teachers can set (USD)")}
              </label>
              <input
                id="minTeacherCoursePrice"
                type="number"
                min="0"
                max="10000"
                step="1"
                value={minTeacherCoursePrice}
                onChange={(event) => setMinTeacherCoursePrice(event.target.value)}
                onBlur={() => setMinTeacherCoursePrice((prev) => normalizePriceInput(prev))}
                disabled={disablePlatformActions}
                className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
              />
              <p className="text-xs font-semibold leading-6 text-slate-500">
                {pageTr("Prevents teachers from publishing paid courses below your minimum allowed price.")}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="globalCourseDiscountPercentage" className="text-sm font-bold text-slate-700">
                {pageTr("Global course discount for students (%)")}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-slate-400">
                  <Percent size={16} />
                </span>
                <input
                  id="globalCourseDiscountPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={globalCourseDiscountPercentage}
                  onChange={(event) => setGlobalCourseDiscountPercentage(event.target.value)}
                  onBlur={() => setGlobalCourseDiscountPercentage((prev) => normalizePercentInput(prev))}
                  disabled={disablePlatformActions}
                  className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                />
              </div>
              <p className="text-xs font-semibold leading-6 text-slate-500">
                {pageTr("Applied to all public course prices and checkout amounts in USD.")}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={disablePlatformActions}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <Save size={16} />
              {savingSettings ? pageTr("Saving") : pageTr("Save platform settings")}
            </button>
            <button
              type="button"
              onClick={() => loadPlatformSettings()}
              disabled={disablePlatformActions}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={16} />
              {pageTr("Refresh")}
            </button>
          </div>
        </form>

        <form onSubmit={handleChangePassword} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">{pageTr("Admin account security")}</h2>
              <p className="mt-1 text-sm font-normal text-slate-600">
                {pageTr("Change your administrator password and protect access to the control panel.")}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="adminCurrentPassword" className="text-sm font-bold text-slate-700">
                {pageTr("Current password")}
              </label>
              <input
                id="adminCurrentPassword"
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((previous) => ({ ...previous, currentPassword: event.target.value }))}
                placeholder={pageTr("Enter your current password")}
                disabled={savingPassword}
                className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="adminNewPassword" className="text-sm font-bold text-slate-700">
                {pageTr("New password")}
              </label>
              <input
                id="adminNewPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((previous) => ({ ...previous, newPassword: event.target.value }))}
                placeholder={pageTr("Enter a strong new password")}
                disabled={savingPassword}
                className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="adminConfirmPassword" className="text-sm font-bold text-slate-700">
                {pageTr("Confirm new password")}
              </label>
              <input
                id="adminConfirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((previous) => ({ ...previous, confirmPassword: event.target.value }))}
                placeholder={pageTr("Enter the new password again")}
                disabled={savingPassword}
                className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              />
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold leading-6 text-slate-500">
            {pageTr("Use at least 8 characters with uppercase, lowercase, and a number.")}
          </p>
          <button
            type="submit"
            disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-5 py-2.5 text-sm font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingPassword ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
            {savingPassword ? pageTr("Changing password") : pageTr("Change password")}
          </button>
        </form>

        <form onSubmit={handleSaveTelegramSettings} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
              <Send size={20} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">{pageTr("Telegram publishing settings")}</h2>
              <p className="mt-1 text-sm font-normal text-slate-600">
                {pageTr("Manage automatic channel announcements and confirm the live Telegram connection.")}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">{pageTr("Public channel ID")}</label>
              <div className="flex min-h-12 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900">
                {telegramForm.publicChannelId || pageTr("Not set in backend .env")}
              </div>
              <p className="text-xs font-semibold leading-6 text-slate-500">
                {pageTr("This value now comes from backend .env and cannot be edited from the admin panel.")}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">{pageTr("Public channel username")}</label>
              <div className="flex min-h-12 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900">
                {telegramForm.publicChannelUsername
                  ? `@${String(telegramForm.publicChannelUsername).replace(/^@+/, "")}`
                  : pageTr("Not set in backend .env")}
              </div>
              <p className="text-xs font-semibold leading-6 text-slate-500">
                {pageTr("This value now comes from backend .env and is shown here only for reference.")}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <ToggleRow
              label={pageTr("Auto-post new courses")}
              hint={pageTr("Send a Telegram announcement whenever a course becomes publicly published.")}
              checked={telegramForm.autoPostCourses}
              onChange={(value) => setTelegramForm((prev) => ({ ...prev, autoPostCourses: value }))}
              disabled={disableTelegramActions}
            />
            <ToggleRow
              label={pageTr("Auto-post approved teachers")}
              hint={pageTr("Send a Telegram announcement when an admin approves a teacher profile.")}
              checked={telegramForm.autoPostTeachers}
              onChange={(value) => setTelegramForm((prev) => ({ ...prev, autoPostTeachers: value }))}
              disabled={disableTelegramActions}
            />
            <ToggleRow
              label={pageTr("Auto-post new events")}
              hint={pageTr("Keeps event announcements ready now and will activate once event creation exists in the platform.")}
              checked={telegramForm.autoPostEvents}
              onChange={(value) => setTelegramForm((prev) => ({ ...prev, autoPostEvents: value }))}
              disabled={disableTelegramActions}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={disableTelegramActions}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <Save size={16} />
              {savingTelegram ? pageTr("Saving") : pageTr("Save Telegram settings")}
            </button>
            <button
              type="button"
              onClick={handleSendTestPost}
              disabled={disableTelegramActions}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <Send size={16} />
              {testingTelegram ? pageTr("Sending") : pageTr("Send test post")}
            </button>
            <button
              type="button"
              onClick={() => loadTelegramSettings()}
              disabled={disableTelegramActions}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={16} />
              {pageTr("Refresh")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
