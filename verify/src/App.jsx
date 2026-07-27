import { Navigate, Route, Routes } from "react-router";
import VerifyHome from "./pages/VerifyHome";
import VerifyResult from "./pages/VerifyResult";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<VerifyHome />} />
      <Route path="/verify/:code" element={<VerifyResult />} />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
