export const DEFAULT_LANGUAGE = "fa";
export const SUPPORTED_LANGUAGES = ["fa", "en"];

const LANGUAGE_PREFIX_PATTERN = /^\/(fa|en)(?=\/|$)/;

export function getLanguageFromPathname(pathname = "") {
  return String(pathname || "").match(LANGUAGE_PREFIX_PATTERN)?.[1] || null;
}

export function getLocalizedBasename(pathname = "") {
  const language = getLanguageFromPathname(pathname);
  return language ? `/${language}` : "/";
}

export function stripLanguagePrefix(pathname = "/") {
  const normalized = String(pathname || "/").replace(LANGUAGE_PREFIX_PATTERN, "");
  if (!normalized) return "/";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function localizePath(pathname = "/", language = DEFAULT_LANGUAGE) {
  const normalizedLanguage = SUPPORTED_LANGUAGES.includes(language)
    ? language
    : DEFAULT_LANGUAGE;
  const appPath = stripLanguagePrefix(pathname);
  return `/${normalizedLanguage}${appPath === "/" ? "/" : appPath}`;
}

export function buildLocalizedSiteUrl(
  pathname = "/",
  language = DEFAULT_LANGUAGE,
  siteUrl = "https://edutech.study",
) {
  return `${String(siteUrl).replace(/\/+$/, "")}${localizePath(pathname, language)}`;
}
