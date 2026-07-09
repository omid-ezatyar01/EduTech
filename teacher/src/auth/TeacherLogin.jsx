import TeacherAuthLayout from "../layouts/TeacherAuthLayout";
import TeacherAuthVisual from "../components/auth/TeacherAuthVisual";
import TeacherLoginForm from "../components/auth/TeacherLoginForm";
import useTeacherLanguage from "../hooks/useTeacherLanguage";

export default function TeacherLogin() {
  const { language, isRTL, setLanguage } = useTeacherLanguage();

  return (
    <TeacherAuthLayout
      language={language}
      isRTL={isRTL}
      onLanguageChange={setLanguage}
      showHeader={false}
      showSecurityNote={false}
      compact
    >
      <div className="w-full shrink-0 lg:w-1/2">
        <TeacherLoginForm language={language} isRTL={isRTL} />
      </div>
      <TeacherAuthVisual
        language={language}
        isRTL={isRTL}
        className={`hidden w-full shrink-0 lg:flex lg:w-1/2 ${isRTL ? "border-r" : "border-l"} border-[#E2E8F0]`}
      />
    </TeacherAuthLayout>
  );
}
