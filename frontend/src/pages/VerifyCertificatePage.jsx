import { useMemo } from "react";
import { useSearchParams } from "react-router";
import VerifyCertificateCard from "../components/VerifyCertificateCard.jsx";

export default function VerifyCertificatePage() {
  const [searchParams] = useSearchParams();
  const initialCode = useMemo(
    () => String(searchParams.get("id") || "").trim().toUpperCase(),
    [searchParams],
  );

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black text-slate-950">Certificate Verification</h1>
        <p className="mt-3 text-sm font-medium text-slate-600">
          Enter a certificate ID to check whether it is valid in EduTech records.
        </p>
      </div>
      <VerifyCertificateCard initialCode={initialCode} />
    </section>
  );
}
