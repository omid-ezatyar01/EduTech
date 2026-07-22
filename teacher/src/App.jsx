import { useEffect } from "react";
import TeacherRoutes from "./routes/TeacherRoutes";
import { enableCoursePushNotifications } from "../services/pushNotifications";
import { isTeacherAuthenticated } from "../services/portal";
import { applyEduTechLogoFallback } from "./utils/imageFallback.js";

function App() {
  useEffect(() => {
    document.body.classList.add("app-ready");
    const loader = document.getElementById("app-boot-loader");
    if (!loader) return undefined;
    loader.classList.add("app-boot-loader--hidden");
    const cleanupTimer = window.setTimeout(() => {
      loader.remove();
    }, 260);
    return () => window.clearTimeout(cleanupTimer);
  }, []);

  useEffect(() => {
    const setupPushNotifications = () => {
      if (!isTeacherAuthenticated()) return;
      enableCoursePushNotifications().catch((error) => {
        console.warn(`Course push notification setup failed: ${error.message}`);
      });
    };

    setupPushNotifications();
    window.addEventListener("teacher_auth_change", setupPushNotifications);
    return () => window.removeEventListener("teacher_auth_change", setupPushNotifications);
  }, []);

  return <div onErrorCapture={applyEduTechLogoFallback}><TeacherRoutes /></div>;
}

export default App;
