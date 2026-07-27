import "./config/loadEnv.js";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { startCourseAutoStartScheduler } from "./services/courseAutoStartScheduler.service.js";
import { startStudentCalendarSyncWorker } from "./services/studentCalendarSync.service.js";
import http from "http";
import { initializeSupportRealtime } from "./services/supportRealtime.service.js";
import { startExchangeRateScheduler } from "./services/exchangeRateScheduler.service.js";

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  const server = http.createServer(app);
  initializeSupportRealtime(server);
  server.listen(PORT, () => {
    console.log(`EduTech API running on port ${PORT}`);
  });
  startCourseAutoStartScheduler();
  startStudentCalendarSyncWorker();
  startExchangeRateScheduler();
});
