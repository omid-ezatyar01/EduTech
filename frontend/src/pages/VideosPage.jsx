import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, Bookmark, ChevronDown, ExternalLink, Heart, Play, RefreshCw, Share2, Sparkles, Video } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { fetchPublicVideo, fetchPublicVideos, fetchVideoSocialState, toggleVideoLike, toggleVideoSave } from "../../services/videoService.js";
import { fetchTeacherFollowStatus, followTeacher, unfollowTeacher } from "../../services/teacherSocialService.js";
import { enableEduTechPushNotifications } from "../../services/pushNotifications.js";
import { getToken } from "../../services/portal.js";
import { resolveAvatarUrl } from "../utils/avatar.js";
import { shareContent } from "../utils/share.js";

const copy = {
  fa: {
    eyebrow: "کتابخانه ویدیویی ایجوتک", title: "یاد بگیرید، تماشا کنید، پیشرفت کنید",
    intro: "ویدیوهای آموزشی، نکته‌های کوتاه و تازه‌ترین محتوای ایجوتک را از یوتیوب و اینستاگرام یک‌جا ببینید.",
    all: "همه", youtube: "یوتیوب", instagram: "اینستاگرام", following: "دنبال‌شده‌ها", saved: "ذخیره‌شده‌ها", videos: "ویدیو",
    popular: "محبوب‌ترین", newest: "تازه‌ترین", trending: "پرطرفدار", sort: "مرتب‌سازی",
    empty: "هنوز ویدیویی در این بخش منتشر نشده است.", followingEmpty: "هنوز از استادان دنبال‌شده ویدیویی منتشر نشده است.", savedEmpty: "هنوز ویدیویی ذخیره نکرده‌اید.",
    error: "بارگذاری ویدیوها ناموفق بود.", actionError: "انجام این درخواست ناموفق بود. لطفاً دوباره تلاش کنید.", retry: "تلاش دوباره", watch: "تماشای ویدیو", like: "پسندیدن", save: "ذخیره", savedAction: "ذخیره‌شده", share: "اشتراک", shareCopied: "لینک ویدیو کاپی شد.",
    subscribe: "دنبال کردن", subscribed: "دنبال‌شده", by: "منتشرکننده", official: "صفحه رسمی ایجوتک", followConfirm: "با دنبال کردن این استاد، هنگام انتشار ویدیوی جدید از او اعلان دریافت می‌کنید. آیا می‌خواهید ادامه دهید؟", loadMore: "ویدیوهای بیشتر", loadingMore: "در حال دریافت ویدیوهای بیشتر…", shortFeed: "فهرست ویدیوها", close: "بستن", previous: "ویدیوی قبلی", next: "ویدیوی بعدی",
  },
  en: {
    eyebrow: "EduTech video library", title: "Watch, learn, and keep growing",
    intro: "Explore EduTech lessons, quick tips, and fresh content from YouTube and Instagram in one place.",
    all: "All", youtube: "YouTube", instagram: "Instagram", following: "Following", saved: "Saved", videos: "videos",
    popular: "Most popular", newest: "Newest", trending: "Trending", sort: "Sort videos",
    empty: "No videos have been published in this section yet.", followingEmpty: "No videos from followed teachers yet.", savedEmpty: "You have not saved any videos yet.",
    error: "Could not load the videos.", actionError: "This request failed. Please try again.", retry: "Try again", watch: "Watch video", like: "Like", save: "Save", savedAction: "Saved", share: "Share", shareCopied: "Video link copied.",
    subscribe: "Follow", subscribed: "Following", by: "Published by", official: "Official EduTech", followConfirm: "By following this teacher, you will receive notifications when they publish a new video. Do you want to continue?", loadMore: "Load more videos", loadingMore: "Loading more videos…", shortFeed: "Video library", close: "Close", previous: "Previous video", next: "Next video",
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
    {embedUrl ? <iframe onLoad={() => setLoaded(true)} src={embedUrl} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen scrolling="no" className={`h-full w-full border-0 bg-white transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}/> : null}
  </div>;
};

const PAGE_SIZE = 6;
const EMPTY_FEED = { videos: [], meta: { page: 0, hasMore: true, total: 0 }, loaded: false };
const feedKeyFor = (filter, sort) => `${filter}:${sort}`;
const requestFor = (filter, sort, page) => ({
  feed: ["following", "saved"].includes(filter) ? filter : "all",
  platform: ["youtube", "instagram"].includes(filter) ? filter : "all",
  sort,
  page,
  limit: PAGE_SIZE,
});

const sortedClientVideos = (videos, sort) => [...videos].sort((left, right) => {
  if (sort === "newest") return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  if (sort === "trending") {
    const score = (item) => Number(item.likeCount || 0) * 3 + new Date(item.createdAt).getTime() / 86400000;
    return score(right) - score(left);
  }
  return Number(right.likeCount || 0) - Number(left.likeCount || 0) || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
});

export default function VideosPage({ language = "fa" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const text = copy[language === "fa" ? "fa" : "en"];
  const [feeds, setFeeds] = useState({});
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("popular");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [likedIds, setLikedIds] = useState(() => new Set());
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [followingByTeacher, setFollowingByTeacher] = useState({});
  const [busyKey, setBusyKey] = useState("");
  const [activeVideoId, setActiveVideoId] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef(null);

  const feedKey = feedKeyFor(filter, sort);
  const currentFeed = feeds[feedKey] || EMPTY_FEED;
  const visible = currentFeed.videos;

  const applySocialState = useCallback(async (rows, activeCheck = () => true) => {
    if (!getToken() || !rows.length) return;
    const social = await fetchVideoSocialState().catch(() => ({ likedVideoIds: [], savedVideoIds: [] }));
    const teacherIds = [...new Set(rows.map((row) => String(row?.teacher?._id || "")).filter(Boolean))];
    const statuses = await Promise.all(teacherIds.map(async (teacherId) => [teacherId, await fetchTeacherFollowStatus(teacherId).catch(() => ({ following: false }))]));
    if (!activeCheck()) return;
    setLikedIds(new Set(social.likedVideoIds || []));
    setSavedIds(new Set(social.savedVideoIds || []));
    setFollowingByTeacher((previous) => ({ ...previous, ...Object.fromEntries(statuses.map(([id, status]) => [id, Boolean(status.following)])) }));
  }, []);

  const loadFeed = useCallback(async (nextFilter, nextSort, activeCheck = () => true) => {
    setLoading(true); setError(""); setActiveVideoId("");
    try {
      const result = await fetchPublicVideos(requestFor(nextFilter, nextSort, 1));
      if (!activeCheck()) return;
      const key = feedKeyFor(nextFilter, nextSort);
      setFeeds((previous) => ({ ...previous, [key]: { videos: result.videos, meta: result.meta, loaded: true } }));
      await applySocialState(result.videos, activeCheck);
    } catch { if (activeCheck()) setError(text.error); }
    finally { if (activeCheck()) setLoading(false); }
  }, [applySocialState, text.error]);

  useEffect(() => {
    let active = true;
    window.scrollTo(0, 0);
    const sharedVideoId = new URLSearchParams(location.search).get("video") || "";
    (async () => {
      await loadFeed("all", "popular", () => active);
      if (!active || !sharedVideoId) return;
      const sharedVideo = await fetchPublicVideo(sharedVideoId).catch(() => null);
      if (!active || !sharedVideo) return;
      setFeeds((previous) => {
        const key = feedKeyFor("all", "popular");
        const feed = previous[key] || EMPTY_FEED;
        const videos = feed.videos.some((item) => item._id === sharedVideo._id) ? feed.videos : [sharedVideo, ...feed.videos];
        return { ...previous, [key]: { ...feed, videos, loaded: true } };
      });
      setActiveVideoId(sharedVideo._id);
    })();
    return () => { active = false; };
  }, [loadFeed, location.search]);

  const filters = [["all", Video], ["youtube", Video], ["instagram", Video], ["following", BellRing], ["saved", Bookmark]];
  const sorts = ["popular", "newest", "trending"];

  const selectFilter = async (nextFilter) => {
    if (["following", "saved"].includes(nextFilter) && !getToken()) { navigate("/login"); return; }
    setFilter(nextFilter); setError(""); setActiveVideoId("");
    const nextKey = feedKeyFor(nextFilter, sort);
    if (feeds[nextKey]?.loaded) { setLoading(false); return; }
    await loadFeed(nextFilter, sort);
  };

  const selectSort = async (nextSort) => {
    setSort(nextSort); setError(""); setActiveVideoId("");
    const nextKey = feedKeyFor(filter, nextSort);
    if (feeds[nextKey]?.loaded) { setLoading(false); return; }
    await loadFeed(filter, nextSort);
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !currentFeed.meta?.hasMore) return [];
    setLoadingMore(true); setError("");
    try {
      const nextPage = Number(currentFeed.meta?.page || 1) + 1;
      const result = await fetchPublicVideos(requestFor(filter, sort, nextPage));
      setFeeds((previous) => ({ ...previous, [feedKey]: { videos: [...(previous[feedKey]?.videos || []), ...result.videos], meta: result.meta, loaded: true } }));
      await applySocialState(result.videos);
      return result.videos;
    } catch { setError(text.error); return []; }
    finally { setLoadingMore(false); }
  }, [applySocialState, currentFeed.meta, feedKey, filter, loadingMore, sort, text.error]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loading || loadingMore || error || !currentFeed.meta?.hasMore) return undefined;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) loadMore(); }, { rootMargin: "320px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [currentFeed.meta?.hasMore, error, loadMore, loading, loadingMore]);

  const requireLogin = () => { if (getToken()) return true; navigate("/login"); return false; };
  const updateVideoAcrossFeeds = (videoId, updater) => setFeeds((previous) => Object.fromEntries(Object.entries(previous).map(([key, feed]) => {
    const nextVideos = feed.videos.map((row) => row._id === videoId ? updater(row) : row);
    const feedSort = key.split(":")[1] || "popular";
    return [key, { ...feed, videos: sortedClientVideos(nextVideos, feedSort) }];
  })));

  const handleLike = async (item) => {
    if (!requireLogin() || busyKey) return;
    setBusyKey(`like:${item._id}`);
    try {
      const result = await toggleVideoLike(item._id);
      setLikedIds((previous) => { const next = new Set(previous); if (result.liked) next.add(item._id); else next.delete(item._id); return next; });
      updateVideoAcrossFeeds(item._id, (row) => ({ ...row, likeCount: Number(result.likeCount || 0) }));
    } catch { setError(text.actionError); }
    finally { setBusyKey(""); }
  };

  const handleSave = async (item) => {
    if (!requireLogin() || busyKey) return;
    setBusyKey(`save:${item._id}`);
    try {
      const result = await toggleVideoSave(item._id);
      setSavedIds((previous) => { const next = new Set(previous); if (result.saved) next.add(item._id); else next.delete(item._id); return next; });
      if (!result.saved) {
        setFeeds((previous) => Object.fromEntries(Object.entries(previous).map(([key, feed]) => key.startsWith("saved:")
          ? [key, { ...feed, videos: feed.videos.filter((row) => row._id !== item._id), meta: { ...feed.meta, total: Math.max(0, Number(feed.meta?.total || 0) - 1) } }]
          : [key, feed])));
      } else {
        setFeeds((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith("saved:"))));
      }
    } catch { setError(text.actionError); }
    finally { setBusyKey(""); }
  };

  const handleShare = async (item) => {
    const url = new URL(location.pathname, window.location.origin);
    url.searchParams.set("video", item._id);
    const shared = await shareContent({ title: item.title, url: url.toString() });
    if (shared && !navigator.share) {
      setNotice(text.shareCopied);
      window.setTimeout(() => setNotice(""), 2600);
    }
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
      setFeeds((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith("following:"))));
      if (current && filter === "following") {
        setFeeds((previous) => ({ ...previous, [feedKey]: { ...currentFeed, videos: currentFeed.videos.filter((row) => String(row?.teacher?._id || "") !== teacherId) } }));
      }
    } catch { setError(text.actionError); }
    finally { setBusyKey(""); }
  };

  const openVideo = (item) => {
    setActiveVideoId(item._id);
  };
  const emptyMessage = filter === "following" ? text.followingEmpty : filter === "saved" ? text.savedEmpty : text.empty;

  return (
    <div className="min-h-screen bg-slate-50 pb-16" dir={language === "fa" ? "rtl" : "ltr"}>
      <section className="px-4 pt-8 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-[1536px] overflow-hidden rounded-3xl border border-slate-100 bg-white px-5 py-10 shadow-sm sm:px-8 sm:py-14">
          <div className="absolute -start-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl"/>
          <div className="absolute -bottom-24 end-0 h-72 w-72 rounded-full bg-teal-100/70 blur-3xl"/>
          <div className="relative mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-black text-teal-700"><Play size={16} fill="currentColor"/>{text.eyebrow}</div>
            <h1 className="mx-auto mt-5 max-w-4xl text-3xl font-black leading-tight text-slate-950 sm:text-5xl">{text.title}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base">{text.intro}</p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1340px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">{text.shortFeed}</p><p className="mt-1 text-sm font-bold text-slate-500">{Number(currentFeed.meta?.total || 0).toLocaleString(language === "fa" ? "fa-AF" : "en-US")} {text.videos} · {text[filter]}</p></div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filters.map(([key, Icon]) => <button key={key} type="button" onClick={() => selectFilter(key)} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-black transition ${filter === key ? key === "youtube" ? "border-red-600 bg-red-600 text-white shadow-lg shadow-red-200" : key === "instagram" ? "border-fuchsia-600 bg-gradient-to-r from-fuchsia-600 to-orange-500 text-white shadow-lg shadow-fuchsia-200" : "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"}`}><Icon size={16}/>{text[key]}</button>)}
            </div>
            <label className="relative shrink-0"><span className="sr-only">{text.sort}</span><Sparkles size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-blue-600"/><select value={sort} onChange={(event) => selectSort(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white ps-9 pe-9 text-sm font-black text-slate-700 outline-none focus:border-blue-400 sm:w-auto">{sorts.map((key) => <option key={key} value={key}>{text[key]}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-slate-400"/></label>
          </div>
        </div>

        {notice && <div className="fixed bottom-5 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-2xl">{notice}</div>}
        {loading ? <div className="mx-auto grid max-w-[1120px] gap-6 pt-8 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((key) => <div key={key} className="overflow-hidden rounded-3xl border border-slate-200 bg-white"><div className="aspect-[4/3] animate-pulse bg-slate-200"/><div className="space-y-3 p-5"><div className="h-5 w-2/3 animate-pulse rounded bg-slate-200"/><div className="h-4 w-full animate-pulse rounded bg-slate-100"/></div></div>)}</div> : error ? <div className="mt-8 rounded-3xl border border-red-200 bg-white py-16 text-center"><p className="font-bold text-red-700">{error}</p><button onClick={() => loadFeed(filter, sort)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white"><RefreshCw size={17}/>{text.retry}</button></div> : visible.length === 0 ? <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-center"><Video className="mx-auto text-slate-300" size={48}/><p className="mt-3 font-bold text-slate-500">{emptyMessage}</p></div> : (
          <div className="mx-auto grid max-w-[1120px] items-stretch gap-6 pt-8 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((item, index) => {
              const embedUrl = trustedEmbed(item.embedUrl);
              const isYoutube = item.platform === "youtube";
              const teacherId = String(item?.teacher?._id || "");
              const publisherName = item?.teacher?.name || "EduTech";
              const publisherAvatar = resolveAvatarUrl(item?.teacher?.avatar || "") || "/icons/favicon-96x96.png";
              const isLiked = likedIds.has(item._id);
              const isSaved = savedIds.has(item._id);
              const isFollowing = Boolean(followingByTeacher[teacherId]);
              return <article key={item._id} className="group flex h-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-[0_22px_50px_rgba(37,99,235,0.14)]">
                <div className={`relative shrink-0 overflow-hidden bg-slate-950 transition-[aspect-ratio] duration-300 ${!isYoutube && activeVideoId === item._id ? "aspect-square max-h-[420px]" : "aspect-video"}`}>
                  <VideoPreview key={`${item._id}:${activeVideoId === item._id ? "active" : "cover"}`} active={activeVideoId === item._id} embedUrl={embedUrl} onActivate={() => openVideo(item)} playLabel={text.watch} thumbnailUrl={item.thumbnailUrl} title={item.title}/>
                  <span className={`pointer-events-none absolute start-3 top-3 z-20 rounded-full border px-3 py-1.5 text-xs font-black shadow-sm backdrop-blur ${index === 0 ? "border-amber-200 bg-amber-50/95 text-amber-800" : index < 3 ? "border-blue-200 bg-blue-50/95 text-blue-700" : "border-white/70 bg-white/90 text-slate-700"}`}>{language === "fa" ? "رتبه" : "Rank"} #{index + 1}</span>
                </div>
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3"><div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${isYoutube ? "bg-red-50 text-red-700 ring-1 ring-red-100" : "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-100"}`}><Video size={15}/>{text[item.platform]}</div><span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">EduTech</span></div>
                  <h2 className="mt-4 line-clamp-2 text-lg font-black leading-7 text-slate-950 sm:text-xl">{item.title}</h2>
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <Link to={teacherId ? `/teacher/${teacherId}` : "/about"} className="flex min-w-0 items-center gap-2.5"><img src={publisherAvatar} alt={publisherName} className="h-11 w-11 rounded-full border-2 border-white object-cover shadow-sm"/><span className="min-w-0"><span className="block text-[11px] font-bold text-slate-400">{text.by}</span><span className="block truncate text-sm font-black text-slate-900">{publisherName}</span><span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-400">{teacherId ? item?.teacher?.teacherApplication?.professionalTitle || text.subscribe : text.official}</span></span></Link>
                    {teacherId ? <button onClick={() => handleFollow(teacherId)} disabled={busyKey === `follow:${teacherId}`} className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition ${isFollowing ? "border border-blue-200 bg-white text-blue-700" : "bg-blue-600 text-white"}`}>{isFollowing ? <BellRing size={14}/> : <Bell size={14}/>} {isFollowing ? text.subscribed : text.subscribe}</button> : null}
                  </div>
                  <div className="mt-auto pt-5">
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      <button onClick={() => handleLike(item)} disabled={busyKey === `like:${item._id}`} className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-black transition ${isLiked ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600"}`}><Heart size={16} fill={isLiked ? "currentColor" : "none"}/><span>{Number(item.likeCount || 0).toLocaleString(language === "fa" ? "fa-AF" : "en-US")}</span></button>
                      <button onClick={() => handleSave(item)} disabled={busyKey === `save:${item._id}`} className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-black transition ${isSaved ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"}`}><Bookmark size={16} fill={isSaved ? "currentColor" : "none"}/>{isSaved ? text.savedAction : text.save}</button>
                      <button onClick={() => handleShare(item)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-xs font-black text-slate-600 transition hover:border-blue-200 hover:text-blue-700"><Share2 size={16}/>{text.share}</button>
                    </div>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 ${isYoutube ? "bg-gradient-to-r from-red-600 to-rose-500 shadow-red-100 hover:shadow-red-200" : "bg-gradient-to-r from-fuchsia-600 via-purple-600 to-orange-500 shadow-fuchsia-100 hover:shadow-fuchsia-200"}`}><span className="inline-flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/15"><Play size={15} fill="currentColor"/></span>{text.watch}</span><ExternalLink size={17}/></a>
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
