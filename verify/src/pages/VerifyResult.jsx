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
      return decodeURIComponent(String(code || "")).trim().toUpperCase();
    } catch (_error) {
      return String(code || "").trim().toUpperCase();
    }
  }, [code]);

  const [loading, setLoading] = useState(true);
  const [resultState, setResultState] = useState("valid");
  const [resultData, setResultData] = useState(null);
  const [message, setMessage] = useState("");
  const [retrySeed, setRetrySeed] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const runVerification = async () => {
      if (!decodedCode) {
        navigate("/", { replace: true });
        return;
      }

      setLoading(true);
      setMessage("");

      try {
        const payload = await verifyCertificate(decodedCode, {
          signal: controller.signal,
        });
        if (!isMounted) return;
        setResultData(payload);
        setResultState("valid");
      } catch (error) {
        if (!isMounted) return;
        if (error?.code === "ERR_CANCELED") return;
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
      controller.abort();
    };
  }, [decodedCode, navigate, retrySeed]);

  return (
    <main className="page-shell">
      <section className="verify-card">
        <Logo />
        <h1>Verification Result</h1>
        <p className="lead-text">Certificate code: {decodedCode || "-"}</p>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <ResultCard
            state={resultState}
            data={resultData}
            message={message}
            onRetry={() => setRetrySeed((value) => value + 1)}
          />
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
