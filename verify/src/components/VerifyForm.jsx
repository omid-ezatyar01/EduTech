import { useState } from "react";

export default function VerifyForm({ defaultCode = "", onSubmit, isSubmitting = false }) {
  const [code, setCode] = useState(defaultCode);
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const cleaned = String(code || "").trim();

    if (!cleaned) {
      setError("Please enter a certificate ID or verification code.");
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
      />
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {isSubmitting ? "Verifying..." : "Verify Now"}
      </button>
    </form>
  );
}
