import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import LoadingSpinner from "../components/LoadingSpinner";
import Logo from "../components/Logo";
import ResultCard from "../components/ResultCard";
import { verifyCertificate } from "../services/verifyApi";

export default function VerifyResult() {
  const { code } = useParams();
  const navigate = useNavigate();

  const decodedCode = useMemo(() => {
    try {
      return decodeURIComponent(String(code || "")).trim();
    } catch (_error) {
      return String(code || "").trim();
    }
  }, [code]);

  const [loading, setLoading] = useState(true);
  const [resultState, setResultState] = useState("valid");
  const [resultData, setResultData] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const runVerification = async () => {
      if (!decodedCode) {
        navigate("/", { replace: true });
        return;
      }

      setLoading(true);
      setMessage("");

      try {
        const payload = await verifyCertificate(decodedCode);
        if (!isMounted) return;
        setResultData(payload);
        setResultState("valid");
      } catch (error) {
        if (!isMounted) return;
        setResultData(null);
        if (error?.type === "invalid") {
          setResultState("invalid");
          setMessage(error?.message || "Certificate not found or invalid");
        } else {
          setResultState("error");
          setMessage(
            error?.message || "Something went wrong. Please try again later.",
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    runVerification();

    return () => {
      isMounted = false;
    };
  }, [decodedCode, navigate]);

  return (
    <main className="page-shell">
      <section className="verify-card">
        <Logo />
        <h1>Verification Result</h1>
        <p className="lead-text">Certificate code: {decodedCode || "-"}</p>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <ResultCard state={resultState} data={resultData} message={message} />
        )}

        <div className="actions-row">
          <Link className="btn-link" to="/">
            Verify another certificate
          </Link>
        </div>
      </section>
    </main>
  );
}
