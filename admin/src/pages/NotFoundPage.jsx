import { Link } from "react-router";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";

export default function NotFoundPage() {
  const { tr } = useAdminI18n();

  return (
    <section className="not-found font-sans">
      <h1>{tr("Page not found")}</h1>
      <Link to="/">{tr("Go to dashboard")}</Link>
    </section>
  );
}
