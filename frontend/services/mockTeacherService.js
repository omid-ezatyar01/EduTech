import { mockCourses } from "../src/data/mockCourses.js";

const TEACHER_FIRST_NAMES = [
  "Ahmad",
  "Sara",
  "David",
  "Fatima",
  "Laila",
  "Omid",
  "John",
  "Mina",
  "Bilal",
  "Elena",
  "Zahra",
  "James",
  "Nabila",
  "Yousef",
  "Maryam",
  "Ali",
  "Sophia",
  "Karim",
  "Hadia",
  "Daniel",
];

const TEACHER_LAST_NAMES = [
  "Rahimi",
  "Mohammadi",
  "Wilson",
  "Noori",
  "Azizi",
  "Farzan",
  "Carter",
  "Hakimi",
  "Hamidi",
  "Morris",
  "Ahmadi",
  "Safi",
  "Nabizada",
  "Karimi",
  "Latifi",
  "Stanley",
  "Arman",
  "Sadiqi",
  "Qadiri",
  "Ehsani",
];

const COUNTRIES = ["Afghanistan", "United Arab Emirates", "Turkey", "Pakistan", "India", "Germany"];
const CITIES = ["Kabul", "Herat", "Mazar", "Dubai", "Istanbul", "Delhi", "Berlin"];
const LANGUAGES = ["english", "persian", "pashto", "arabic"];
const TEACHING_LEVELS = ["beginner", "intermediate", "advanced"];
const PROFESSIONAL_TITLES = [
  "Senior Instructor",
  "Lead Trainer",
  "Academic Mentor",
  "Course Specialist",
  "Industry Coach",
];
const TEACHER_COUNT = 1000;

