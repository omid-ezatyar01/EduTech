import mongoose from "mongoose";
import { backfillCourseThumbnailAssets } from "../utils/courseImage.js";
import { expireStalePendingPaymentAttempts } from "../utils/paymentAttemptMigration.js";

const SEVENTY_TWO_HOURS_IN_MILLISECONDS = 72 * 60 * 60 * 1000;

const migrateLegacyTeacherRatings = async () => {
  try {
    const legacy = mongoose.connection.collection("courseratings");
    const teacherRatings = mongoose.connection.collection("teacherratings");
    const cursor = legacy.aggregate([
      { $match: { teacherRating: { $gte: 1, $lte: 5 } } },
      { $sort: { updatedAt: -1 } },
      { $group: { _id: { studentId: "$studentId", teacherId: "$teacherId" }, row: { $first: "$$ROOT" } } },
    ]);
    let migrated = 0;
    for await (const entry of cursor) {
      const row = entry.row;
      const result = await teacherRatings.updateOne(
        { studentId: row.studentId, teacherId: row.teacherId },
        { $setOnInsert: { studentId: row.studentId, teacherId: row.teacherId, eligibilityCourseId: row.courseId, rating: row.teacherRating, comment: row.comment || "", tags: row.tags || [], displayName: row.displayName !== false, moderationStatus: row.moderationStatus || "pending", teacherReply: row.teacherReply || "", teacherRepliedAt: row.teacherRepliedAt || null, moderatedBy: row.moderatedBy || null, moderatedAt: row.moderatedAt || null, helpfulBy: [], reports: [], createdAt: row.createdAt || new Date(), updatedAt: row.updatedAt || new Date() } },
        { upsert: true },
      );
      migrated += Number(result.upsertedCount || 0);
    }
    if (migrated) console.log(`Migrated ${migrated} legacy teacher review(s) into separate records`);
  } catch (error) {
    console.warn(`Could not migrate legacy teacher ratings: ${error.message}`);
  }
};

const dropLegacyUniqueUsernameIndex = async () => {
  try {
    const usersCollection = mongoose.connection.collection("users");
    const indexes = await usersCollection.indexes();

    const usernameUniqueIndexes = indexes.filter(
      (index) =>
        index?.unique === true &&
        index?.key &&
        Object.keys(index.key).length === 1 &&
        Object.prototype.hasOwnProperty.call(index.key, "username"),
    );

    for (const index of usernameUniqueIndexes) {
      await usersCollection.dropIndex(index.name);
      console.log(`Dropped legacy unique username index: ${index.name}`);
    }
  } catch (error) {
    console.warn(`Could not verify/drop username unique index: ${error.message}`);
  }
};

const ensureDirectMessageTtlIndex = async () => {
  try {
    const directMessagesCollection = mongoose.connection.collection("directmessages");
    const indexes = await directMessagesCollection.indexes();
    const directMessageTtlIndexName = "direct_message_expires_at_ttl";

    const directMessageExpiryIndexesToDrop = indexes.filter((index) => {
      if (index?.name === "_id_" || !index?.key || Object.keys(index.key).length !== 1) {
        return false;
      }

      const isCreatedAtTtlIndex =
        Object.prototype.hasOwnProperty.call(index.key, "createdAt") &&
        Object.prototype.hasOwnProperty.call(index, "expireAfterSeconds");
      const isExpiresAtIndex = Object.prototype.hasOwnProperty.call(index.key, "expiresAt");
      const isDesiredExpiresAtTtlIndex =
        index.name === directMessageTtlIndexName && index.expireAfterSeconds === 0;

      return isCreatedAtTtlIndex || (isExpiresAtIndex && !isDesiredExpiresAtTtlIndex);
    });

    for (const index of directMessageExpiryIndexesToDrop) {
      await directMessagesCollection.dropIndex(index.name);
      console.log(`Dropped old direct message expiry index: ${index.name}`);
    }

    const rowsWithoutExpiry = await directMessagesCollection.countDocuments({
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }],
    });

    if (rowsWithoutExpiry > 0) {
      const groups = await directMessagesCollection
        .aggregate([
          {
            $match: {
              $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }],
            },
          },
          {
            $group: {
              _id: {
                teacherId: "$teacherId",
                courseId: "$courseId",
              },
              firstMessageAt: { $min: "$createdAt" },
            },
          },
        ])
        .toArray();

      for (const row of groups) {
        const firstMessageAt = row?.firstMessageAt ? new Date(row.firstMessageAt) : new Date();
        const firstMessageTime = firstMessageAt.getTime();
        const expiresAt = Number.isFinite(firstMessageTime)
          ? new Date(firstMessageTime + SEVENTY_TWO_HOURS_IN_MILLISECONDS)
          : new Date(Date.now() + SEVENTY_TWO_HOURS_IN_MILLISECONDS);

        await directMessagesCollection.updateMany(
          {
            teacherId: row?._id?.teacherId,
            courseId: row?._id?.courseId,
            $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }],
          },
          {
            $set: { expiresAt },
          },
        );
      }
    }

    await directMessagesCollection.createIndex(
      { expiresAt: 1 },
      {
        name: directMessageTtlIndexName,
        expireAfterSeconds: 0,
      },
    );
  } catch (error) {
    console.warn(`Could not ensure direct message TTL index: ${error.message}`);
  }
};

