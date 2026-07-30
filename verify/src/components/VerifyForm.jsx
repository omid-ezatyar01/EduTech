import { useState } from "react";
import {
  CERTIFICATE_ID_PATTERN,
  normalizeCertificateCode,
} from "../services/verifyApi";

export default function VerifyForm({ defaultCode = "", onSubmit, isSubmitting = false }) {
  const [code, setCode] = useState(defaultCode);
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const cleaned = normalizeCertificateCode(code);

    if (!cleaned) {
      setError("Please enter a certificate ID or verification code.");
      return;
    }
    if (!CERTIFICATE_ID_PATTERN.test(cleaned)) {
      setError("Use the format ED-2026-ABC123.");
      return;
    }

    setError("");
    onSubmit(cleaned);
  };

  return (
    <form className="verify-form" onSubmit={handleSubmit} noValidate>
      <label className="input-label" htmlFor="verify-code">
        Certificate ID / Verification Code
      </label>
      <input
        id="verify-code"
        type="text"
        className="text-input"
        value={code}
        onChange={(event) => {
          setCode(event.target.value);
          if (error) setError("");
        }}
        placeholder="Example: ED-2026-0BE874DE"
        autoComplete="off"
        spellCheck={false}
        dir="ltr"
        maxLength={20}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "verify-code-error" : undefined}
      />
      {error ? <p id="verify-code-error" className="form-error" role="alert">{error}</p> : null}
      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {isSubmitting ? "Verifying..." : "Verify Now"}
      </button>
    </form>
  );
}
