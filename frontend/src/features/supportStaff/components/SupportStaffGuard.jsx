import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import {
  isSupportStaffAuthenticated,
  onSupportStaffAuthChange,
} from "../services/supportStaffAuth.js";

export default function SupportStaffGuard({ children }) {
  const [authenticated, setAuthenticated] = useState(isSupportStaffAuthenticated);

  useEffect(
    () => onSupportStaffAuthChange(() => setAuthenticated(isSupportStaffAuthenticated())),
    [],
  );

  return authenticated ? children : <Navigate to="/support/login" replace />;
}
