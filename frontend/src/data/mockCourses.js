const ROOT_CATEGORIES = [
  {
    _id: "900000000000000000000001",
    name: "English",
    slug: "english",
    subcategories: [
      { _id: "900000000000000000000101", name: "Speaking", slug: "speaking" },
      { _id: "900000000000000000000102", name: "Grammar", slug: "grammar" },
      { _id: "900000000000000000000103", name: "IELTS", slug: "ielts" },
      { _id: "900000000000000000000104", name: "Business English", slug: "business-english" },
    ],
  },
  {
    _id: "900000000000000000000002",
    name: "Computer",
    slug: "computer",
    subcategories: [
      { _id: "900000000000000000000201", name: "Web Development", slug: "web-development" },
      { _id: "900000000000000000000202", name: "Office Skills", slug: "office-skills" },
      { _id: "900000000000000000000203", name: "Programming", slug: "programming" },
      { _id: "900000000000000000000204", name: "Networking", slug: "networking" },
    ],
  },
  {
    _id: "900000000000000000000003",
    name: "Design",
    slug: "design",
    subcategories: [
      { _id: "900000000000000000000301", name: "Graphic Design", slug: "graphic-design" },
      { _id: "900000000000000000000302", name: "UI UX", slug: "ui-ux" },
      { _id: "900000000000000000000303", name: "Motion Design", slug: "motion-design" },
      { _id: "900000000000000000000304", name: "Branding", slug: "branding" },
    ],
  },
  {
    _id: "900000000000000000000004",
    name: "Business",
    slug: "business",
    subcategories: [
      { _id: "900000000000000000000401", name: "Entrepreneurship", slug: "entrepreneurship" },
      { _id: "900000000000000000000402", name: "Accounting", slug: "accounting" },
      { _id: "900000000000000000000403", name: "Management", slug: "management" },
      { _id: "900000000000000000000404", name: "Sales", slug: "sales" },
    ],
  },
  {
    _id: "900000000000000000000005",
    name: "Math",
    slug: "math",
    subcategories: [
      { _id: "900000000000000000000501", name: "Algebra", slug: "algebra" },
      { _id: "900000000000000000000502", name: "Geometry", slug: "geometry" },
      { _id: "900000000000000000000503", name: "Statistics", slug: "statistics" },
      { _id: "900000000000000000000504", name: "Exam Prep", slug: "exam-prep" },
    ],
  },
  {
    _id: "900000000000000000000006",
    name: "Marketing",
    slug: "marketing",
    subcategories: [
      { _id: "900000000000000000000601", name: "Digital Marketing", slug: "digital-marketing" },
      { _id: "900000000000000000000602", name: "Social Media", slug: "social-media" },
      { _id: "900000000000000000000603", name: "SEO", slug: "seo" },
      { _id: "900000000000000000000604", name: "Content Strategy", slug: "content-strategy" },
    ],
  },
];

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

function buildCategoryTree() {
  const rows = [];
  ROOT_CATEGORIES.forEach((category) => {
    rows.push({
      _id: category._id,
      name: category.name,
      slug: category.slug,
      parent: null,
    });

    category.subcategories.forEach((subcategory) => {
      rows.push({
        _id: subcategory._id,
        name: subcategory.name,
        slug: subcategory.slug,
        parent: category._id,
      });
    });
  });

  return rows;
}

function buildMockCourse(index) {
  const category = ROOT_CATEGORIES[index % ROOT_CATEGORIES.length];
  const subcategory = category.subcategories[index % category.subcategories.length];
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
    categoryName: category.name,
    subcategoryName: subcategory.name,
    categoryPathLabel: `${category.name} / ${subcategory.name}`,
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
}

export const mockCourseCategories = buildCategoryTree();
export const mockCourses = Array.from({ length: 1000 }, (_, index) => buildMockCourse(index));
