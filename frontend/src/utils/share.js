import { getApiBase } from "../../services/http";

export const shareContent = async ({
  title = "",
  text = "",
  path = "",
  previewPath = "",
  url = "",
  includeText = false,
} = {}) => {
  const shareUrl =
    url ||
    (previewPath
      ? `${getApiBase()}${previewPath.startsWith("/") ? previewPath : `/${previewPath}`}`
      : typeof window !== "undefined"
        ? new URL(path || window.location.pathname, window.location.origin).toString()
        : path);

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      const sharePayload = { url: shareUrl };
      if (title) sharePayload.title = title;
      if (includeText && text) sharePayload.text = text;
      await navigator.share(sharePayload);
      return true;
    } catch (error) {
      if (error?.name === "AbortError") return false;
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareUrl);
    return true;
  }

  return false;
};
