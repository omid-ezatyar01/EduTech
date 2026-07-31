const PERSIAN_CHARACTER_MAP = new Map([
  ["ي", "ی"],
  ["ى", "ی"],
  ["ئ", "ی"],
  ["ك", "ک"],
  ["ة", "ه"],
  ["ۀ", "ه"],
  ["ؤ", "و"],
]);

const SEARCH_SYNONYM_GROUPS = [
  ["english", "انگلیسی", "زبان انگلیسی", "انگليسي"],
  ["persian", "farsi", "فارسی", "دری", "زبان فارسی", "زبان دری"],
  ["programming", "coding", "برنامه نویسی", "کدنویسی", "کود نویسی"],
  ["javascript", "js", "جاوا اسکریپت", "جاوااسکریپت"],
  ["python", "پایتون", "پای‌تون"],
  ["artificial intelligence", "ai", "machine learning", "هوش مصنوعی", "یادگیری ماشین"],
  ["data science", "تحلیل داده", "علم داده", "دیتا ساینس"],
  ["computer", "کامپیوتر", "کمپیوتر", "رایانه"],
  ["web development", "website", "وب", "طراحی وب", "توسعه وب", "ساخت سایت"],
  ["design", "graphic design", "دیزاین", "طراحی", "طراحی گرافیک", "گرافیک"],
  ["business", "تجارت", "کسب و کار", "بازرگانی"],
  ["marketing", "بازاریابی", "مارکتینگ"],
  ["digital marketing", "بازاریابی دیجیتال", "دیجیتال مارکتینگ"],
  ["management", "مدیریت"],
  ["accounting", "حسابداری"],
  ["mathematics", "math", "ریاضی", "ریاضیات"],
  ["statistics", "آمار"],
  ["speaking", "conversation", "مکالمه", "گفتگو", "صحبت کردن"],
  ["grammar", "گرامر", "دستور زبان"],
  ["ielts", "آیلتس", "ایلتس"],
  ["seo", "سئو", "بهینه سازی موتور جستجو"],
  ["beginner", "basic", "مقدماتی", "مبتدی"],
  ["intermediate", "متوسط"],
  ["advanced", "پیشرفته", "حرفه ای"],
];

const FIELD_DEFINITIONS = [
  { keys: ["title"], weight: 12 },
  { keys: ["tags"], weight: 10 },
  { keys: ["subcategoryName", "subcategory.name"], weight: 9 },
  { keys: ["categoryName", "category.name", "categoryPathLabel"], weight: 8 },
  { keys: ["curriculumTopics"], weight: 7 },
  { keys: ["whatYouWillLearn"], weight: 6 },
  { keys: ["targetAudience"], weight: 5 },
  { keys: ["description"], weight: 3 },
  { keys: ["requirements"], weight: 2.5 },
  { keys: ["teacherName", "teacher.name", "teacher"], weight: 2 },
  { keys: ["language", "level"], weight: 2 },
];

const readPath = (value, path) =>
  path.split(".").reduce((current, key) => current?.[key], value);

const flattenText = (value) => {
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (value && typeof value === "object") {
    return [value.name, value.title, value.username].filter(Boolean).join(" ");
  }
  return String(value || "");
};

export const normalizeCourseSearchText = (value = "") =>
  String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[يىئكةۀؤ]/g, (character) => PERSIAN_CHARACTER_MAP.get(character) || character)
    .replace(/[۰-۹٠-٩]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, " ")
    .replace(/[_/\\|+()[\]{}.,:;!?'"`~@#$%^&*=<>،؛؟«»–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value) =>
  normalizeCourseSearchText(value)
    .split(" ")
    .filter(Boolean);

const levenshteinDistance = (left, right, maximum = 2) => {
  if (Math.abs(left.length - right.length) > maximum) return maximum + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = current[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost,
      );
      rowMinimum = Math.min(rowMinimum, current[rightIndex]);
    }
    if (rowMinimum > maximum) return maximum + 1;
    previous = current;
  }

  return previous[right.length];
};

