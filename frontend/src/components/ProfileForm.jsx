import {
  Camera,
  User,
  Mail,
  Phone,
  Pencil,
  X,
  IdCard,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { updateCurrentUserProfile } from "../../services/authService";
import { COUNTRY_PROVINCE_DATA } from "../data/countryProvinceData";
import { resolveAvatarUrl } from "../utils/avatar";
import ProfileImageCropModal from "./ProfileImageCropModal";

const AVATAR_RAW_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const PHONE_REGEX = /^\+?[0-9]{8,15}$/;

const withCacheBust = (url) => {
  if (!url) return "";
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
};

const getCountryLabel = (country, isFa) => (isFa ? country.nameFa : country.nameEn);

const getProvinceLabel = (province, isFa) => (isFa ? province[1] : province[0]);

const findCountryByValue = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  return (
    COUNTRY_PROVINCE_DATA.find((country) =>
      [country.code, country.nameEn, country.nameFa].some(
        (candidate) => String(candidate || "").trim().toLowerCase() === normalized,
      ),
    ) || null
  );
};

const resolveInitialCountry = (value, isFa) => {
  const matched = findCountryByValue(value);
  return matched ? getCountryLabel(matched, isFa) : value || "";
};

const resolveInitialProvince = (countryValue, provinceValue, isFa) => {
  const matchedCountry = findCountryByValue(countryValue);
  if (!matchedCountry) return provinceValue || "";
  const normalizedProvince = String(provinceValue || "").trim().toLowerCase();
  const matchedProvince = matchedCountry.provinces.find(([nameEn, nameFa]) =>
    [nameEn, nameFa].some(
      (candidate) => String(candidate || "").trim().toLowerCase() === normalizedProvince,
    ),
  );
  return matchedProvince ? getProvinceLabel(matchedProvince, isFa) : provinceValue || "";
};

const normalizeCountryForLanguage = (value, isFa) => {
  const matchedCountry = findCountryByValue(value);
  return matchedCountry ? getCountryLabel(matchedCountry, isFa) : value || "";
};

