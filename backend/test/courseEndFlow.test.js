import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import AdminNotification from "../src/models/AdminNotification.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import { approveCourseEndRequest } from "../src/controllers/adminCourseController.js";
import {
  endTeacherCourseClass,
  requestTeacherCourseEndReview,
} from "../src/controllers/teacherCourseController.js";

const createMockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const executeController = (handler, req, res) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };

    const originalJson = res.json?.bind(res);
    res.json = (body) => {
      const response = originalJson ? originalJson(body) : body;
      finish(resolve);
      return response;
    };

    try {
      handler(req, res, (error) => {
        if (error) {
          finish(reject, error);
          return;
        }
        finish(resolve);
      });
    } catch (error) {
      finish(reject, error);
    }
  });

const mockEnrollmentFindSequence = (responses = []) => {
  const originalFind = Enrollment.find;
  let index = 0;

  Enrollment.find = () => {
    const config = responses[index] || responses[responses.length - 1] || {};
    index += 1;

    if (config.withPopulate) {
      return {
        select() {
          return this;
        },
        populate: async () => config.value,
      };
    }

    return {
      select: async () => config.value,
    };
  };

  return () => {
    Enrollment.find = originalFind;
  };
};

test("teacher can send a course end request for admin review", async () => {
  const teacherId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const originalFindOne = Course.findOne;
  const originalCreate = AdminNotification.create;

  const courseDoc = new Course({
    _id: courseId,
    teacher: teacherId,
    createdBy: teacherId,
    title: "Advanced Backend",
    status: "published",
    classStartedAt: new Date("2026-07-01T10:00:00.000Z"),
    endRequest: { status: "none" },
  });
  courseDoc.save = async function save() {
    return this;
  };

  Course.findOne = async () => courseDoc;
  AdminNotification.create = async () => ({ _id: new mongoose.Types.ObjectId() });

  try {
    const res = createMockRes();
    await executeController(
      requestTeacherCourseEndReview,
      {
        params: { id: String(courseId) },
        body: { reason: "All sessions are complete and students finished successfully." },
        user: { _id: teacherId, name: "Teacher Example" },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.data?.endRequest?.status, "pending");
    assert.equal(
      String(res.body?.data?.endRequest?.reason || ""),
      "All sessions are complete and students finished successfully.",
    );
  } finally {
    Course.findOne = originalFindOne;
    AdminNotification.create = originalCreate;
  }
});

test("teacher cannot end a course directly without admin review", async () => {
  const teacherId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const res = createMockRes();

  await assert.rejects(
    executeController(
      endTeacherCourseClass,
      {
        params: { id: String(courseId) },
        user: { _id: teacherId },
      },
      res,
    ),
    (error) =>
      error?.statusCode === 403 &&
      String(error?.message || "").includes("Teachers cannot end classes directly"),
  );
});

test("admin approval of an end request ends the course and issues real certificate IDs", async () => {
  const adminId = new mongoose.Types.ObjectId();
  const teacherId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();
  const originalFindById = Course.findById;
  const originalBulkWrite = Enrollment.bulkWrite;
  const bulkWriteCalls = [];

  const courseDoc = new Course({
    _id: courseId,
    teacher: { _id: teacherId, name: "Teacher Example" },
    createdBy: { _id: teacherId, name: "Teacher Example" },
    title: "Advanced Backend",
    isFree: false,
    price: 25,
    status: "published",
    classStartedAt: new Date("2026-07-01T10:00:00.000Z"),
    endRequest: {
      status: "pending",
      reason: "Students finished every session and assignment.",
    },
  });
  courseDoc.populate = function populate() {
    return this;
  };
  courseDoc.save = async function save() {
    return this;
  };

  Course.findById = () => courseDoc;
  Enrollment.bulkWrite = async (ops) => {
    bulkWriteCalls.push(ops);
    return { ok: 1 };
  };

  const restoreFind = mockEnrollmentFindSequence([
    {
      value: [
        {
          _id: enrollmentId,
          studentId,
          enrollmentStatus: "active",
          accessStatus: "allowed",
          certificateId: null,
          certificateIssuedAt: null,
        },
      ],
    },
    {
      withPopulate: true,
      value: [
        {
          _id: enrollmentId,
          studentId: {
            _id: studentId,
            name: "Student One",
            email: "",
          },
          certificateId: "ED-2026-PLACEHOLDER",
        },
      ],
    },
  ]);

  try {
    const res = createMockRes();
    await executeController(
      approveCourseEndRequest,
      {
        params: { id: String(courseId) },
        body: { adminResponse: "Approved for completion." },
        user: { _id: adminId },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.data?.course?.endRequest?.status, "approved");
    assert.equal(res.body?.data?.completion?.certificatesIssued, 1);
    assert.equal(bulkWriteCalls.length, 1);
    const updated = bulkWriteCalls[0][0].updateOne.update.$set;
    assert.match(String(updated.certificateId || ""), /^ED-\d{4}-[A-F0-9]{8}$/);
    assert.ok(courseDoc.classEndedAt instanceof Date);
  } finally {
    restoreFind();
    Course.findById = originalFindById;
    Enrollment.bulkWrite = originalBulkWrite;
  }
});
