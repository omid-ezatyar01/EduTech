import assert from "node:assert/strict";
import test from "node:test";

import Category from "../src/models/Category.js";
import Course from "../src/models/Course.js";
import { realignCourseCategoryAssignments } from "../src/utils/courseCategory.js";

const withStubbedMethod = async (target, methodName, replacement, run) => {
  const original = target[methodName];
  target[methodName] = replacement;
  try {
    await run();
  } finally {
    target[methodName] = original;
  }
};

test("realignCourseCategoryAssignments repairs stale root category references", async () => {
  const oldRootId = "6877a1000000000000000001";
  const newRootId = "6877a1000000000000000002";
  const leafId = "6877a1000000000000000003";
  const courseId = "6877a1000000000000000004";
  const updates = [];

  await withStubbedMethod(Course, "find", () => ({
    select: () => ({
      lean: async () => [
        {
          _id: courseId,
          category: oldRootId,
          subcategory: leafId,
        },
      ],
    }),
  }), async () => {
    await withStubbedMethod(Course, "bulkWrite", async (operations) => {
      updates.push(...operations);
      return { modifiedCount: operations.length };
    }, async () => {
      await withStubbedMethod(Category, "findById", (id) => ({
        select: async () => {
          if (String(id) === leafId) {
            return { _id: leafId, name: "Leaf", parent: newRootId };
          }
          if (String(id) === newRootId) {
            return { _id: newRootId, name: "New Root", parent: null };
          }
          return null;
        },
      }), async () => {
        const changed = await realignCourseCategoryAssignments(oldRootId);

        assert.equal(changed, 1);
      });
    });
  });

  assert.deepEqual(updates, [
    {
      updateOne: {
        filter: { _id: courseId },
        update: {
          $set: {
            category: newRootId,
            subcategory: leafId,
          },
        },
      },
    },
  ]);
});

test("realignCourseCategoryAssignments skips courses that are already consistent", async () => {
  const rootId = "6877a1000000000000000011";
  let bulkWriteCalled = false;

  await withStubbedMethod(Course, "find", () => ({
    select: () => ({
      lean: async () => [
        {
          _id: "6877a1000000000000000012",
          category: rootId,
          subcategory: null,
        },
      ],
    }),
  }), async () => {
    await withStubbedMethod(Course, "bulkWrite", async () => {
      bulkWriteCalled = true;
      return { modifiedCount: 0 };
    }, async () => {
      await withStubbedMethod(Category, "findById", (id) => ({
        select: async () => {
          if (String(id) === rootId) {
            return { _id: rootId, name: "Root", parent: null };
          }
          return null;
        },
      }), async () => {
        const changed = await realignCourseCategoryAssignments(rootId);

        assert.equal(changed, 0);
      });
    });
  });

  assert.equal(bulkWriteCalled, false);
});
