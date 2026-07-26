import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { fetchTeacherAccessProfile } from "../../services/teacherPortalService";
import { getAuthUser, isTeacherAuthenticated } from "../../services/portal.js";
import TeacherPageLoader from "../components/common/TeacherPageLoader.jsx";

export default function TeacherProtectedRoute({ children }) {
  const location = useLocation();
  const initialApproved = String(getAuthUser()?.teacherApplication?.status || "") === "approved";
  const [checking, setChecking] = useState(!initialApproved);
  const [isApproved, setIsApproved] = useState(() => {
    return initialApproved;
  });

  const isProfilePage = location.pathname === "/teacher/profile";

  useEffect(() => {
    let mounted = true;

    const checkApproval = async () => {
      if (!isTeacherAuthenticated()) return;

      try {
        const data = await fetchTeacherAccessProfile();
        if (!mounted) return;
        const status = String(data?.teacherApplication?.status || "");
        setIsApproved(status === "approved");
      } catch {
        if (!mounted) return;
        const user = getAuthUser();
        setIsApproved(String(user?.teacherApplication?.status || "") === "approved");
      } finally {
        if (mounted) setChecking(false);
      }
    };

    checkApproval();

    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  if (!isTeacherAuthenticated()) {
    return <Navigate to="/teacher/login" replace />;
  }

  if (checking && !isProfilePage) {
    return <TeacherPageLoader fullScreen label="در حال بارگذاری" />;
  }

  if (!isApproved && !isProfilePage) {
    return (
      <Navigate
        to="/teacher/profile"
        replace
        state={{ approvalRequired: true, from: location.pathname }}
      />
    );
  }

  return children;
}
