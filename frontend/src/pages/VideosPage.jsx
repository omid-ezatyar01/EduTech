import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, ExternalLink, Heart, Play, RefreshCw, Video } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { fetchPublicVideos, fetchVideoSocialState, toggleVideoLike } from "../../services/videoService.js";
import { fetchTeacherFollowStatus, followTeacher, unfollowTeacher } from "../../services/teacherSocialService.js";
import { enableEduTechPushNotifications } from "../../services/pushNotifications.js";
import { getToken } from "../../services/portal.js";
import { resolveAvatarUrl } from "../utils/avatar.js";

const copy = {
  fa: {
    eyebrow: "کتابخانه ویدیویی ایجوتک", title: "یاد بگیرید، تماشا کنید، پیشرفت کنید",
    intro: "ویدیوهای آموزشی، نکته‌های کوتاه و تازه‌ترین محتوای ایجوتک را از یوتیوب و اینستاگرام یک‌جا ببینید.",
    all: "همه", youtube: "یوتیوب", instagram: "اینستاگرام", videos: "ویدیو", empty: "هنوز ویدیویی در این بخش منتشر نشده است.",
    error: "بارگذاری ویدیوها ناموفق بود.", actionError: "انجام این درخواست ناموفق بود. لطفاً دوباره تلاش کنید.", retry: "تلاش دوباره", watch: "تماشای ویدیو", like: "پسندیدن", subscribe: "دنبال کردن", subscribed: "دنبال‌شده", by: "منتشرکننده", official: "صفحه رسمی ایجوتک", followConfirm: "با دنبال کردن این استاد، هنگام انتشار ویدیوی جدید از او اعلان دریافت می‌کنید. آیا می‌خواهید ادامه دهید؟", loadMore: "ویدیوهای بیشتر", loadingMore: "در حال دریافت ویدیوهای بیشتر…", shortFeed: "فهرست ویدیوها",
  },
  en: {
    eyebrow: "EduTech video library", title: "Watch, learn, and keep growing",
    intro: "Explore EduTech lessons, quick tips, and fresh content from YouTube and Instagram in one place.",
    all: "All", youtube: "YouTube", instagram: "Instagram", videos: "videos", empty: "No videos have been published in this section yet.",
    error: "Could not load the videos.", actionError: "This request failed. Please try again.", retry: "Try again", watch: "Watch video", like: "Like", subscribe: "Follow", subscribed: "Following", by: "Published by", official: "Official EduTech", followConfirm: "By following this teacher, you will receive notifications when they publish a new video. Do you want to continue?", loadMore: "Load more videos", loadingMore: "Loading more videos…", shortFeed: "Video library",
  },
};

const trustedEmbed = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    return url.protocol === "https:" && ["youtube.com", "youtube-nocookie.com", "instagram.com"].includes(host) ? url.toString() : "";
  } catch { return ""; }
};

