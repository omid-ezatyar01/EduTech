import { getApiBase, parseJsonResponse } from "./http";
import { mockCourseCategories, mockCourses } from "../src/data/mockCourses.js";

const TOPIC_WORDS = [
  "Bootcamp",
  "Masterclass",
  "Essentials",
  "Workshop",
  "Intensive",
  "Lab",
  "Practical Course",
  "Certificate Track",
  "Pro Series",
  "Starter Program",
];

const TEACHER_NAMES = [
  "Ahmad Rahimi",
  "Sara Mohammadi",
  "David Wilson",
  "Fatima Noori",
  "Laila Azizi",
  "Omid Farzan",
  "John Carter",
  "Mina Hakimi",
  "Bilal Hamidi",
  "Elena Morris",
];

const LEVELS = ["beginner", "intermediate", "advanced"];
const COURSE_LANGUAGES = ["english", "persian", "pashto", "arabic"];
const PAYMENT_PLANS = ["monthly", "whole_period"];
const MEETING_TYPES = ["google_meet", "zoom", "recorded"];
const SCHEDULE_DAYS = [
  ["Saturday", "Monday", "Wednesday"],
  ["Sunday", "Tuesday", "Thursday"],
  ["Friday", "Saturday"],
];
const MOCK_COURSE_COUNT = 1000;

let catalogPromise = null;

