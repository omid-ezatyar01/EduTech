const formatDate = (rawDate) => {
  if (!rawDate) return "-";
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const safeCertificateUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
};

export default function ResultCard({ state, data, message, onRetry }) {
  const certificateUrl = safeCertificateUrl(data?.certificateUrl);
  if (state === "valid") {
    return (
      <article className="result-card result-valid" role="status">
        <header className="result-header">
          <h2>Certificate Verified</h2>
          <span className="status-pill">Verified</span>
        </header>
        <dl className="result-grid">
          <div>
            <dt>Student Name</dt>
            <dd>{data?.studentName || "-"}</dd>
          </div>
          <div>
            <dt>Course Name</dt>
            <dd>{data?.courseTitle || "-"}</dd>
          </div>
          <div>
            <dt>Teacher Name</dt>
            <dd>{data?.teacherName || "-"}</dd>
          </div>
          <div>
            <dt>Issue Date</dt>
            <dd>{formatDate(data?.issuedAt)}</dd>
          </div>
          <div>
            <dt>Certificate ID</dt>
            <dd>{data?.certificateId || "-"}</dd>
          </div>
        </dl>

        {certificateUrl ? (
          <a className="btn-secondary" href={certificateUrl} target="_blank" rel="noopener noreferrer">
            View Certificate
          </a>
        ) : null}
      </article>
    );
  }

  if (state === "invalid") {
    return (
      <article className="result-card result-invalid" role="status">
        <h2>Certificate Not Found</h2>
        <p>{message || "We could not find this certificate. Please check the ID and try again."}</p>
      </article>
    );
  }

  return (
    <article className="result-card result-error" role="alert">
      <h2>Verification Temporarily Unavailable</h2>
      <p>{message || "Please try again in a few minutes."}</p>
      {onRetry ? (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          Try Again
        </button>
      ) : null}
    </article>
  );
}
