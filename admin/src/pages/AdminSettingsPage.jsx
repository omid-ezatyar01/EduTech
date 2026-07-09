import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Percent, RotateCcw, Save, Settings } from "lucide-react";
import { getToken } from "../../services/portal.js";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useLatestRequest from "../hooks/useLatestRequest.js";
import {
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";

const ADMIN_SETTINGS_CACHE_KEY = getAdminPageCacheKey("settings");
const ADMIN_SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;

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

export default function AdminSettingsPage() {
  const { t, tr } = useAdminI18n();
  const token = useMemo(() => getToken(), []);

  const [teacherDeductionPercentage, setTeacherDeductionPercentage] = useState("15");
  const [minTeacherCoursePrice, setMinTeacherCoursePrice] = useState("5");
  const [globalCourseDiscountPercentage, setGlobalCourseDiscountPercentage] = useState("0");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const settingsRequest = useLatestRequest();

  const loadSettings = useCallback(async ({ silent = false } = {}) => {
    if (!token) {
      setError("Authentication token not found.");
      return;
    }

    const cached = readAdminPageCache(ADMIN_SETTINGS_CACHE_KEY, {
      maxAgeMs: ADMIN_SETTINGS_CACHE_TTL_MS,
    });

    if (cached) {
      setTeacherDeductionPercentage(cached.teacherDeductionPercentage || "15");
      setMinTeacherCoursePrice(cached.minTeacherCoursePrice || "5");
      setGlobalCourseDiscountPercentage(cached.globalCourseDiscountPercentage || "0");
      if (!silent) {
        setLoading(false);
        setError("");
      }
    }

    try {
      if (!silent) {
        setLoading(true);
        setError("");
      }

      await settingsRequest.runLatest(async () => {
        const response = await fetch(`${getApiBase()}/admin/settings`, {
          headers: buildAuthHeaders(),
        });
        return parseJsonResponse(response);
      }, {
        onSuccess: (data) => {
          const deduction = data?.data?.teacherDeductionPercentage;
          const minPrice = data?.data?.minTeacherCoursePrice;
          const globalDiscount = data?.data?.globalCourseDiscountPercentage;
          const normalized = normalizePercentInput(deduction);
          const normalizedMinPrice = normalizePriceInput(minPrice);
          const normalizedGlobalDiscount = normalizePercentInput(globalDiscount);
          const nextSettings = {
            teacherDeductionPercentage: normalized || "15",
            minTeacherCoursePrice: normalizedMinPrice || "5",
            globalCourseDiscountPercentage: normalizedGlobalDiscount || "0",
          };
          setTeacherDeductionPercentage(nextSettings.teacherDeductionPercentage);
          setMinTeacherCoursePrice(nextSettings.minTeacherCoursePrice);
          setGlobalCourseDiscountPercentage(nextSettings.globalCourseDiscountPercentage);
          writeAdminPageCache(ADMIN_SETTINGS_CACHE_KEY, nextSettings);
        },
        onError: (err) => {
          setError(err?.message || "Failed to load settings.");
        },
      });
    } catch (err) {
      setError(err?.message || "Failed to load settings.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [settingsRequest, token]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const timer = setTimeout(() => {
      loadSettings();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSettings]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleSave = async (event) => {
    event.preventDefault();

    const normalizedDeduction = normalizePercentInput(teacherDeductionPercentage);
    const normalizedMinPrice = normalizePriceInput(minTeacherCoursePrice);
    const normalizedGlobalDiscount = normalizePercentInput(globalCourseDiscountPercentage);
    if (
      normalizedDeduction === "" ||
      normalizedMinPrice === "" ||
      normalizedGlobalDiscount === ""
    ) {
      setError("Please enter valid values for all settings.");
      return;
    }

    try {
      setSaving(true);
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

      const savedValue = normalizePercentInput(data?.data?.teacherDeductionPercentage);
      const savedMinPrice = normalizePriceInput(data?.data?.minTeacherCoursePrice);
      const savedGlobalDiscount = normalizePercentInput(data?.data?.globalCourseDiscountPercentage);
      const nextSettings = {
        teacherDeductionPercentage: savedValue || normalizedDeduction,
        minTeacherCoursePrice: savedMinPrice || normalizedMinPrice,
        globalCourseDiscountPercentage: savedGlobalDiscount || normalizedGlobalDiscount,
      };
      setTeacherDeductionPercentage(nextSettings.teacherDeductionPercentage);
      setMinTeacherCoursePrice(nextSettings.minTeacherCoursePrice);
      setGlobalCourseDiscountPercentage(nextSettings.globalCourseDiscountPercentage);
      writeAdminPageCache(ADMIN_SETTINGS_CACHE_KEY, nextSettings);
      setToast("Settings saved successfully.");
    } catch (err) {
      setError(err?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6" dir="ltr">
      <div>
        <nav className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Link to="/" className="transition hover:text-violet-600">
            {t("common.home")}
          </Link>
          <ChevronLeft size={16} />
          <span className="text-slate-900">{t("pages.settings.title")}</span>
        </nav>

        <h1 className="text-2xl font-black text-slate-900">{t("pages.settings.title")}</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">{t("pages.settings.subtitle")}</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}

      {toast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {toast}
        </div>
      ) : null}

      <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Settings size={18} className="text-violet-600" />
          <h2 className="text-sm font-black text-slate-900">{tr("Teacher Income Deduction Settings")}</h2>
        </div>

        <div className="space-y-2">
          <label htmlFor="teacherDeductionPercentage" className="text-sm font-bold text-slate-700">
            {tr("Teacher deduction percentage per paid student")}
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
              disabled={loading || saving}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white"
            />
          </div>
          <p className="text-xs font-semibold text-slate-500">
            {tr("This value is applied to teacher income calculation for every paid student registration.")}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="minTeacherCoursePrice" className="text-sm font-bold text-slate-700">
            {tr("Minimum course price teachers can set (USD)")}
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
            disabled={loading || saving}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="globalCourseDiscountPercentage" className="text-sm font-bold text-slate-700">
            {tr("Global course discount for students (%)")}
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
              disabled={loading || saving}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white"
            />
          </div>
          <p className="text-xs font-semibold text-slate-500">
            {tr("Applied to all public course prices and checkout amounts in USD.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || saving}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? tr("Saving") : tr("Save Settings")}
          </button>
          <button
            type="button"
            onClick={() => loadSettings()}
            disabled={loading || saving}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RotateCcw size={16} />
            {loading ? tr("Refreshing") : tr("Reset")}
          </button>
        </div>
      </form>
    </section>
  );
}
