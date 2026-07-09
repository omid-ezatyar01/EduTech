export default function LoadingSpinner() {
  return (
    <div className="loading-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>Checking certificate authenticity...</p>
    </div>
  );
}
