import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const SEVENTY_TWO_HOURS_IN_MILLISECONDS = 72 * 60 * 60 * 1000;

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
    const textKey = { title: "text", shortDescription: "text", description: "text" };
    const textIndexName = "course_text_search";

    const textIndexesToDrop = indexes.filter((index) => {
      if (index?.name === "_id_" || !index?.key) return false;
      const hasTextKey = Object.values(index.key).some((value) => value === "text");
      if (!hasTextKey) return false;
      return (
        index.name !== textIndexName ||
        index.language_override !== "textSearchLanguage" ||
        index.default_language !== "none"
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

const ensureAdminCreatedTeacherDefaultPasswords = async () => {
  try {
    const usersCollection = mongoose.connection.collection("users");
    const adminCreatedTeachers = await usersCollection
      .find(
        {
          role: "teacher",
          phone: "0700000000",
          passwordChangedAt: null,
        },
        {
          projection: {
            _id: 1,
            password: 1,
          },
        },
      )
      .toArray();

    if (!adminCreatedTeachers.length) {
      return;
    }

    const defaultPasswordHash = await bcrypt.hash("123456", 10);
    let repairedCount = 0;

    for (const teacher of adminCreatedTeachers) {
      const alreadyMatches = await bcrypt.compare("123456", String(teacher.password || ""));
      if (alreadyMatches) continue;

      await usersCollection.updateOne(
        { _id: teacher._id },
        {
          $set: {
            password: defaultPasswordHash,
          },
        },
      );

      repairedCount += 1;
    }

    if (repairedCount > 0) {
      console.log(`Repaired ${repairedCount} admin-created teacher password(s) to the default value`);
    }
  } catch (error) {
    console.warn(`Could not repair admin-created teacher passwords: ${error.message}`);
  }
};

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    await dropLegacyUniqueUsernameIndex();
    await ensureDirectMessageTtlIndex();
    await ensureCourseTextSearchIndex();
    await ensurePendingStatusForUnverifiedStudents();
    await ensureAdminCreatedTeacherDefaultPasswords();
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};