function sortItems(rows, sortBy, sortOrder) {
  const direction = sortOrder === "asc" ? 1 : -1;
  const sorted = [...rows];

  sorted.sort((left, right) => {
    if (sortBy === "price") {
      return (Number(left.price || 0) - Number(right.price || 0)) * direction;
    }

    if (sortBy === "startDate") {
      return (new Date(left.startDate).getTime() - new Date(right.startDate).getTime()) * direction;
    }

    if (sortBy === "newest") {
      return (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * direction;
    }

    return (Number(left.enrolledStudentsCount || 0) - Number(right.enrolledStudentsCount || 0)) * direction;
  });

  return sorted;
}

function matchesSearch(course, searchValue) {
  if (!searchValue) return true;
  const haystack = [
    course.title,
    course.description,
    course.teacherName,
    course.categoryName,
    course.subcategoryName,
    course.categoryPathLabel,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchValue);
}

function matchesCategory(course, categoryValue) {
  if (!categoryValue) return true;
  const pathIds = Array.isArray(course.taxonomyPathIds) ? course.taxonomyPathIds : [];
  return pathIds.includes(categoryValue) || course.categoryId === categoryValue || course.subcategoryId === categoryValue;
}

function buildLanguageFacets(rows) {
  const counts = new Map();
  rows.forEach((row) => {
    const key = String(row.language || "").trim();
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => String(left.value).localeCompare(String(right.value)));
}

function padHex(value) {
  return value.toString(16).padStart(24, "0").slice(-24);
}

function slugify(value = "") {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function fetchApiCategories() {
  try {
    const response = await fetch(`${getApiBase()}/categories`, { cache: "no-store" });
    const data = await parseJsonResponse(response);
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}

function normalizeCategoryRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((item) => ({
      _id: String(item?._id || item?.id || "").trim(),
      name: String(item?.name || "").trim(),
      slug: String(item?.slug || "").trim(),
      parent: item?.parent?._id || item?.parent || null,
    }))
    .filter((item) => item._id && item.name);
}

function buildCategoryHierarchy(rows = []) {
  const normalizedRows = normalizeCategoryRows(rows);
  const childrenByParent = new Map();

  normalizedRows.forEach((item) => {
    const parentId = String(item.parent || "");
    const list = childrenByParent.get(parentId) || [];
    list.push(item);
    childrenByParent.set(parentId, list);
  });

  const buildNode = (category) => ({
    ...category,
    children: (childrenByParent.get(category._id) || []).map(buildNode),
  });

  const collectLeafNodes = (node) => {
    if (!node.children.length) return [node];
    return node.children.flatMap(collectLeafNodes);
  };

  const buildPathToNode = (targetId, byId) => {
    const path = [];
    let cursor = byId.get(targetId) || null;

    while (cursor) {
      path.unshift(cursor);
      cursor = cursor.parent ? byId.get(String(cursor.parent)) || null : null;
    }

    return path;
  };

  const byId = new Map(normalizedRows.map((item) => [item._id, item]));
  const roots = (childrenByParent.get("") || [])
    .map(buildNode)
    .map((category) => ({
      ...category,
      subcategories: category.children,
      leafNodes: collectLeafNodes(category),
      buildPathToLeaf: (leafId) => buildPathToNode(leafId, byId),
    }))
    .filter((category) => category.leafNodes.length > 0);

  return {
    flat: normalizedRows,
    roots,
  };
}

function buildDynamicMockCourses(roots = []) {
  if (!roots.length) return mockCourses;

  return Array.from({ length: MOCK_COURSE_COUNT }, (_, index) => {
    const category = roots[index % roots.length];
    const leafNodes = category.leafNodes.length ? category.leafNodes : [category];
    const leafNode = leafNodes[index % leafNodes.length];
    const nodePath = category.buildPathToLeaf(leafNode._id);
    const subcategory = leafNode;
    const level = LEVELS[index % LEVELS.length];
    const language = COURSE_LANGUAGES[index % COURSE_LANGUAGES.length];
    const paymentPlan = PAYMENT_PLANS[index % PAYMENT_PLANS.length];
    const meetingType = MEETING_TYPES[index % MEETING_TYPES.length];
    const scheduleDays = SCHEDULE_DAYS[index % SCHEDULE_DAYS.length];
    const teacherName = TEACHER_NAMES[index % TEACHER_NAMES.length];
    const teacherId = padHex(1000 + (index % TEACHER_NAMES.length));
    const courseType = index % 5 === 0 ? "special" : "general";
    const isFree = index % 11 === 0;
    const basePrice = 25 + (index % 12) * 15;
    const price = isFree ? 0 : basePrice;
    const originalPrice = isFree ? 0 : basePrice + 20 + (index % 4) * 10;
    const startDate = new Date(Date.UTC(2026, 6, 20 + (index % 160), 0, 0, 0));
    const createdAt = new Date(Date.UTC(2026, 5, 1 + (index % 45), 0, 0, 0));
    const title = `${subcategory.name} ${TOPIC_WORDS[index % TOPIC_WORDS.length]} ${index + 1}`;
    const slug = `${slugify(category.name)}-${slugify(subcategory.name)}-${index + 1}`;
    const enrolledStudentsCount = 18 + ((index * 7) % 240);
    const rating = 3.8 + ((index % 13) * 0.1);
    const ratingCount = 6 + (index % 80);
    const durationWeeks = 4 + (index % 10);
    const minimumStudentsToStart = 5 + (index % 6);
    const scheduleRows = scheduleDays.map((day, dayIndex) => ({
      day,
      startTime: `${String(8 + ((index + dayIndex) % 8)).padStart(2, "0")}:00`,
      endTime: `${String(10 + ((index + dayIndex) % 8)).padStart(2, "0")}:00`,
    }));

    return {
      _id: padHex(index + 1),
      id: padHex(index + 1),
      slug,
      title,
      description: `Build real skills in ${subcategory.name.toLowerCase()} with guided lessons, live support, and practical assignments.`,
      shortDescription: `A hands-on ${subcategory.name.toLowerCase()} course for learners who want structured progress.`,
      about: `This temporary mock course helps populate the frontend catalog with realistic ${category.name.toLowerCase()} examples.`,
      level,
      language,
      courseType,
      paymentPlan,
      meetingType,
      teacher: teacherName,
      teacherName,
      teacherId,
      teacherBio: `${teacherName} teaches practical ${subcategory.name.toLowerCase()} classes with a project-first approach.`,
      teacherRole: `${category.name} Instructor`,
      teacherAvatar: "",
      thumbnail: "/course-live-preview.png",
      promoVideo: "",
      previewVideoUrls: [],
      scheduleRows,
      schedule: scheduleRows.map((row) => row.day).join(", "),
      time: `${scheduleRows[0].startTime} - ${scheduleRows[0].endTime}`,
      price,
      originalPrice,
      discountPercent: originalPrice > price && originalPrice > 0
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0,
      currency: "USD",
      categoryId: category._id,
      subcategoryId: subcategory._id,
      taxonomyPathIds: nodePath.map((item) => item._id),
      categoryName: category.name,
      subcategoryName: subcategory.name,
      categoryPathLabel: nodePath.map((item) => item.name).join(" / "),
      isFree,
      rating: Number(Math.min(rating, 4.9).toFixed(1)),
      ratingCount,
      reviews: [],
      enrolledStudentsCount,
      minimumStudentsToStart,
      maxStudents: 300,
      duration: `${durationWeeks} weeks`,
      startDate: startDate.toISOString(),
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      bankPaymentAvailable: !isFree,
      targetAudience: [
        `Learners interested in ${subcategory.name.toLowerCase()}.`,
        "Students who want a clear weekly study path.",
      ],
      whatYouWillLearn: [
        `Understand core ${subcategory.name.toLowerCase()} concepts.`,
        "Practice with guided exercises and mini projects.",
        "Build confidence through instructor feedback.",
      ],
      requirements: [
        "Basic reading and study commitment.",
        "Internet access for live and recorded lessons.",
      ],
      curriculumTopics: [
        `${subcategory.name} foundations`,
        `${subcategory.name} practical workflow`,
        "Assignments and review sessions",
      ],
    };
  });
}

async function getResolvedCatalog() {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const apiCategories = await fetchApiCategories();
      const hierarchy = buildCategoryHierarchy(apiCategories);

      if (hierarchy.roots.length) {
        return {
          categories: hierarchy.flat,
          courses: buildDynamicMockCourses(hierarchy.roots),
        };
      }

      return {
        categories: mockCourseCategories,
        courses: mockCourses,
      };
    })();
  }

  return catalogPromise;
}

