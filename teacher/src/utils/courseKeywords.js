export const COURSE_KEYWORDS_MAX_ITEMS = 10;
export const COURSE_KEYWORD_MAX_CHARS = 30;

export const parseCourseKeywords = (value = "") => {
  const seen = new Set();
  const keywords = [];

  String(value || "")
    .normalize("NFKC")
    .split(/[\n,،;؛]+/u)
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .forEach((keyword) => {
      const key = keyword.toLocaleLowerCase("en");
      if (seen.has(key)) return;
      seen.add(key);
      keywords.push(keyword);
    });

  return keywords;
};

export const getCourseKeywordsError = (value = "", language = "fa") => {
  const keywords = parseCourseKeywords(value);
  if (keywords.length > COURSE_KEYWORDS_MAX_ITEMS) {
    return language === "fa"
      ? `حداکثر ${COURSE_KEYWORDS_MAX_ITEMS} کلیدواژه اضافه کنید.`
      : `Add no more than ${COURSE_KEYWORDS_MAX_ITEMS} keywords.`;
  }

  if (keywords.some((keyword) => keyword.length > COURSE_KEYWORD_MAX_CHARS)) {
    return language === "fa"
      ? `هر کلیدواژه باید حداکثر ${COURSE_KEYWORD_MAX_CHARS} کاراکتر باشد.`
      : `Each keyword must be ${COURSE_KEYWORD_MAX_CHARS} characters or fewer.`;
  }

  return "";
};
