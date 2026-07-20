import ApiError from "./ApiError.js";

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const INSTAGRAM_CODE_PATTERN = /^[A-Za-z0-9_-]{5,100}$/;

const parseUrl = (value) => {
  const input = String(value || "").trim();
  if (!input) throw new ApiError(400, "Video link is required");

  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url;
  } catch {
    throw new ApiError(400, "Enter a valid YouTube or Instagram link");
  }
};

export const normalizeVideoLink = (value) => {
  const url = parseUrl(value);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (hostname === "youtu.be" || hostname === "youtube.com" || hostname === "m.youtube.com") {
    let videoId = "";
    if (hostname === "youtu.be") videoId = parts[0] || "";
    else if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
    else if (["embed", "shorts", "live"].includes(parts[0])) videoId = parts[1] || "";

    if (!YOUTUBE_ID_PATTERN.test(videoId)) {
      throw new ApiError(400, "This YouTube video link is not supported");
    }

    return {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      platform: "youtube",
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  if (hostname === "instagram.com") {
    const type = parts[0];
    const code = parts[1] || "";
    if (!["p", "reel", "tv"].includes(type) || !INSTAGRAM_CODE_PATTERN.test(code)) {
      throw new ApiError(400, "This Instagram post or reel link is not supported");
    }

    return {
      url: `https://www.instagram.com/${type}/${code}/`,
      platform: "instagram",
      embedUrl: `https://www.instagram.com/${type}/${code}/embed/`,
      thumbnailUrl: "",
    };
  }

  throw new ApiError(400, "Only YouTube and Instagram links are supported");
};

