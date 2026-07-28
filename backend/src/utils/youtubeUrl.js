const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;

const prepareUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const extracted = raw.match(/https?:\/\/[^\s]+/i)?.[0] || raw;
  const cleaned = extracted.replace(/[),.;]+$/g, "");
  return /^[a-z][a-z\d+.-]*:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned.replace(/^\/+/, "")}`;
};

export const getYouTubeVideoId = (value = "") => {
  try {
    const url = new URL(prepareUrl(value));
    if (!["http:", "https:"].includes(url.protocol)) return "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);
    let videoId = "";

    if (host === "youtu.be") {
      videoId = parts[0] || "";
    } else if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com")
    ) {
      if (url.pathname === "/watch" || url.pathname.startsWith("/watch/")) {
        videoId = url.searchParams.get("v") || "";
      } else if (["shorts", "embed", "live", "v"].includes(parts[0])) {
        videoId = parts[1] || "";
      }
    }

    return YOUTUBE_ID_PATTERN.test(videoId) ? videoId : "";
  } catch {
    return "";
  }
};

export const normalizeYouTubeUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const videoId = getYouTubeVideoId(raw);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
};
