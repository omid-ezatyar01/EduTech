export const BOOTCAMP_TIME_ZONE = "Asia/Kabul";

const getTimeZoneParts = (value, timeZone = BOOTCAMP_TIME_ZONE) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

const timeZoneOffsetMilliseconds = (date, timeZone) => {
  const parts = getTimeZoneParts(date, timeZone);
  if (!parts) return 0;
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ) - date.getTime();
};

// Before timezone-aware administration, datetime-local values were serialized
// as UTC. Their UTC clock fields are the intended Kabul wall-clock fields.
export const interpretLegacyUtcWallClockAsKabul = (value) => {
  const legacyDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(legacyDate.getTime())) return null;
  const localAsUtc = Date.UTC(
    legacyDate.getUTCFullYear(),
    legacyDate.getUTCMonth(),
    legacyDate.getUTCDate(),
    legacyDate.getUTCHours(),
    legacyDate.getUTCMinutes(),
    legacyDate.getUTCSeconds(),
    legacyDate.getUTCMilliseconds(),
  );
  let instant = localAsUtc;
  for (let index = 0; index < 3; index += 1) {
    const nextInstant = localAsUtc - timeZoneOffsetMilliseconds(
      new Date(instant),
      BOOTCAMP_TIME_ZONE,
    );
    if (nextInstant === instant) break;
    instant = nextInstant;
  }
  return new Date(instant);
};

export const migrateLegacyBootcampTimes = async (bootcampsCollection) => {
  if (!bootcampsCollection?.find) return 0;
  const cursor = bootcampsCollection.find(
    { scheduleTimeZone: { $exists: false } },
    {
      projection: {
        registrationOpensAt: 1,
        registrationClosesAt: 1,
        plannedStartAt: 1,
      },
    },
  );
  let migrated = 0;
  for await (const bootcamp of cursor) {
    const $set = { scheduleTimeZone: BOOTCAMP_TIME_ZONE };
    for (const field of [
      "registrationOpensAt",
      "registrationClosesAt",
      "plannedStartAt",
    ]) {
      if (bootcamp[field]) {
        const corrected = interpretLegacyUtcWallClockAsKabul(bootcamp[field]);
        if (corrected) $set[field] = corrected;
      }
    }
    const result = await bootcampsCollection.updateOne(
      { _id: bootcamp._id, scheduleTimeZone: { $exists: false } },
      { $set },
    );
    migrated += Number(result?.modifiedCount || 0);
  }
  return migrated;
};

export const syncInternalBootcampCourseStartDates = async (
  bootcampsCollection,
  coursesCollection,
) => {
  if (!bootcampsCollection?.find || !coursesCollection?.updateOne) return 0;
  const cursor = bootcampsCollection.find(
    { courseId: { $exists: true }, plannedStartAt: { $ne: null } },
    { projection: { courseId: 1, plannedStartAt: 1 } },
  );
  let synced = 0;
  for await (const bootcamp of cursor) {
    const result = await coursesCollection.updateOne(
      {
        _id: bootcamp.courseId,
        isBootcampInternal: true,
        startDate: { $ne: bootcamp.plannedStartAt },
      },
      { $set: { startDate: bootcamp.plannedStartAt } },
    );
    synced += Number(result?.modifiedCount || 0);
  }
  return synced;
};