const VideoPreview = ({ active, embedUrl, onActivate, playLabel, thumbnailUrl, title }) => {
  const [loaded, setLoaded] = useState(false);

  if (!active) {
    return <div className="relative h-full w-full bg-gradient-to-br from-white via-blue-50 to-cyan-50">
      <img src="/logo.png" alt="" className="absolute inset-0 m-auto w-[72%] max-w-sm object-contain"/>
      {thumbnailUrl ? <img src={thumbnailUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover"/> : null}
      {embedUrl ? <button type="button" onClick={onActivate} aria-label={`${playLabel}: ${title}`} className="absolute inset-0 z-10 grid place-items-center bg-slate-950/10 transition hover:bg-slate-950/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-500">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-blue-700 shadow-xl transition duration-300 hover:scale-110"><Play size={28} fill="currentColor"/></span>
      </button> : null}
    </div>;
  }

  return <div className="relative h-full w-full bg-white">
    <div className={`pointer-events-none absolute inset-0 z-10 grid place-items-center bg-gradient-to-br from-white via-blue-50 to-cyan-50 transition-opacity duration-500 ${loaded ? "opacity-0" : "opacity-100"}`} aria-hidden="true">
      <img src="/logo.png" alt="" className="w-[72%] max-w-sm object-contain"/>
    </div>
    {embedUrl ? <iframe onLoad={() => setLoaded(true)} src={embedUrl} title={title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen scrolling="no" className={`h-full w-full border-0 bg-white transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}/> : null}
  </div>;
};

const PAGE_SIZE = 4;
const createEmptyFeed = () => ({ videos: [], meta: { page: 0, hasMore: true, total: 0 }, loaded: false });

export default function VideosPage({ language = "fa" }) {
  const navigate = useNavigate();
  const text = copy[language === "fa" ? "fa" : "en"];
  const [feeds, setFeeds] = useState(() => ({ all: createEmptyFeed(), youtube: createEmptyFeed(), instagram: createEmptyFeed() }));
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [likedIds, setLikedIds] = useState(() => new Set());
  const [followingByTeacher, setFollowingByTeacher] = useState({});
  const [busyKey, setBusyKey] = useState("");
  const [activeVideoId, setActiveVideoId] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef(null);

  const currentFeed = feeds[filter];
  const visible = currentFeed.videos;

  const applySocialState = useCallback(async (rows, activeCheck = () => true) => {
    if (!getToken() || !rows.length) return;
    const social = await fetchVideoSocialState().catch(() => ({ likedVideoIds: [] }));
    const teacherIds = [...new Set(rows.map((row) => String(row?.teacher?._id || "")).filter(Boolean))];
    const statuses = await Promise.all(teacherIds.map(async (teacherId) => [teacherId, await fetchTeacherFollowStatus(teacherId).catch(() => ({ following: false }))]));
    if (!activeCheck()) return;
    setLikedIds(new Set(social.likedVideoIds || []));
    setFollowingByTeacher((previous) => ({ ...previous, ...Object.fromEntries(statuses.map(([id, status]) => [id, Boolean(status.following)])) }));
  }, []);

  const load = async () => {
    setLoading(true); setError(""); setActiveVideoId("");
    try {
      const result = await fetchPublicVideos({ platform: filter, page: 1, limit: PAGE_SIZE });
      setFeeds((previous) => ({ ...previous, [filter]: { videos: result.videos, meta: result.meta, loaded: true } }));
      await applySocialState(result.videos);
    }
    catch { setError(text.error); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    window.scrollTo(0, 0);
    fetchPublicVideos({ platform: "all", page: 1, limit: PAGE_SIZE })
      .then(async (result) => {
        if (!active) return;
        setFeeds((previous) => ({ ...previous, all: { videos: result.videos, meta: result.meta, loaded: true } }));
        await applySocialState(result.videos, () => active);
      })
      .catch(() => { if (active) setError(text.error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applySocialState, text.error]);
  const filters = [["all", Video], ["youtube", Video], ["instagram", Video]];

  const selectPlatform = async (platform) => {
    setFilter(platform); setError(""); setActiveVideoId("");
    if (feeds[platform].loaded) return;
    setLoading(true);
    try {
      const result = await fetchPublicVideos({ platform, page: 1, limit: PAGE_SIZE });
      setFeeds((previous) => ({ ...previous, [platform]: { videos: result.videos, meta: result.meta, loaded: true } }));
      await applySocialState(result.videos);
    } catch { setError(text.error); }
    finally { setLoading(false); }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !currentFeed.meta?.hasMore) return;
    setLoadingMore(true); setError("");
    try {
      const nextPage = Number(currentFeed.meta?.page || 1) + 1;
      const result = await fetchPublicVideos({ platform: filter, page: nextPage, limit: PAGE_SIZE });
      setFeeds((previous) => ({ ...previous, [filter]: { videos: [...previous[filter].videos, ...result.videos], meta: result.meta, loaded: true } }));
      await applySocialState(result.videos);
    } catch { setError(text.error); }
    finally { setLoadingMore(false); }
  }, [applySocialState, currentFeed.meta, filter, loadingMore, text.error]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loading || loadingMore || error || !currentFeed.meta?.hasMore) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [currentFeed.meta?.hasMore, error, loadMore, loading, loadingMore]);

  const requireLogin = () => { if (getToken()) return true; navigate("/login"); return false; };
  const handleLike = async (item) => {
    if (!requireLogin() || busyKey) return;
    setBusyKey(`like:${item._id}`);
    try {
      const result = await toggleVideoLike(item._id);
      setLikedIds((previous) => { const next = new Set(previous); if (result.liked) next.add(item._id); else next.delete(item._id); return next; });
      setFeeds((previous) => {
        const videos = previous[filter].videos
          .map((row) => row._id === item._id ? { ...row, likeCount: Number(result.likeCount || 0) } : row)
          .sort((left, right) => Number(right.likeCount || 0) - Number(left.likeCount || 0));
        return { ...previous, [filter]: { ...previous[filter], videos } };
      });
    } catch { setError(text.actionError); }
    finally { setBusyKey(""); }
  };
  const handleFollow = async (teacherId) => {
    if (!requireLogin() || busyKey) return;
    const current = Boolean(followingByTeacher[teacherId]);
    if (!current && !window.confirm(text.followConfirm)) return;
    setBusyKey(`follow:${teacherId}`);
    try {
      if (!current) await enableEduTechPushNotifications({ forcePrompt: true }).catch(() => false);
      const result = current ? await unfollowTeacher(teacherId) : await followTeacher(teacherId);
      setFollowingByTeacher((previous) => ({ ...previous, [teacherId]: Boolean(result.following) }));
    } catch { setError(text.actionError); }
    finally { setBusyKey(""); }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16" dir={language === "fa" ? "rtl" : "ltr"}>
      <section className="relative overflow-hidden bg-slate-950 px-4 py-16 text-white sm:py-20">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-600/30 blur-3xl"/><div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl"/>
        <div className="relative mx-auto max-w-5xl text-center"><div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-teal-300"><Play size={16} fill="currentColor"/>{text.eyebrow}</div><h1 className="mx-auto mt-5 max-w-4xl text-3xl font-black leading-tight sm:text-5xl">{text.title}</h1><p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-7 text-slate-300 sm:text-base">{text.intro}</p></div>
      </section>

      <main className="mx-auto max-w-[1340px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">{text.shortFeed}</p><p className="mt-1 text-sm font-bold text-slate-500">{Number(currentFeed.meta?.total || 0).toLocaleString(language === "fa" ? "fa-AF" : "en-US")} {text.videos} · {text[filter]}</p></div>
          <div className="flex gap-2 overflow-x-auto pb-2">
          {filters.map(([key, Icon]) => <button key={key} type="button" onClick={() => selectPlatform(key)} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-5 py-3 text-sm font-black transition ${filter === key ? key === "youtube" ? "border-red-600 bg-red-600 text-white shadow-lg shadow-red-200" : key === "instagram" ? "border-fuchsia-600 bg-gradient-to-r from-fuchsia-600 to-orange-500 text-white shadow-lg shadow-fuchsia-200" : "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"}`}><Icon size={17}/>{text[key]}</button>)}
          </div>
        </div>

        {loading ? <div className="mx-auto grid max-w-[1120px] gap-6 pt-8 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((key) => <div key={key} className="overflow-hidden rounded-3xl border border-slate-200 bg-white"><div className="aspect-[4/3] animate-pulse bg-slate-200"/><div className="space-y-3 p-5"><div className="h-5 w-2/3 animate-pulse rounded bg-slate-200"/><div className="h-4 w-full animate-pulse rounded bg-slate-100"/></div></div>)}</div> : error ? <div className="mt-8 rounded-3xl border border-red-200 bg-white py-16 text-center"><p className="font-bold text-red-700">{error}</p><button onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white"><RefreshCw size={17}/>{text.retry}</button></div> : visible.length === 0 ? <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-center"><Video className="mx-auto text-slate-300" size={48}/><p className="mt-3 font-bold text-slate-500">{text.empty}</p></div> : (
          <div className="mx-auto grid max-w-[1120px] items-stretch gap-6 pt-8 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((item) => {
              const embedUrl = trustedEmbed(item.embedUrl);
              const PlatformIcon = Video;
              const isYoutube = item.platform === "youtube";
              const teacherId = String(item?.teacher?._id || "");
              const publisherName = item?.teacher?.name || "EduTech";
              const publisherAvatar = resolveAvatarUrl(item?.teacher?.avatar || "") || "/icons/favicon-96x96.png";
              const isLiked = likedIds.has(item._id);
              const isFollowing = Boolean(followingByTeacher[teacherId]);
              return <article key={item._id} className="group flex h-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-[0_22px_50px_rgba(37,99,235,0.14)]">
                <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-slate-950">
                  <VideoPreview
                    key={`${item._id}:${activeVideoId === item._id ? "active" : "cover"}`}
                    active={activeVideoId === item._id}
                    embedUrl={embedUrl}
                    onActivate={() => setActiveVideoId(item._id)}
                    playLabel={text.watch}
                    thumbnailUrl={item.thumbnailUrl}
                    title={item.title}
                  />
                </div>
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${isYoutube ? "bg-red-50 text-red-700 ring-1 ring-red-100" : "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-100"}`}><PlatformIcon size={15}/>{text[item.platform]}</div>
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">EduTech</span>
                  </div>
                  <h2 className="mt-4 line-clamp-2 text-lg font-black leading-7 text-slate-950 sm:text-xl">{item.title}</h2>
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <Link to={teacherId ? `/teacher/${teacherId}` : "/about"} className="flex min-w-0 items-center gap-2.5"><img src={publisherAvatar} alt={publisherName} className="h-11 w-11 rounded-full border-2 border-white object-cover shadow-sm"/><span className="min-w-0"><span className="block text-[11px] font-bold text-slate-400">{text.by}</span><span className="block truncate text-sm font-black text-slate-900">{publisherName}</span><span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-400">{teacherId ? item?.teacher?.teacherApplication?.professionalTitle || text.subscribe : text.official}</span></span></Link>
                    {teacherId ? <button onClick={() => handleFollow(teacherId)} disabled={busyKey === `follow:${teacherId}`} className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition ${isFollowing ? "border border-blue-200 bg-white text-blue-700" : "bg-blue-600 text-white"}`}>{isFollowing ? <BellRing size={14}/> : <Bell size={14}/>} {isFollowing ? text.subscribed : text.subscribe}</button> : null}
                  </div>
                  <div className="mt-auto pt-5">
                    <button onClick={() => handleLike(item)} disabled={busyKey === `like:${item._id}`} className={`mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black transition ${isLiked ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600"}`}><Heart size={17} fill={isLiked ? "currentColor" : "none"}/>{text.like}<span>{Number(item.likeCount || 0).toLocaleString(language === "fa" ? "fa-AF" : "en-US")}</span></button>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 ${isYoutube ? "bg-gradient-to-r from-red-600 to-rose-500 shadow-red-100 hover:shadow-red-200" : "bg-gradient-to-r from-fuchsia-600 via-purple-600 to-orange-500 shadow-fuchsia-100 hover:shadow-fuchsia-200"}`}>
                      <span className="inline-flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/15"><Play size={15} fill="currentColor"/></span>{text.watch}</span>
                      <ExternalLink size={17}/>
                    </a>
                  </div>
                </div>
              </article>;
            })}
          </div>
        )}
        {!loading && !error && visible.length > 0 && currentFeed.meta?.hasMore && <div ref={loadMoreRef} className="mt-8 flex min-h-16 items-center justify-center" aria-live="polite">{loadingMore && <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-600 shadow-sm"><RefreshCw size={17} className="animate-spin"/>{text.loadingMore}</span>}</div>}
      </main>
    </div>
  );
}
