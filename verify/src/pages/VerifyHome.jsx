import { useNavigate } from "react-router";
import Logo from "../components/Logo";
import VerifyForm from "../components/VerifyForm";

export default function VerifyHome() {
  const navigate = useNavigate();

  const handleSubmit = (code) => {
    navigate(`/verify/${encodeURIComponent(code)}`);
  };

  return (
    <main className="page-shell">
      <section className="verify-card">
        <Logo />
        <h1>Verify Certificate</h1>
        <p className="lead-text">
          Enter your certificate ID to confirm that the certificate is authentic and issued by EduTech.
        </p>
        <VerifyForm onSubmit={handleSubmit} />
      </section>
    </main>
  );
}
