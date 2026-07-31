import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCourseSearchText,
  searchAndRankCourses,
} from "../src/utils/courseSearch.js";

const courses = [
  {
    id: "web",
    title: "Complete Web Development Bootcamp",
    description: "Build modern websites with JavaScript.",
    tags: ["coding", "frontend"],
    categoryName: "Computer",
    curriculumTopics: ["HTML", "CSS", "React"],
    enrolledStudentsCount: 40,
  },
  {
    id: "english",
    title: "English Conversation for Beginners",
    description: "Improve speaking and practical grammar.",
    tags: ["مکالمه", "زبان انگلیسی"],
    categoryName: "English",
    enrolledStudentsCount: 80,
  },
  {
    id: "accounting",
    title: "حسابداری مقدماتی",
    description: "اصول مالی برای کسب‌وکارهای کوچک",
    tags: ["accounting", "finance"],
    categoryName: "تجارت",
  },
];

test("normalizes Persian and Arabic character variants and zero-width joins", () => {
  assert.equal(normalizeCourseSearchText("  برنامه\u200Cنويسي  "), "برنامه نویسی");
  assert.equal(normalizeCourseSearchText("عربي، كاربردي"), "عربی کاربردی");
  assert.equal(normalizeCourseSearchText("پایتون ۳"), "پایتون 3");
});

test("finds courses from partial words without the complete title", () => {
  assert.equal(searchAndRankCourses(courses, "devel")[0]?.id, "web");
  assert.equal(searchAndRankCourses(courses, "conver begin")[0]?.id, "english");
});

test("matches Persian and English keywords across tags and course metadata", () => {
  assert.equal(searchAndRankCourses(courses, "مکالمه")[0]?.id, "english");
  assert.equal(searchAndRankCourses(courses, "accounting")[0]?.id, "accounting");
});

test("uses bilingual topic aliases when the stored course is in another language", () => {
  assert.equal(searchAndRankCourses(courses, "طراحی وب")[0]?.id, "web");
  assert.equal(searchAndRankCourses(courses, "زبان انگلیسی")[0]?.id, "english");
  assert.equal(searchAndRankCourses(courses, "js")[0]?.id, "web");
});

test("tolerates a small typo and rejects unrelated results", () => {
  assert.equal(searchAndRankCourses(courses, "javascrpt")[0]?.id, "web");
  assert.deepEqual(searchAndRankCourses(courses, "زیست شناسی"), []);
});
