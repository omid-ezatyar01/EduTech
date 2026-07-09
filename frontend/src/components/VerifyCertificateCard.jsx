import { useEffect, useState } from "react";
import { FileSearch } from "lucide-react";
import { verifyCertificateById } from "../../services/courseService.js";

const formatIssuedDate = (rawDate) => {
  if (!rawDate) return "-";
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

export default function VerifyCertificateCard({
  initialCode = "",
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "تایید اصالت" : "Certificate Verification",
    subtitle: isFa
      ? "کد سرتیفیکیت را وارد کنید تا از اصالت آن اطمینان حاصل شود."
      : "Enter the certificate code to verify authenticity.",
    inputPlaceholder: isFa
      ? "کد سرتیفیکیت را وارد کنید"
      : "Enter certificate code",
    checking: isFa ? "در حال بررسی" : "Verifying",
    verify: isFa ? "تایید اصالت" : "Verify",
    valid: isFa ? "سرتیفیکیت معتبر است" : "Certificate is valid",
    invalid: isFa ? "کد سرتیفیکیت معتبر نیست" : "Invalid certificate code",
    empty: isFa
      ? "لطفاً کد سرتیفیکیت را وارد کنید"
      : "Please enter a certificate code",
    issueDate: isFa ? "Date" : "Date",
  };

  const [code, setCode] = useState(String(initialCode || ""));
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, success, error
  const [isLoading, setIsLoading] = useState(false);

  const runVerification = async (rawCode) => {
    const requestedCode = String(rawCode || "").trim().toUpperCase();
    if (!requestedCode) {
      setStatus("empty");
      setResult(null);
      return;
    }
    try {
      setIsLoading(true);
      setStatus("idle");
      const data = await verifyCertificateById(requestedCode);
      setCode(requestedCode);
      setResult(data);
      setStatus("success");
    } catch (_error) {
      setResult(null);
      setStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const prefetchedCode = String(initialCode || "").trim().toUpperCase();
    setCode(prefetchedCode);
    if (!prefetchedCode) return;

    let isMounted = true;
    const verifyPrefilledCode = async () => {
      try {
        setIsLoading(true);
        setStatus("idle");
        const data = await verifyCertificateById(prefetchedCode);
        if (!isMounted) return;
        setResult(data);
        setStatus("success");
      } catch (_error) {
        if (!isMounted) return;
        setResult(null);
        setStatus("error");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    verifyPrefilledCode();
    return () => {
      isMounted = false;
    };
  }, [initialCode]);

  const handleVerify = async () => {
    await runVerification(code);
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <FileSearch size={20} />
        </div>
        <h3 className="text-lg font-black text-slate-950">{t.title}</h3>
      </div>
      <p className="mb-5 text-sm font-semibold leading-7 text-slate-600">
        {t.subtitle}
      </p>

      <div className="space-y-3">
        <input
          type="text"
          placeholder={t.inputPlaceholder}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setStatus("idle");
            setResult(null);
          }}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold outline-none transition focus:border-primary-500 focus:bg-white text-center"
          dir="ltr"
        />
        <button
          onClick={handleVerify}
          disabled={isLoading}
          className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
        >
          {isLoading ? t.checking : t.verify}
        </button>
      </div>

      {status === "success" && (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-xs font-black text-green-700">
          <p className="text-center">{t.valid}</p>
          <p className="mt-2 text-center font-semibold">
            {result?.studentName || "-"} | {result?.courseTitle || "-"}
          </p>
          <p className="mt-1 text-center font-semibold">
            {t.issueDate}: {formatIssuedDate(result?.issuedAt)}
          </p>
        </div>
      )}
      {status === "error" && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-center text-xs font-black text-red-600">
          {t.invalid}
        </p>
      )}
      {status === "empty" && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-center text-xs font-black text-amber-600">
          {t.empty}
        </p>
      )}
    </div>
  );
}
