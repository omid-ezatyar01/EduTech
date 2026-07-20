import "./CertificatePreview.css";

export default function CertificatePreview({ certificate }) {
  const hasArabicScript = (value = "") =>
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(String(value));
  const pickCertificateName = (
    primaryValue = "",
    secondaryValue = "",
    fallbackValue = "",
  ) => {
    const primary = String(primaryValue || "").trim();
    const secondary = String(secondaryValue || "").trim();

    if (hasArabicScript(primary)) return primary;
    if (hasArabicScript(secondary)) return secondary;
    return primary || secondary || fallbackValue;
  };
  const studentName = pickCertificateName(
    certificate?.student,
    certificate?.studentEn,
    "Jason Michael Turner",
  );

  const courseTitle =
    certificate?.courseEn ||
    certificate?.course ||
    "Professional Diploma in Business Management";

  const issueDate =
    certificate?.issueDateCertificate || certificate?.issueDate || "-";
  const rawCertId = String(certificate?.certificateId || "").trim();
  const verifyUrl = "verify.edutech.study";
  const founderName = certificate?.founderName || "Omid Ezatyar";
  const founderRole = certificate?.founderRole || "Founder & CEO";
  const rawInstructorName = pickCertificateName(
    certificate?.teacher,
    certificate?.teacherEn,
    "",
  );
  const instructorName =
    !rawInstructorName || rawInstructorName.trim() === "استاد"
      ? "EduTech Instructor"
      : rawInstructorName;
  const instructorRole = certificate?.instructorRole || "Course Instructor";
  const studentNameIsRtl = hasArabicScript(studentName);
  const instructorNameIsRtl = hasArabicScript(instructorName);

  return (
    <div
      id={`certificate-preview-${certificate?.id || certificate?.certificateId}`}
      className="certificate-preview-shell"
      dir="ltr"
    >
      {rawCertId ? (
        <p className="certificate-preview-corner-id">
          Certificate ID: {rawCertId}
        </p>
      ) : null}

      <div
        className="certificate-preview-curves certificate-preview-curves-top-left"
        aria-hidden="true"
      >
        <svg viewBox="0 0 280 220" preserveAspectRatio="none">
          <path d="M-50 150 C 40 30, 150 -10, 255 28" />
          <path d="M-70 190 C 28 70, 150 20, 265 58" />
        </svg>
      </div>

      <div
        className="certificate-preview-curves certificate-preview-curves-bottom-right"
        aria-hidden="true"
      >
        <svg viewBox="0 0 320 260" preserveAspectRatio="none">
          <path d="M48 255 C 165 168, 238 104, 312 -26" />
          <path d="M84 280 C 190 202, 264 136, 332 -8" />
        </svg>
      </div>

      <div className="certificate-preview-content">
        <div className="certificate-preview-logo" aria-hidden="true">
          <img
            src="/logo.png"
            alt="EduTech logo"
            className="certificate-preview-logo-image"
          />
        </div>

        <p className="certificate-preview-header">
          EduTech Online Academy
        </p>

        <h2 className="certificate-preview-title">CERTIFICATE OF ACHIEVEMENT</h2>

        <p className="certificate-preview-body">This is to certify that</p>

        <p
          className={`certificate-preview-recipient ${
            studentNameIsRtl ? "certificate-preview-recipient-rtl" : ""
          }`}
          dir={studentNameIsRtl ? "rtl" : "ltr"}
          lang={studentNameIsRtl ? "fa" : "en"}
        >
          {studentName}
        </p>

        <p className="certificate-preview-body">
          has successfully completed the prescribed course of study and training
          requirements for the
        </p>

        <p className="certificate-preview-course">{courseTitle}</p>

        <p className="certificate-preview-body">
          and is hereby awarded this certificate in recognition of achievement.
        </p>

        <p className="certificate-preview-body">Given this {issueDate}.</p>

        <div className="certificate-preview-signature-row">
          <div className="certificate-preview-signature">
            <p className="certificate-preview-signature-name certificate-preview-signature-script certificate-preview-signature-founder">
              {founderName}
            </p>
            <div
              className="certificate-preview-signature-line certificate-preview-signature-line-founder"
              aria-hidden="true"
            />
            <p className="certificate-preview-signature-role">{founderRole}</p>
          </div>

          <div className="certificate-preview-verify">
            <p className="certificate-preview-verify-label">Verify at:</p>
            <p className="certificate-preview-verify-value">{verifyUrl}</p>
          </div>

          <div className="certificate-preview-signature">
            <p
              className={`certificate-preview-signature-name certificate-preview-signature-instructor ${
                instructorNameIsRtl
                  ? "certificate-preview-signature-name-rtl"
                  : ""
              }`}
              dir={instructorNameIsRtl ? "rtl" : "ltr"}
              lang={instructorNameIsRtl ? "fa" : "en"}
            >
              {instructorName}
            </p>
            <div
              className="certificate-preview-signature-line"
              aria-hidden="true"
            />
            <p className="certificate-preview-signature-role">
              {instructorRole}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