const ensureCourseTextSearchIndex = async () => {
  try {
    const coursesCollection = mongoose.connection.collection("courses");
    const indexes = await coursesCollection.indexes();
    const textKey = { title: "text", description: "text", tags: "text" };
    const textIndexName = "course_text_search";

    const textIndexesToDrop = indexes.filter((index) => {
      if (index?.name === "_id_" || !index?.key) return false;
      const hasTextKey = Object.values(index.key).some((value) => value === "text");
      if (!hasTextKey) return false;
      const indexedFields = Object.keys(index.weights || {}).sort();
      const hasDesiredFields =
        indexedFields.length === 3 &&
        ["description", "tags", "title"].every(
          (field, position) => indexedFields[position] === field,
        );
      return (
        index.name !== textIndexName ||
        index.language_override !== "textSearchLanguage" ||
        index.default_language !== "none" ||
        !hasDesiredFields
      );
    });

    for (const index of textIndexesToDrop) {
      await coursesCollection.dropIndex(index.name);
      console.log(`Dropped old course text index: ${index.name}`);
    }

    await coursesCollection.createIndex(textKey, {
      name: textIndexName,
      default_language: "none",
      language_override: "textSearchLanguage",
    });
  } catch (error) {
    console.warn(`Could not ensure course text search index: ${error.message}`);
  }
};

const ensurePendingStatusForUnverifiedStudents = async () => {
  try {
    const usersCollection = mongoose.connection.collection("users");
    const result = await usersCollection.updateMany(
      {
        role: "student",
        isEmailVerified: false,
        status: "active",
      },
      {
        $set: { status: "pending_verification" },
      },
    );

    if (result.modifiedCount > 0) {
      console.log(`Marked ${result.modifiedCount} unverified student account(s) as pending verification`);
    }
  } catch (error) {
    console.warn(`Could not repair unverified student statuses: ${error.message}`);
  }
};

const repairDuplicatePaymentAccounting = async () => {
  try {
    const attemptsCollection = mongoose.connection.collection("paymentattempts");
    const paymentsCollection = mongoose.connection.collection("payments");
    const cursor = attemptsCollection.find(
      { status: "DUPLICATE_PAYMENT" },
      { projection: { _id: 1 } },
    );
    let repaired = 0;
    let attemptIds = [];

    const repairBatch = async () => {
      if (!attemptIds.length) return;
      const result = await paymentsCollection.updateMany(
        {
          paymentAttemptId: { $in: attemptIds },
          $or: [{ status: "paid" }, { paymentStatus: "paid" }],
        },
        { $set: { status: "pending", paymentStatus: "pending" } },
      );
      repaired += Number(result.modifiedCount || 0);
      attemptIds = [];
    };

    for await (const attempt of cursor) {
      attemptIds.push(attempt._id);
      if (attemptIds.length >= 500) await repairBatch();
    }
    await repairBatch();

    if (repaired > 0) {
      console.log(`Removed ${repaired} duplicate payment(s) from paid revenue pending refund review`);
    }
  } catch (error) {
    console.warn(`Could not repair duplicate payment accounting: ${error.message}`);
  }
};

const repairStalePendingPaymentAttempts = async () => {
  const attemptsCollection = mongoose.connection.collection("paymentattempts");
  const result = await expireStalePendingPaymentAttempts(attemptsCollection);

  if (result.modifiedCount > 0) {
    console.log(
      `Expired ${result.modifiedCount} stale pending payment attempt(s) before enforcing checkout uniqueness`,
    );
  }
};

const ensureSingleActivePaymentAttemptIndex = async () => {
  const attemptsCollection = mongoose.connection.collection("paymentattempts");
  await attemptsCollection.createIndex(
    { orderId: 1 },
    {
      name: "one_active_attempt_per_order",
      unique: true,
      partialFilterExpression: {
        status: { $in: ["PENDING", "MANUAL_REVIEW"] },
      },
    },
  );
};

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    const courseThumbnailPaths = await mongoose.connection
      .collection("courses")
      .distinct("thumbnail", {
        thumbnail: { $regex: "^/uploads/course-thumbnails/" },
      });
    const backedUpCourseThumbnails = await backfillCourseThumbnailAssets(courseThumbnailPaths);
    if (backedUpCourseThumbnails > 0) {
      console.log(`Backed up ${backedUpCourseThumbnails} course thumbnail(s) to durable storage`);
    }
    await dropLegacyUniqueUsernameIndex();
    await ensureDirectMessageTtlIndex();
    await ensureCourseTextSearchIndex();
    await ensurePendingStatusForUnverifiedStudents();
    // Legacy attempts can remain PENDING past expiresAt. Changing only those
    // unverified rows to EXPIRED preserves webhook/transaction recovery while
    // allowing the active-attempt uniqueness constraint to be installed.
    await repairStalePendingPaymentAttempts();
    await repairDuplicatePaymentAccounting();
    // Payment checkout safety depends on this constraint. If existing active
    // duplicates prevent it from being created, fail startup instead of
    // accepting another potentially chargeable race.
    await ensureSingleActivePaymentAttemptIndex();
    await migrateLegacyTeacherRatings();
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};
