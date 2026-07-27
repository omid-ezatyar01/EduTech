import { Link } from "react-router";
import Logo from "../components/Logo";

export default function NotFound() {
  return (
    <main className="page-shell">
      <section className="verify-card not-found-card">
        <Logo />
        <h1>Page Not Found</h1>
        <p className="lead-text">The page you requested does not exist on verify.edutech.study.</p>
        <Link className="btn-primary" to="/">
          Back to Verification Home
        </Link>
      </section>
    </main>
  );
}