function padHex(value) {
  return value.toString(16).padStart(24, "0").slice(-24);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function buildTeacherCatalog() {
  return Array.from({ length: TEACHER_COUNT }, (_, index) => {
    const firstName = TEACHER_FIRST_NAMES[index % TEACHER_FIRST_NAMES.length];
    const lastName = TEACHER_LAST_NAMES[(index * 3) % TEACHER_LAST_NAMES.length];
    const name = `${firstName} ${lastName}`;
    const primaryCourse = mockCourses[index % mockCourses.length];
    const secondaryCourse = mockCourses[(index + 37) % mockCourses.length];
    const tertiaryCourse = mockCourses[(index + 79) % mockCourses.length];
    const coursePool = [primaryCourse, secondaryCourse, tertiaryCourse].filter(Boolean);
    const tags = [...new Set(coursePool.flatMap((course) => [course.categoryName, course.subcategoryName]).filter(Boolean))].slice(0, 4);
    const yearsExperience = 2 + (index % 14);
    const totalStudents = 80 + ((index * 17) % 4200);
    const publishedCoursesCount = 3 + (index % 12);
    const rating = Number((4 + ((index % 10) * 0.09)).toFixed(1));
    const ratingCount = 15 + (index % 240);
    const country = COUNTRIES[index % COUNTRIES.length];
    const city = CITIES[index % CITIES.length];
    const teacherId = padHex(5000 + index);

    return {
      _id: teacherId,
      id: teacherId,
      name,
      username: name,
      avatar: "",
      bio: `${name} teaches practical ${primaryCourse?.subcategoryName?.toLowerCase() || "live"} courses with project-based learning and clear weekly guidance.`,
      about: `${name} focuses on practical outcomes, student support, and structured live teaching.`,
      description: `${name} helps students build real-world skills through guided classes and feedback.`,
      publishedCoursesCount,
      totalStudents,
      rating,
      ratingCount,
      country,
      city,
      joinedAt: new Date(Date.UTC(2024, index % 12, 1 + (index % 28))).toISOString(),
      tags,
      reviews: [
        {
          _id: `${teacherId}-review-1`,
          studentName: "Student A",
          courseTitle: primaryCourse?.title || "Course",
          comment: "Very supportive teacher with clear explanations.",
          teacherRating: 5,
          createdAt: new Date(Date.UTC(2026, 5, 10)).toISOString(),
        },
      ],
      teacherApplication: {
        status: "approved",
        professionalTitle: PROFESSIONAL_TITLES[index % PROFESSIONAL_TITLES.length],
        yearsExperience,
        education: index % 2 === 0 ? "Bachelor Degree" : "Master Degree",
        expertiseAreas: tags,
        teachingLevels: TEACHING_LEVELS.slice(0, 1 + (index % TEACHING_LEVELS.length)),
        certifications: [
          `${primaryCourse?.categoryName || "Teaching"} Certificate`,
          `${primaryCourse?.subcategoryName || "Course"} Specialist`,
        ],
        languages: LANGUAGES.slice(0, 1 + (index % LANGUAGES.length)),
        skillRatings: tags.map((tag, skillIndex) => ({
          name: tag,
          percentage: 72 + ((index + skillIndex * 9) % 28),
        })),
        introVideoUrl: index % 3 === 0 ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ" : "",
      },
      socialLinks: {
        linkedin: "",
        youtube: "",
        instagram: "",
        facebook: "",
        whatsapp: "",
        twitter: "",
        github: "",
      },
      endedCourses: coursePool.slice(0, 1),
      publishedCourses: coursePool,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@edutech.study`,
    };
  });
}

const mockTeachers = buildTeacherCatalog();

function matchesTeacherSearch(teacher, searchValue) {
  if (!searchValue) return true;
  const haystack = [
    teacher.name,
    teacher.bio,
    teacher.country,
    teacher.city,
    ...(teacher.tags || []),
    ...(teacher.teacherApplication?.expertiseAreas || []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(searchValue);
}

export function fetchMockPublicTeachers(query = {}) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.max(1, Number(query.limit || 20));
  const search = normalizeText(query.search);
  const language = normalizeText(query.language);
  const expertise = normalizeText(query.expertise);
  const teachingLevel = normalizeText(query.teachingLevel);
  const country = normalizeText(query.country);
  const minExperience = query.minExperience === undefined ? null : Number(query.minExperience);
  const hasIntroVideo = query.hasIntroVideo;
  const sortBy = normalizeText(query.sortBy || "experience");
  const sortOrder = normalizeText(query.sortOrder || "desc");

  let rows = mockTeachers.filter((teacher) => {
    if (!matchesTeacherSearch(teacher, search)) return false;
    if (language && !teacher.teacherApplication.languages.map(normalizeText).includes(language)) return false;
    if (expertise && !teacher.teacherApplication.expertiseAreas.map(normalizeText).includes(expertise)) return false;
    if (teachingLevel && !teacher.teacherApplication.teachingLevels.map(normalizeText).includes(teachingLevel)) return false;
    if (country && normalizeText(teacher.country) !== country) return false;
    if (Number.isFinite(minExperience) && Number(teacher.teacherApplication.yearsExperience || 0) < minExperience) return false;
    if (typeof hasIntroVideo === "boolean") {
      const hasVideo = Boolean(teacher.teacherApplication.introVideoUrl);
      if (hasVideo !== hasIntroVideo) return false;
    }
    return true;
  });

  rows = [...rows].sort((left, right) => {
    const direction = sortOrder === "asc" ? 1 : -1;
    if (sortBy === "newest") {
      return (new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime()) * direction;
    }
    return (Number(left.teacherApplication.yearsExperience || 0) - Number(right.teacherApplication.yearsExperience || 0)) * direction;
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const paginated = rows.slice(start, start + limit);

  return {
    teachers: paginated,
    meta: {
      total,
      totalPages,
      currentPage: page,
      limit,
      facets: {},
    },
  };
}

export function fetchMockPublicTeacherById(id) {
  const teacherId = String(id || "").trim();
  if (!teacherId) return null;
  return mockTeachers.find((teacher) => String(teacher._id) === teacherId) || null;
}
