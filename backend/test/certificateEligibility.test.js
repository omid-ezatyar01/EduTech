import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import mockingoose from "mockingoose";
import mongoose from "mongoose";

import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import {
  getStudentEnrollments,
  verifyCertificateById,
} from "../src/controllers/enrollmentController.js";
import { endTeacherCourseClass } from "../src/controllers/teacherCourseController.js";

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

beforeEach(() => {
  mockingoose.resetAll();
});

afterEach(() => {
  mockingoose.resetAll();
});

test("student enrollments do not expose certificates for free courses", async () => {
  const studentId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const issuedAt = new Date("2026-06-30T10:00:00.000Z");
  const originalFind = Enrollment.find;

  Enrollment.find = () => ({
    populate() {
      return this;
    },
    sort: async () => [
      {
        _id: enrollmentId,
        studentId,
        enrollmentStatus: "completed",
        accessStatus: "allowed",
        certificateId: "ED-2026-ABCDEFGH",
        certificateIssuedAt: issuedAt,
        createdAt: issuedAt,
        updatedAt: issuedAt,
        courseId: {
          _id: courseId,
          title: "Free English Course",
          isFree: true,
          price: 0,
          classEndedAt: issuedAt,
          teacher: {
            _id: new mongoose.Types.ObjectId(),
            name: "Teacher Free",
          },
        },
      },
    ],
  });

  try {
    const res = createMockRes();
    await executeController(
      getStudentEnrollments,
      { user: { _id: studentId } },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.data?.length, 1);
    assert.equal(res.body.data[0].certificateId, null);
    assert.equal(res.body.data[0].certificateIssuedAt, null);
  } finally {
    Enrollment.find = originalFind;
  }
});

test("certificate verification rejects free-course certificates", async () => {
  const enrollmentId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const issuedAt = new Date("2026-06-30T10:00:00.000Z");

  const freeEnrollment = {
    _id: enrollmentId,
    studentId: {
      _id: studentId,
      name: "Student Example",
    },
    enrollmentStatus: "completed",
    certificateId: "ED-2026-ABCDEFGH",
    certificateIssuedAt: issuedAt,
    createdAt: issuedAt,
    updatedAt: issuedAt,
    courseId: {
      _id: courseId,
      title: "Free English Course",
      isFree: true,
      price: 0,
      classEndedAt: issuedAt,
      teacher: {
        _id: new mongoose.Types.ObjectId(),
        name: "Teacher Free",
      },
    },
  };

  mockingoose(Enrollment).toReturn(freeEnrollment, "findOne");
  mockingoose(Enrollment).toReturn([freeEnrollment], "find");

  const res = createMockRes();
  await assert.rejects(
    executeController(
      verifyCertificateById,
      { params: { certificateId: "ED-2026-ABCDEFGH" } },
      res,
    ),
    (error) => error?.statusCode === 404,
  );
});

test("teacher cannot end even a free course directly without admin review", async () => {
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
