import "./config/loadEnv.js";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { startCourseAutoStartScheduler } from "./services/courseAutoStartScheduler.service.js";
import { startStudentCalendarSyncWorker } from "./services/studentCalendarSync.service.js";

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`EduTech API running on port ${PORT}`);
  });
  startCourseAutoStartScheduler();
  startStudentCalendarSyncWorker();
});