export async function fetchMockPublishedCourses(query = {}) {
  const { courses } = await getResolvedCatalog();
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.max(1, Number(query.limit || 20));
  const searchValue = String(query.search || "").trim().toLowerCase();
  const categoryValue = String(query.category || "").trim();
  const levelValue = String(query.level || "").trim().toLowerCase();
  const languageValue = String(query.language || "").trim().toLowerCase();
  const pricingValue = String(query.pricing || "").trim().toLowerCase();
  const courseTypeValue = String(query.courseType || "").trim().toLowerCase();
  const paymentPlanValue = String(query.paymentPlan || "").trim().toLowerCase();
  const minPriceValue = query.minPrice === undefined ? null : Number(query.minPrice);
  const maxPriceValue = query.maxPrice === undefined ? null : Number(query.maxPrice);
  const sortBy = String(query.sortBy || "popular");
  const sortOrder = String(query.sortOrder || "desc");

  const filtered = courses.filter((course) => {
    if (!matchesSearch(course, searchValue)) return false;
    if (!matchesCategory(course, categoryValue)) return false;
    if (levelValue && course.level !== levelValue) return false;
    if (languageValue && course.language !== languageValue) return false;
    if (pricingValue === "free" && !course.isFree) return false;
    if (pricingValue === "paid" && course.isFree) return false;
    if (courseTypeValue && courseTypeValue !== "all" && course.courseType !== courseTypeValue) return false;
    if (paymentPlanValue && paymentPlanValue !== "all" && course.paymentPlan !== paymentPlanValue) return false;
    if (Number.isFinite(minPriceValue) && Number(course.price || 0) < minPriceValue) return false;
    if (Number.isFinite(maxPriceValue) && Number(course.price || 0) > maxPriceValue) return false;
    return true;
  });

  const sorted = sortItems(filtered, sortBy, sortOrder);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const paginated = sorted.slice(start, start + limit);

  return {
    courses: paginated,
    meta: {
      total,
      totalPages,
      currentPage: page,
      limit,
      facets: {
        languages: buildLanguageFacets(filtered),
        priceRange: {
          min: filtered.length ? Math.min(...filtered.map((item) => Number(item.price || 0))) : 0,
          max: filtered.length ? Math.max(...filtered.map((item) => Number(item.price || 0))) : 0,
        },
      },
    },
  };
}

export async function fetchMockPublishedCourseBySlug(slug = "") {
  const { courses } = await getResolvedCatalog();
  const normalizedSlug = String(slug || "").trim();
  if (!normalizedSlug) return null;

  return (
    courses.find(
      (course) =>
        course.slug === normalizedSlug ||
        course._id === normalizedSlug ||
        course.id === normalizedSlug,
    ) || null
  );
}

export async function fetchMockPublicCategories() {
  const { categories } = await getResolvedCatalog();
  return categories;
}
