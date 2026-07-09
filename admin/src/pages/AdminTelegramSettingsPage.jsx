import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, RotateCcw, Save, Send, Settings } from "lucide-react";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import {
  fetchAdminTelegramPosts,
  fetchAdminTelegramSettings,
  sendAdminTelegramTestPost,
  updateAdminTelegramSettings,
} from "../../services/telegramService.js";
import useLatestRequest from "../hooks/useLatestRequest.js";
import {
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";

const EMPTY_SETTINGS = {
  publicChannelId: "",
  publicChannelUsername: "",
  autoPostCourses: true,
  autoPostTeachers: true,
  autoPostEvents: true,
};
const ADMIN_TELEGRAM_CACHE_KEY = getAdminPageCacheKey("telegram");
const ADMIN_TELEGRAM_CACHE_TTL_MS = 5 * 60 * 1000;

const formatPostType = (value) => {
  if (value === "course") return "Course";
  if (value === "teacher") return "Teacher";
  if (value === "event") return "Event";
  return value || "-";
};

const formatPostStatus = (value) => {
  if (value === "posted") return "Posted";
  if (value === "failed") return "Failed";
  return value || "-";
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function ToggleRow({ label, hint, checked, onChange, disabled }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="space-y-1">
        <p className="text-sm font-bold text-slate-800">{label}</p>
        <p className="text-xs font-semibold text-slate-500">{hint}</p>
      </div>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-violet-600 peer-disabled:opacity-60" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export default function AdminTelegramSettingsPage() {
  const { t, tr } = useAdminI18n();
  const [form, setForm] = useState(EMPTY_SETTINGS);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const telegramRequest = useLatestRequest();

  const loadPageData = useCallback(async ({ silent = false } = {}) => {
    const cached = readAdminPageCache(ADMIN_TELEGRAM_CACHE_KEY, {
      maxAgeMs: ADMIN_TELEGRAM_CACHE_TTL_MS,
    });

    if (cached) {
      setForm(cached.form || EMPTY_SETTINGS);
      setPosts(Array.isArray(cached.posts) ? cached.posts : []);
      if (!silent) {
        setLoading(false);
        setError("");
      }
    }

    if (!silent) {
      setLoading(true);
      setError("");
    }

    await telegramRequest.runLatest(async () => {
      const [settings, recentPosts] = await Promise.all([
        fetchAdminTelegramSettings(),
        fetchAdminTelegramPosts({ limit: 20 }),
      ]);

      return { settings, recentPosts };
    }, {
      onSuccess: ({ settings, recentPosts }) => {
        const nextForm = {
          publicChannelId: String(settings?.publicChannelId || ""),
          publicChannelUsername: String(settings?.publicChannelUsername || ""),
          autoPostCourses: Boolean(settings?.autoPostCourses),
          autoPostTeachers: Boolean(settings?.autoPostTeachers),
          autoPostEvents: Boolean(settings?.autoPostEvents),
        };
        setForm(nextForm);
        setPosts(recentPosts);
        writeAdminPageCache(ADMIN_TELEGRAM_CACHE_KEY, {
          form: nextForm,
          posts: recentPosts,
        });
      },
      onError: (err) => {
        setError(err?.message || "Failed to load Telegram settings.");
      },
      onFinally: () => {
        if (!silent) setLoading(false);
      },
    });
  }, [telegramRequest]);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleSave = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setToast("");

      const payload = {
        autoPostCourses: Boolean(form.autoPostCourses),
        autoPostTeachers: Boolean(form.autoPostTeachers),
        autoPostEvents: Boolean(form.autoPostEvents),
      };

      const saved = await updateAdminTelegramSettings(payload);
      const nextForm = {
        publicChannelId: String(saved?.publicChannelId || ""),
        publicChannelUsername: String(saved?.publicChannelUsername || ""),
        autoPostCourses: Boolean(saved?.autoPostCourses),
        autoPostTeachers: Boolean(saved?.autoPostTeachers),
        autoPostEvents: Boolean(saved?.autoPostEvents),
      };
      setForm(nextForm);
      writeAdminPageCache(ADMIN_TELEGRAM_CACHE_KEY, {
        form: nextForm,
        posts,
      });
      setToast("Telegram settings saved successfully.");
    } catch (err) {
      setError(err?.message || "Failed to save Telegram settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestPost = async () => {
    try {
      setTesting(true);
      setError("");
      setToast("");
      await sendAdminTelegramTestPost();
      setToast("Telegram test post sent successfully.");
      const recentPosts = await fetchAdminTelegramPosts({ limit: 20 }).catch(() => null);
      if (recentPosts) {
        setPosts(recentPosts);
        writeAdminPageCache(ADMIN_TELEGRAM_CACHE_KEY, {
          form,
          posts: recentPosts,
        });
      }
    } catch (err) {
      setError(err?.message || "Failed to send Telegram test post.");
    } finally {
      setTesting(false);
    }
  };

  const disableActions = loading || saving || testing;

  const totalFailures = useMemo(
    () => posts.filter((item) => item.status === "failed").length,
    [posts],
  );

  return (
    <section className="space-y-6" dir="ltr">
      <div>
        <nav className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Link to="/" className="transition hover:text-violet-600">
            {t("common.home")}
          </Link>
          <ChevronLeft size={16} />
          <span className="text-slate-900">{t("pages.telegram.title")}</span>
        </nav>

        <h1 className="text-2xl font-black text-slate-900">{t("pages.telegram.title")}</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">{t("pages.telegram.subtitle")}</p>
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

      <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Settings size={18} className="text-violet-600" />
          <h2 className="text-sm font-black text-slate-900">{tr("Telegram Channel Configuration")}</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">
              {tr("Public channel ID")}
            </label>
            <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900">
              {form.publicChannelId || tr("Not set in backend .env")}
            </div>
            <p className="text-xs font-semibold text-slate-500">
              {tr("This value now comes from backend .env and cannot be edited from the admin panel.")}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">
              {tr("Public channel username")}
            </label>
            <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900">
              {form.publicChannelUsername
                ? `@${String(form.publicChannelUsername).replace(/^@+/, "")}`
                : tr("Not set in backend .env")}
            </div>
            <p className="text-xs font-semibold text-slate-500">
              {tr("This value now comes from backend .env and is shown here only for reference.")}
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <ToggleRow
            label={tr("Auto-post new courses")}
            hint={tr("Send a Telegram announcement whenever a course becomes publicly published.")}
            checked={form.autoPostCourses}
            onChange={(value) => setForm((prev) => ({ ...prev, autoPostCourses: value }))}
            disabled={disableActions}
          />
          <ToggleRow
            label={tr("Auto-post approved teachers")}
            hint={tr("Send a Telegram announcement when an admin approves a teacher profile.")}
            checked={form.autoPostTeachers}
            onChange={(value) => setForm((prev) => ({ ...prev, autoPostTeachers: value }))}
            disabled={disableActions}
          />
          <ToggleRow
            label={tr("Auto-post new events")}
            hint={tr("Keeps event announcements ready now and will activate once event creation exists in the platform.")}
            checked={form.autoPostEvents}
            onChange={(value) => setForm((prev) => ({ ...prev, autoPostEvents: value }))}
            disabled={disableActions}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={disableActions}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? tr("Saving") : tr("Save Settings")}
          </button>
          <button
            type="button"
            onClick={handleSendTestPost}
            disabled={disableActions}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Send size={16} />
            {testing ? tr("Sending") : tr("Send Test Post")}
          </button>
          <button
            type="button"
            onClick={() => loadPageData()}
            disabled={disableActions}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RotateCcw size={16} />
            {loading ? tr("Refreshing") : tr("Refresh")}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">{tr("Recent Telegram Posts")}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {tr("Review recent announcement delivery results for the Telegram channel.")}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
            {tr("Failures")}: {totalFailures}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 font-black">{tr("Type")}</th>
                <th className="px-3 py-3 font-black">{tr("Status")}</th>
                <th className="px-3 py-3 font-black">{tr("Date")}</th>
                <th className="px-3 py-3 font-black">{tr("Telegram Message ID")}</th>
                <th className="px-3 py-3 font-black">{tr("Error")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {posts.length ? (
                posts.map((post) => (
                  <tr key={post.id}>
                    <td className="px-3 py-3 font-semibold text-slate-900">{formatPostType(post.type)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                          post.status === "posted"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {formatPostStatus(post.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">{formatDateTime(post.createdAt)}</td>
                    <td className="px-3 py-3">{post.telegramMessageId || "-"}</td>
                    <td className="px-3 py-3 text-rose-700">{post.error || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-3 py-8 text-center font-semibold text-slate-500">
                    {tr("No Telegram posts have been recorded yet.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