export default function ProfileForm({ user, onProfileUpdated, language = "fa" }) {
  const isFa = language === "fa";
  const t = {
    avatarSizeError: isFa
      ? "حجم تصویر اصلی باید کمتر از ۱۰ مگابایت باشد."
      : "The source image must be under 10 MB.",
    avatarTypeError: isFa
      ? "فقط تصویر PNG، JPG یا WEBP مجاز است."
      : "Only PNG, JPG, or WEBP images are allowed.",
    invalidPhone: isFa
      ? "شماره موبایل معتبر نیست. فرمت درست: +93701234567"
      : "Invalid mobile number. Correct format: +93701234567",
    profileSaved: isFa
      ? "تغییرات پروفایل با موفقیت ذخیره شد."
      : "Profile changes saved successfully.",
    saveError: isFa
      ? "ذخیره اطلاعات با مشکل مواجه شد."
      : "Failed to save profile information.",
    personalInfo: isFa ? "اطلاعات شخصی" : "Personal Information",
    changeProfilePhoto: isFa ? "تغییر عکس پروفایل" : "Change Profile Photo",
    photoHintPrefix: isFa ? "حداکثر" : "Max",
    photoHintSize: isFa ? "خروجی خودکار کمتر از ۳۵۰ KB" : "automatically compressed below 350 KB",
    photoHintFormats: "JPG, PNG, WEBP",
    selectPhoto: isFa ? "انتخاب عکس جدید" : "Select New Photo",
    studentId: isFa ? "آیدی محصل" : "Student ID",
    firstName: isFa ? "نام" : "First Name",
    lastName: isFa ? "نام خانوادگی" : "Last Name",
    email: isFa ? "ایمیل" : "Email",
    phone: isFa ? "شماره موبایل" : "Mobile Number",
    phoneTitle: isFa ? "نمونه: +93701234567" : "Example: +93701234567",
    gender: isFa ? "جنسیت" : "Gender",
    selectGender: isFa ? "انتخاب جنسیت" : "Select gender",
    male: isFa ? "مرد" : "Male",
    female: isFa ? "زن" : "Female",
    country: isFa ? "کشور" : "Country",
    countryPlaceholder: isFa ? "نام کشور را جستجو یا انتخاب کنید" : "Search or select a country",
    province: isFa ? "ولایت / ایالت" : "Province / State",
    selectProvince: isFa ? "ولایت یا ایالت را انتخاب کنید" : "Select a province or state",
    provincePlaceholder: isFa ? "ابتدا کشور را انتخاب کنید" : "Select a country first",
    noProvinceData: isFa ? "برای این کشور فهرست ولایت ثبت نشده است" : "No province list is available for this country",
    provinceRequired: isFa
      ? "لطفاً ولایت یا ایالت را نیز انتخاب کنید."
      : "Please select the province or state as well.",
    cancelEdit: isFa ? "لغو ویرایش" : "Cancel Editing",
    saving: isFa ? "در حال ذخیره" : "Saving",
    saveChanges: isFa ? "ذخیره تغییرات" : "Save Changes",
    editInfo: isFa ? "ویرایش اطلاعات" : "Edit Information",
  };

  const [avatar, setAvatar] = useState(resolveAvatarUrl(user.avatar || ""));
  const [avatarFile, setAvatarFile] = useState(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [countryValue, setCountryValue] = useState(resolveInitialCountry(user.country, isFa));
  const [provinceValue, setProvinceValue] = useState(resolveInitialProvince(user.country, user.city, isFa));
  const [formFeedback, setFormFeedback] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    if (avatarFile) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      setAvatar(resolveAvatarUrl(user.avatar || ""));
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [user.avatar, avatarFile]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setCountryValue(resolveInitialCountry(user.country, isFa));
      setProvinceValue(resolveInitialProvince(user.country, user.city, isFa));
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [user.country, user.city, isFa]);

  const selectedCountry = useMemo(() => findCountryByValue(countryValue), [countryValue]);
  const provinceOptions = useMemo(
    () => (selectedCountry ? selectedCountry.provinces.map((province) => getProvinceLabel(province, isFa)) : []),
    [selectedCountry, isFa],
  );

  const avatarInitial =
    (user.avatarInitial || user.name || user.firstNameFa || "S")
      .trim()
      .charAt(0)
      .toUpperCase() || "S";

  const handleAvatarChange = (e) => {
    if (!isEditing) return;
    const nextFile = e.target.files?.[0];
    if (!nextFile) return;

    if (!AVATAR_MIME_TYPES.has(nextFile.type)) {
      setFormFeedback({
        type: "error",
        text: t.avatarTypeError,
      });
      e.target.value = "";
      return;
    }

    if (nextFile.size > AVATAR_RAW_MAX_SIZE_BYTES) {
      setFormFeedback({
        type: "error",
        text: t.avatarSizeError,
      });
      e.target.value = "";
      return;
    }

    setPendingAvatarFile(nextFile);
    setFormFeedback((current) => (current.type === "error" ? { type: "", text: "" } : current));
    e.target.value = "";
  };

  const handleCountryChange = (event) => {
    const nextCountry = event.target.value;
    const normalizedCountry = normalizeCountryForLanguage(nextCountry, isFa);
    setCountryValue(normalizedCountry);
    setProvinceValue("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isEditing || isSaving) return;
    setFormFeedback({ type: "", text: "" });

    const formData = new FormData(e.currentTarget);
    const rawPhone = `${formData.get("phone") || ""}`;
    const normalizedPhone = rawPhone.replace(/[\s\-()]/g, "");

    if (!PHONE_REGEX.test(normalizedPhone)) {
      setFormFeedback({
        type: "error",
        text: t.invalidPhone,
      });
      return;
    }

    if (selectedCountry && provinceOptions.length > 0 && !provinceValue.trim()) {
      setFormFeedback({
        type: "error",
        text: t.provinceRequired,
      });
      return;
    }

    const payload = {
      name: `${formData.get("firstNameFa") || ""} ${formData.get("lastNameFa") || ""}`.trim(),
      firstNameFa: formData.get("firstNameFa"),
      lastNameFa: formData.get("lastNameFa"),
      email: user.email,
      phone: normalizedPhone,
      gender: formData.get("gender"),
      country: formData.get("country"),
      city: formData.get("city"),
      avatarFile,
    };

    try {
      setIsSaving(true);
      const response = await updateCurrentUserProfile(payload);
      const updatedUser = response?.user || {};
      const resolvedAvatar = resolveAvatarUrl(updatedUser.avatar || "");
      const nextAvatar = resolvedAvatar
        ? withCacheBust(resolvedAvatar)
        : avatarFile
          ? URL.createObjectURL(avatarFile)
          : "";
      setAvatar(nextAvatar);
      setAvatarFile(null);
      setPendingAvatarFile(null);
      setIsEditing(false);
      onProfileUpdated?.(updatedUser);
      window.dispatchEvent(new Event("edutech_data_changed"));
      setFormFeedback({
        type: "success",
        text: t.profileSaved,
      });
    } catch (error) {
      setFormFeedback({
        type: "error",
        text: error?.message || t.saveError,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.03)] sm:p-8"
    >
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <User size={24} />
        </div>
        <h2 className="text-xl font-black text-slate-950">{t.personalInfo}</h2>
      </div>

      <div className="mb-10 flex flex-col items-center gap-4 sm:flex-row">
        <div
          className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white shadow-lg ${isEditing ? "group cursor-pointer" : "opacity-80"}`}
        >
          {avatar ? (
            <img
              src={avatar}
              alt="Profile"
              className={`h-full w-full object-cover transition duration-300 ${isEditing ? "group-hover:blur-sm" : ""}`}
              onError={() => setAvatar("")}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-2xl font-black text-slate-700">
              {avatarInitial}
            </div>
          )}
          <div
            className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-300 ${isEditing ? "opacity-0 group-hover:opacity-100" : "opacity-0"}`}
          >
            <Camera className="text-white" size={24} />
          </div>
          <input
            type="file"
            className={`absolute inset-0 opacity-0 ${isEditing ? "cursor-pointer" : "pointer-events-none"}`}
            accept="image/png,image/jpeg,image/webp"
            onChange={handleAvatarChange}
            disabled={!isEditing}
          />
        </div>

        <div className="text-center sm:text-start">
          <p className="text-sm font-bold text-slate-700">{t.changeProfilePhoto}</p>
          <p className="mb-3 mt-1 text-xs font-semibold text-slate-500">
            {isFa ? (
              <>
                <span>{t.photoHintPrefix} </span>
                <span dir="ltr" className="inline-block">
                  {t.photoHintSize}
                </span>
                <span> ، </span>
                <span dir="ltr" className="inline-block">
                  {t.photoHintFormats}
                </span>
              </>
            ) : (
              <>
                <span>{t.photoHintPrefix} </span>
                <span dir="ltr" className="inline-block">
                  {t.photoHintSize}
                </span>
                <span>, </span>
                <span dir="ltr" className="inline-block">
                  {t.photoHintFormats}
                </span>
              </>
            )}
          </p>
          <div className="relative inline-block">
            <button
              type="button"
              className={`rounded-xl border px-5 py-2.5 text-xs font-black transition ${isEditing ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100" : "border-slate-200 bg-slate-100 text-slate-400"}`}
            >
              {t.selectPhoto}
            </button>
            <input
              type="file"
              className={`absolute inset-0 opacity-0 ${isEditing ? "cursor-pointer" : "pointer-events-none"}`}
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarChange}
              disabled={!isEditing}
            />
          </div>
        </div>
      </div>

      <div className="mb-7 grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700">{t.studentId}</label>
          <div className="relative flex items-center">
            <IdCard size={18} className="absolute start-4 text-slate-400" />
            <input
              type="text"
              defaultValue={user.studentId || ""}
              className="w-full rounded-xl border border-slate-200 bg-slate-100 py-3.5 pe-4 ps-11 text-sm font-semibold text-slate-600 outline-none"
              dir="ltr"
              readOnly
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700">{t.email}</label>
          <div className="relative flex items-center">
            <Mail size={18} className="absolute start-4 text-slate-400" />
            <input
              type="email"
              name="email"
              value={user.email || ""}
              required
              readOnly
              className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 py-3.5 pe-4 ps-11 text-sm font-semibold text-slate-500 outline-none"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700">{t.firstName}</label>
          <input
            type="text"
            name="firstNameFa"
            defaultValue={user.firstNameFa}
            required
            disabled={!isEditing}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700">{t.lastName}</label>
          <input
            type="text"
            name="lastNameFa"
            defaultValue={user.lastNameFa}
            required
            disabled={!isEditing}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700">{t.phone}</label>
          <div className="relative flex items-center">
            <Phone size={18} className="absolute start-4 text-slate-400" />
            <input
              type="tel"
              name="phone"
              defaultValue={user.phone}
              required
              disabled={!isEditing}
              inputMode="tel"
              pattern="^\+?[0-9\s\-()]{8,20}$"
              title={t.phoneTitle}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pe-4 ps-11 text-sm font-semibold outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              dir="ltr"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700">{t.gender}</label>
          <select
            name="gender"
            defaultValue={user.gender || ""}
            disabled={!isEditing}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">{t.selectGender}</option>
            <option value="مرد">{t.male}</option>
            <option value="زن">{t.female}</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700">{t.country}</label>
          <input
            type="text"
            name="country"
            value={countryValue}
            onChange={handleCountryChange}
            onBlur={() => {
              setCountryValue((current) => normalizeCountryForLanguage(current, isFa));
            }}
            placeholder={t.countryPlaceholder}
            disabled={!isEditing}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700">{t.province}</label>
          <select
            name="city"
            value={provinceValue}
            onChange={(event) => setProvinceValue(event.target.value)}
            disabled={!isEditing || !selectedCountry || !provinceOptions.length}
            required={isEditing && Boolean(selectedCountry) && provinceOptions.length > 0}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">
              {selectedCountry ? t.selectProvince : t.provincePlaceholder}
            </option>
            {provinceOptions.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>
          {selectedCountry && !provinceOptions.length ? (
            <p className="mt-1.5 text-[11px] font-semibold text-slate-400">{t.noProvinceData}</p>
          ) : null}
        </div>

      </div>

      {formFeedback.text ? (
        <div
          className={`mt-6 rounded-xl border px-4 py-3 text-sm font-bold ${
            formFeedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
          role={formFeedback.type === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {formFeedback.text}
        </div>
      ) : null}

      {isEditing ? (
        <div
          className="mt-8 flex items-center justify-start border-t border-slate-100 pt-6"
          dir={isFa ? "rtl" : "ltr"}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setAvatar(resolveAvatarUrl(user.avatar || ""));
                setAvatarFile(null);
                setPendingAvatarFile(null);
                setCountryValue(resolveInitialCountry(user.country, isFa));
                setProvinceValue(resolveInitialProvince(user.country, user.city, isFa));
                setFormFeedback({ type: "", text: "" });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              <X size={16} />
              {t.cancelEdit}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-teal-500 px-10 py-4 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSaving ? t.saving : t.saveChanges}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="mt-8 flex items-center justify-start border-t border-slate-100 pt-6"
          dir={isFa ? "rtl" : "ltr"}
        >
          <button
            type="button"
            onClick={() => {
              setIsEditing(true);
              setFormFeedback({ type: "", text: "" });
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-primary-700"
          >
            <Pencil size={16} />
            {t.editInfo}
          </button>
        </div>
      )}
      <ProfileImageCropModal
        open={pendingAvatarFile instanceof File}
        file={pendingAvatarFile}
        language={language}
        onClose={() => setPendingAvatarFile(null)}
        onApply={(croppedFile) => {
          setAvatar(URL.createObjectURL(croppedFile));
          setAvatarFile(croppedFile);
          setPendingAvatarFile(null);
          setFormFeedback((current) => (current.type === "error" ? { type: "", text: "" } : current));
        }}
      />
    </form>
  );
}
