import { useState } from "react";

const getTodayInputDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getInitialForm = () => ({
  courseId: "",
  topic: "",
  date: getTodayInputDate(),
  meetLink: "",
  description: "",
  notify: true,
  reminder: true,
  autoAttendance: false,
  autoGenerateMeet: true,
});

const extractTime = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{2}:\d{2}$/.test(text)) return text;
  const [, timePart = ""] = text.split("T");
  return timePart.slice(0, 5);
};

const resolveCourseTimes = (course = {}) => {
  const firstSchedule = Array.isArray(course?.schedule) && course.schedule.length
    ? course.schedule[0]
    : null;
  const scheduleStart = extractTime(firstSchedule?.startTime);
  const scheduleEnd = extractTime(firstSchedule?.endTime);
  if (scheduleStart && scheduleEnd) {
    return { startTime: scheduleStart, endTime: scheduleEnd };
  }

  const startFromDate = extractTime(course?.startDate);
  const endFromDate = extractTime(course?.endDate);
  return {
    startTime: startFromDate || "18:00",
    endTime: endFromDate || "19:00",
  };
};

export default function CreateLiveClassModal({
  open,
  onClose,
  onSubmit,
  courses = [],
  language = "fa",
  defaultCourseId = "",
}) {
  const [form, setForm] = useState(getInitialForm());
  const firstCourseId =
    courses.find((item) => item._id === defaultCourseId)?._id ||
    courses[0]?._id ||
    "";

  if (!open) {
    return null;
  }

  const selectedCourseId = form.courseId || firstCourseId;
  const selectedCourse = courses.find((item) => item._id === selectedCourseId) || {};
  const resolvedTimes = resolveCourseTimes(selectedCourse);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const handleClose = () => {
    setForm(getInitialForm());
    onClose();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      ...form,
      courseId: selectedCourseId,
      notify: true,
      reminder: true,
      autoAttendance: true,
      startTime: resolvedTimes.startTime,
      endTime: resolvedTimes.endTime,
    });
    setForm(getInitialForm());
  };

  const labels = {
    title: language === "fa" ? "ایجاد صنف زنده" : "Create Live Session",
    course: language === "fa" ? "انتخاب کورس" : "Select Course",
    topic: language === "fa" ? "موضوع صنف" : "Session Topic",
    date: language === "fa" ? "تاریخ" : "Date",
    courseTime: language === "fa" ? "زمان کورس" : "Course Time",
    link: language === "fa" ? "لینک صنف" : "Session Link",
    description: language === "fa" ? "توضیحات" : "Description",
    autoGenerateMeet:
      language === "fa" ? "تولید خودکار لینک Google Meet" : "Auto-generate Google Meet link",
    cancel: language === "fa" ? "لغو" : "Cancel",
    submit: language === "fa" ? "ایجاد صنف" : "Create Session",
    noCourses:
      language === "fa"
        ? "ابتدا یک کورس ایجاد کنید تا بتوانید صنف زنده بسازید."
        : "Create a course first to schedule live sessions.",
    linkPlaceholder:
      language === "fa"
        ? "https://meet.google.com/..."
        : "https://meet.google.com/...",
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-3" onClick={handleClose}>
      <form onSubmit={handleSubmit} onClick={(event) => event.stopPropagation()} className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <h3 className="text-xl font-black text-[#0F172A]">{labels.title}</h3>

        {!courses.length ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            {labels.noCourses}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">{labels.course}</span>
            <select
              value={selectedCourseId}
              onChange={(e) => setField("courseId", e.target.value)}
              className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]"
              required
            >
              {courses.map((course) => (
                <option key={course._id} value={course._id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">{labels.topic}</span>
            <input value={form.topic} required onChange={(e) => setField("topic", e.target.value)} placeholder="مثلاً Authentication & JWT" className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]" />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">{labels.date}</span>
            <input type="date" value={form.date} required onChange={(e) => setField("date", e.target.value)} className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]" />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">{labels.courseTime}</span>
            <input
              value={resolvedTimes.startTime && resolvedTimes.endTime ? `${resolvedTimes.startTime} - ${resolvedTimes.endTime}` : "-"}
              readOnly
              className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-slate-50 px-3 text-sm font-semibold text-slate-700"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-slate-600">{labels.link}</span>
            <input
              value={form.meetLink}
              required={!form.autoGenerateMeet}
              onChange={(e) => setField("meetLink", e.target.value)}
              placeholder={labels.linkPlaceholder}
              disabled={form.autoGenerateMeet}
              className="h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm outline-none focus:border-[#0B4FD8]"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-slate-600">{labels.description}</span>
            <textarea rows={4} value={form.description} onChange={(e) => setField("description", e.target.value)} className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#0B4FD8]" />
          </label>
        </div>

        <div className="mt-4 space-y-2 text-sm font-semibold text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.autoGenerateMeet} onChange={(e) => setField("autoGenerateMeet", e.target.checked)} /> {labels.autoGenerateMeet}</label>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={handleClose} className="h-11 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-700">{labels.cancel}</button>
          <button type="submit" disabled={!courses.length} className="h-11 rounded-xl bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9] text-sm font-bold text-white disabled:opacity-60">{labels.submit}</button>
        </div>
      </form>
    </div>
  );
}
