const DAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const parseTime = (value = "") => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
};

export const getUniqueTeachingDays = (schedule = []) =>
  new Set(
    (Array.isArray(schedule) ? schedule : [])
      .map((row) => String(row?.day || "").trim().toLowerCase())
      .filter((day) => Object.prototype.hasOwnProperty.call(DAY_INDEX, day)),
  );

export const deriveCourseSchedule = ({ startDate, schedule, totalSessions }) => {
  const total = Number(totalSessions);
  const start = new Date(startDate);
  const teachingDays = getUniqueTeachingDays(schedule);

  if (
    !Number.isInteger(total) ||
    total < 1 ||
    Number.isNaN(start.getTime()) ||
    !teachingDays.size
  ) {
    return null;
  }

  const scheduleByDay = new Map();
  (Array.isArray(schedule) ? schedule : []).forEach((row) => {
    const day = String(row?.day || "").trim().toLowerCase();
    if (!teachingDays.has(day) || scheduleByDay.has(DAY_INDEX[day])) return;
    scheduleByDay.set(DAY_INDEX[day], row);
  });

  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  let lastSessionEnd = null;
  let found = 0;

  for (let offset = 0; offset < 104 * 7 && found < total; offset += 1) {
    const cursor = new Date(startDay);
    cursor.setDate(cursor.getDate() + offset);
    const row = scheduleByDay.get(cursor.getDay());
    if (!row) continue;

    const startTime = parseTime(row.startTime);
    const endTime = parseTime(row.endTime);
    if (!startTime || !endTime) continue;

    const sessionStart = new Date(cursor);
    sessionStart.setHours(startTime.hours, startTime.minutes, 0, 0);
    if (sessionStart < start) continue;

    lastSessionEnd = new Date(cursor);
    lastSessionEnd.setHours(endTime.hours, endTime.minutes, 0, 0);
    found += 1;
  }

  if (found !== total || !lastSessionEnd) return null;

  const elapsedDays = Math.floor(
    (new Date(lastSessionEnd).setHours(0, 0, 0, 0) - startDay.getTime()) /
      (24 * 60 * 60 * 1000),
  ) + 1;

  return {
    durationWeeks: Math.max(1, Math.ceil(elapsedDays / 7)),
    endDate: lastSessionEnd,
  };
};