const getTermMatchQuality = (term, fieldText, fieldTokens) => {
  if (!term || !fieldText) return 0;
  if (fieldTokens.includes(term)) return 1;
  if (fieldText.includes(term)) return 0.82;

  const minimumPartialLength = /[a-z0-9]/.test(term) ? 3 : 2;
  if (
    term.length >= minimumPartialLength &&
    fieldTokens.some((word) => word.startsWith(term) || term.startsWith(word))
  ) {
    return 0.7;
  }

  if (term.length < 4) return 0;
  const allowedDistance = term.length >= 8 ? 2 : 1;
  const fuzzyMatch = fieldTokens.some(
    (word) =>
      Math.abs(word.length - term.length) <= allowedDistance &&
      levenshteinDistance(term, word, allowedDistance) <= allowedDistance,
  );
  return fuzzyMatch ? 0.48 : 0;
};

const buildSearchFields = (course) =>
  FIELD_DEFINITIONS.map(({ keys, weight }) => {
    const text = normalizeCourseSearchText(
      keys.map((key) => flattenText(readPath(course, key))).join(" "),
    );
    return { text, tokens: tokenize(text), weight };
  }).filter((field) => field.text);

const getAliases = (normalizedQuery) => {
  const aliases = new Set();
  const minimumContainedLength = /[a-z0-9]/.test(normalizedQuery) ? 3 : 2;
  SEARCH_SYNONYM_GROUPS.forEach((group) => {
    const normalizedGroup = group.map(normalizeCourseSearchText);
    if (
      normalizedGroup.some(
        (term) =>
          normalizedQuery === term ||
          normalizedQuery.includes(term) ||
          (normalizedQuery.length >= minimumContainedLength && term.includes(normalizedQuery)),
      )
    ) {
      normalizedGroup.forEach((term) => {
        if (term !== normalizedQuery) aliases.add(term);
      });
    }
  });
  return [...aliases];
};

export const scoreCourseSearchMatch = (course, query) => {
  const normalizedQuery = normalizeCourseSearchText(query);
  if (!normalizedQuery) return 0;

  const queryTokens = tokenize(normalizedQuery);
  const fields = buildSearchFields(course);
  if (!fields.length) return 0;

  let score = 0;
  let matchedOriginalTokens = 0;
  const title = normalizeCourseSearchText(course?.title);

  if (title === normalizedQuery) score += 260;
  else if (title.startsWith(normalizedQuery)) score += 190;
  else if (title.includes(normalizedQuery)) score += 145;

  fields.forEach((field) => {
    if (field.text === normalizedQuery) score += 12 * field.weight;
    else if (field.text.includes(normalizedQuery)) score += 5 * field.weight;
  });

  queryTokens.forEach((term) => {
    let bestTermScore = 0;
    fields.forEach((field) => {
      const quality = getTermMatchQuality(term, field.text, field.tokens);
      bestTermScore = Math.max(bestTermScore, quality * field.weight * 10);
    });
    if (bestTermScore > 0) {
      matchedOriginalTokens += 1;
      score += bestTermScore;
    }
  });

  const aliases = getAliases(normalizedQuery);
  let aliasScore = 0;
  aliases.forEach((alias) => {
    const aliasTokens = tokenize(alias);
    fields.forEach((field) => {
      if (field.text.includes(alias)) {
        aliasScore = Math.max(aliasScore, field.weight * 8);
      }
      aliasTokens.forEach((term) => {
        aliasScore = Math.max(
          aliasScore,
          getTermMatchQuality(term, field.text, field.tokens) * field.weight * 5,
        );
      });
    });
  });
  score += aliasScore;

  const coverage = matchedOriginalTokens / Math.max(1, queryTokens.length);
  const hasPhraseOrAlias = title.includes(normalizedQuery) || aliasScore > 0;
  const minimumCoverage = queryTokens.length <= 2 ? 0.5 : 0.4;
  if (!hasPhraseOrAlias && coverage < minimumCoverage) return 0;

  score += coverage * 35;
  return Math.round(score * 100) / 100;
};

export const searchAndRankCourses = (courses = [], query = "") => {
  const normalizedQuery = normalizeCourseSearchText(query);
  if (!normalizedQuery) return Array.isArray(courses) ? [...courses] : [];

  return (Array.isArray(courses) ? courses : [])
    .map((course, index) => ({
      course,
      index,
      score: scoreCourseSearchMatch(course, normalizedQuery),
    }))
    .filter((result) => result.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.course?.rating || 0) - Number(left.course?.rating || 0) ||
        Number(right.course?.enrolledStudentsCount || 0) -
          Number(left.course?.enrolledStudentsCount || 0) ||
        left.index - right.index,
    )
    .map(({ course }) => course);
};
