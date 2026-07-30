import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, ExternalLink, PlayCircle, Plus, Trash2, Upload } from "lucide-react";
import { useLocation } from "react-router";
import TeacherLayout from "../layouts/TeacherLayout";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import { fetchTeacherProfile, updateTeacherProfile } from "../../services/teacherPortalService";
import {
  getAuthUser,
  readLocalStorage,
  removeLocalStorage,
  saveAuthUser,
  writeLocalStorage,
} from "../../services/portal";
import { getApiBase } from "../../services/http";
import ProfileImageCropModal from "../components/profile/ProfileImageCropModal";
import {
  getTeacherPageCacheKey,
  readTeacherPageCache,
  writeTeacherPageCache,
} from "../utils/teacherPageCache";
import usePersistentFormDraft, {
  clearTeacherFormDraft,
  mergeTeacherFormDraft,
} from "../hooks/usePersistentFormDraft";

const AVATAR_RAW_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const CV_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const CERTIFICATE_MAX_SIZE_BYTES = 1.5 * 1024 * 1024;
const CERTIFICATE_TOTAL_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const CERTIFICATE_MAX_COUNT = 5;
const SKILL_RATING_MAX_COUNT = 20;
const TEACHING_LANGUAGE_MAX_COUNT = 20;
const TEACHING_LANGUAGE_MIN_CHARS = 2;
const TEACHING_LANGUAGE_MAX_CHARS = 60;
const COURSE_INTRO_VIDEO_MAX_COUNT = 8;
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const PHONE_REGEX = /^\+?[0-9]{8,15}$/;
const PROFILE_RESET_DRAFT_KEY = "edutech_teacher_profile_reset_form";
const PROFILE_FORM_DRAFT_ID = "profile";
const PROFILE_CACHE_KEY = getTeacherPageCacheKey("profile");
const FIELD_MAX_LENGTHS = {
  name: 120,
  email: 120,
  phone: 20,
  professionalTitle: 120,
  expertiseAreas: 500,
  portfolioUrl: 250,
  introVideoUrl: 250,
  bio: 1200,
  motivation: 1500,
  linkedin: 250,
  youtube: 250,
  instagram: 250,
  facebook: 250,
  whatsapp: 250,
  github: 250,
};

const COUNTRY_CITY_OPTIONS = {
  افغانستان: [
    "بدخشان",
    "بادغیس",
    "بغلان",
    "بلخ",
    "بامیان",
    "دایکندی",
    "فراه",
    "فاریاب",
    "غزنی",
    "غور",
    "هلمند",
    "هرات",
    "جوزجان",
    "کابل",
    "قندهار",
    "کاپیسا",
    "خوست",
    "کنر",
    "کندز",
    "لغمان",
    "لوگر",
    "ننگرهار",
    "نیمروز",
    "نورستان",
    "پکتیا",
    "پکتیکا",
    "پنجشیر",
    "پروان",
    "سمنگان",
    "سرپل",
    "تخار",
    "ارزگان",
    "میدان وردک",
    "زابل",
  ],
  ایران: [
    "آذربایجان شرقی",
    "آذربایجان غربی",
    "اردبیل",
    "اصفهان",
    "البرز",
    "ایلام",
    "بوشهر",
    "تهران",
    "چهارمحال و بختیاری",
    "خراسان جنوبی",
    "خراسان رضوی",
    "خراسان شمالی",
    "خوزستان",
    "زنجان",
    "سمنان",
    "سیستان و بلوچستان",
    "فارس",
    "قزوین",
    "قم",
    "کردستان",
    "کرمان",
    "کرمانشاه",
    "کهگیلویه و بویراحمد",
    "گلستان",
    "گیلان",
    "لرستان",
    "مازندران",
    "مرکزی",
    "هرمزگان",
    "همدان",
    "یزد",
  ],
  پاکستان: [
    "پنجاب",
    "سند",
    "خیبر پختونخوا",
    "بلوچستان",
    "اسلام‌آباد (منطقه پایتخت)",
    "گلگت-بلتستان",
    "کشمیر آزاد",
  ],
  هند: [
    "آندرا پرادش",
    "آروناچال پرادش",
    "آسام",
    "بیهار",
    "چتیسگر",
    "گوا",
    "گجرات",
    "هاریانا",
    "هیماچال پرادش",
    "جارکند",
    "کارناتاکا",
    "کرالا",
    "مادیا پرادش",
    "مهاراشترا",
    "مانیپور",
    "مگالایا",
    "میزورام",
    "ناگالند",
    "اودیشا",
    "پنجاب",
    "راجستان",
    "سیکیم",
    "تامیل نادو",
    "تلانگانا",
    "تریپورا",
    "اوتار پرادش",
    "اوتاراکند",
    "بنگال غربی",
    "جزایر آندامان و نیکوبار",
    "چاندیگار",
    "دادرا و ناگار هاویلی و دامان و دیو",
    "دهلی",
    "جامو و کشمیر",
    "لاداخ",
    "لاکشادویپ",
    "پودوچری",
  ],
  ترکیه: [
    "آدانا",
    "آدیامان",
    "آفیون‌قره‌حصار",
    "آغری",
    "آماسیا",
    "آنکارا",
    "آنتالیا",
    "آرتوین",
    "آیدین",
    "بالیکسیر",
    "بیله‌جیک",
    "بینگول",
    "بیتلیس",
    "بولو",
    "بوردور",
    "بورسا",
    "چاناک‌قلعه",
    "چانکری",
    "چوروم",
    "دنیزلی",
    "دیاربکر",
    "ادرنه",
    "الازیغ",
    "ارزنجان",
    "ارزروم",
    "اسکی‌شهیر",
    "غازی‌آنتپ",
    "گیرسون",
    "گوموش‌خانه",
    "حکاری",
    "هاتای",
    "اسپارتا",
    "مرسین",
    "استانبول",
    "ازمیر",
    "قارص",
    "کاستامونو",
    "قیصری",
    "قرقلرایلی",
    "قرشهیر",
    "کوجائلی",
    "قونیه",
    "کوتاهیه",
    "مالاتیا",
    "مانیسا",
    "قهرمان‌مرعش",
    "ماردین",
    "موغلا",
    "موش",
    "نوشهیر",
    "نیغده",
    "اردو",
    "ریزه",
    "سقاریا",
    "سامسون",
    "سیرت",
    "سینوپ",
    "سیواس",
    "تکیرداغ",
    "توقات",
    "ترابزون",
    "تونجلی",
    "شانلی‌اورفه",
    "اوشاک",
    "وان",
    "یوزگات",
    "زونگولداغ",
    "آکسارای",
    "بایبورت",
    "کارامان",
    "قرق‌قلعه",
    "باتمان",
    "شرناک",
    "بارتین",
    "اردهان",
    "ایغدیر",
    "یالووا",
    "کارابوک",
    "کیلیس",
    "عثمانیه",
    "دوزجه",
  ],
  امارات: [
    "ابوظبی",
    "دبی",
    "شارجه",
    "عجمان",
    "ام‌القوین",
    "راس‌الخیمه",
    "فجیره",
  ],
  عربستان: [
    "الریاض",
    "مکه مکرمه",
    "مدینه منوره",
    "القصیم",
    "الشرقیه",
    "عسیر",
    "تبوک",
    "حائل",
    "الحدود الشمالیه",
    "جازان",
    "نجران",
    "الباحه",
    "الجوف",
  ],
  قطر: [
    "الدوحه",
    "الریان",
    "الوکرة",
    "ام صلال",
    "الخور و الذخیره",
    "الشمال",
    "الظعاین",
    "الشحانیه",
  ],
  کویت: ["العاصمه", "حوالی", "الفروانیه", "الاحمدی", "الجهراء", "مبارک الکبیر"],
  عراق: [
    "بغداد",
    "بصره",
    "نینوا",
    "اربیل",
    "نجف",
    "الانبار",
    "کربلا",
    "کرکوک",
    "دیالی",
    "دهوک",
    "ذی‌قار",
    "صلاح‌الدین",
    "سلیمانیه",
    "واسط",
    "میسان",
    "مثنی",
    "قادسیه",
    "بابل",
    "حلبچه",
  ],
  ازبکستان: [
    "تاشکند",
    "سمرقند",
    "بخارا",
    "اندیجان",
    "فرغانه",
    "جرقورغان",
    "خوارزم",
    "جیزخ",
    "نمنگان",
    "نوایی",
    "قشقه‌دریا",
    "سرخان‌دریا",
    "سیردریا",
    "قره‌قالپاقستان",
  ],
  تاجیکستان: [
    "بدخشان کوهستانی",
    "ختلان",
    "سغد",
    "ناحیه‌های تابع مرکز",
    "دوشنبه",
  ],
  کانادا: [
    "آلبرتا",
    "بریتیش کلمبیا",
    "منیتوبا",
    "نیوبرانزویک",
    "نیوفاندلند و لابرادور",
    "نوا اسکوشیا",
    "انتاریو",
    "جزیره پرنس ادوارد",
    "کبک",
    "ساسکاچوان",
    "سرزمین‌های شمال غربی",
    "نوناووت",
    "یوکان",
  ],
  "ایالات متحده آمریکا": [
    "آلاباما",
    "آلاسکا",
    "آریزونا",
    "آرکانزاس",
    "کالیفرنیا",
    "کلرادو",
    "کنتیکت",
    "دلاور",
    "فلوریدا",
    "جورجیا",
    "هاوایی",
    "آیداهو",
    "ایلینوی",
    "ایندیانا",
    "آیووا",
    "کانزاس",
    "کنتاکی",
    "لوئیزیانا",
    "مین",
    "مریلند",
    "ماساچوست",
    "میشیگان",
    "مینه‌سوتا",
    "می‌سی‌سی‌پی",
    "میسوری",
    "مونتانا",
    "نبراسکا",
    "نوادا",
    "نیوهمپشایر",
    "نیوجرسی",
    "نیومکزیکو",
    "نیویورک",
    "کارولینای شمالی",
    "داکوتای شمالی",
    "اوهایو",
    "اوکلاهما",
    "اورگن",
    "پنسیلوانیا",
    "رود آیلند",
    "کارولینای جنوبی",
    "داکوتای جنوبی",
    "تنسی",
    "تگزاس",
    "یوتا",
    "ورمونت",
    "ویرجینیا",
    "واشنگتن",
    "ویرجینیای غربی",
    "ویسکانسین",
    "وایومینگ",
    "واشنگتن دی‌سی",
  ],
  بریتانیا: ["انگلستان", "اسکاتلند", "ولز", "ایرلند شمالی"],
  آلمان: [
    "بادن-وورتمبرگ",
    "بایرن",
    "برلین",
    "براندنبورگ",
    "برمن",
    "هامبورگ",
    "هسن",
    "نیدرزاکسن",
    "مکلنبورگ-فورپومرن",
    "نوردراین-وستفالن",
    "راینلاند-فالتس",
    "زارلاند",
    "زاکسن",
    "زاکسن-آنهالت",
    "اشلسویگ-هولشتاین",
    "تورینگن",
  ],
  استرالیا: [
    "نیو ساوت ولز",
    "ویکتوریا",
    "کوئینزلند",
    "استرالیای غربی",
    "استرالیای جنوبی",
    "تاسمانی",
    "قلمرو شمالی",
    "قلمرو پایتختی استرالیا",
  ],
};

const COUNTRY_LABELS_EN = {
  افغانستان: "Afghanistan",
  ایران: "Iran",
  پاکستان: "Pakistan",
  هند: "India",
  ترکیه: "Turkey",
  امارات: "United Arab Emirates",
  عربستان: "Saudi Arabia",
  قطر: "Qatar",
  کویت: "Kuwait",
  عراق: "Iraq",
  ازبکستان: "Uzbekistan",
  تاجیکستان: "Tajikistan",
  کانادا: "Canada",
  "ایالات متحده آمریکا": "United States",
  بریتانیا: "United Kingdom",
  آلمان: "Germany",
  استرالیا: "Australia",
};

const COUNTRY_CITY_OPTIONS_EN = {
  افغانستان: [
    "Badakhshan",
    "Badghis",
    "Baghlan",
    "Balkh",
    "Bamyan",
    "Daykundi",
    "Farah",
    "Faryab",
    "Ghazni",
    "Ghor",
    "Helmand",
    "Herat",
    "Jowzjan",
    "Kabul",
    "Kandahar",
    "Kapisa",
    "Khost",
    "Kunar",
    "Kunduz",
    "Laghman",
    "Logar",
    "Nangarhar",
    "Nimruz",
    "Nuristan",
    "Paktia",
    "Paktika",
    "Panjshir",
    "Parwan",
    "Samangan",
    "Sar-e Pol",
    "Takhar",
    "Urozgan",
    "Maidan Wardak",
    "Zabul",
  ],
  ایران: [
    "East Azerbaijan",
    "West Azerbaijan",
    "Ardabil",
    "Isfahan",
    "Alborz",
    "Ilam",
    "Bushehr",
    "Tehran",
    "Chaharmahal and Bakhtiari",
    "South Khorasan",
    "Razavi Khorasan",
    "North Khorasan",
    "Khuzestan",
    "Zanjan",
    "Semnan",
    "Sistan and Baluchestan",
    "Fars",
    "Qazvin",
    "Qom",
    "Kurdistan",
    "Kerman",
    "Kermanshah",
    "Kohgiluyeh and Boyer-Ahmad",
    "Golestan",
    "Gilan",
    "Lorestan",
    "Mazandaran",
    "Markazi",
    "Hormozgan",
    "Hamadan",
    "Yazd",
  ],
  پاکستان: [
    "Punjab",
    "Sindh",
    "Khyber Pakhtunkhwa",
    "Balochistan",
    "Islamabad Capital Territory",
    "Gilgit-Baltistan",
    "Azad Jammu and Kashmir",
  ],
  هند: [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
  ],
  ترکیه: [
    "Adana",
    "Adiyaman",
    "Afyonkarahisar",
    "Agri",
    "Amasya",
    "Ankara",
    "Antalya",
    "Artvin",
    "Aydin",
    "Balikesir",
    "Bilecik",
    "Bingol",
    "Bitlis",
    "Bolu",
    "Burdur",
    "Bursa",
    "Canakkale",
    "Cankiri",
    "Corum",
    "Denizli",
    "Diyarbakir",
    "Edirne",
    "Elazig",
    "Erzincan",
    "Erzurum",
    "Eskisehir",
    "Gaziantep",
    "Giresun",
    "Gumushane",
    "Hakkari",
    "Hatay",
    "Isparta",
    "Mersin",
    "Istanbul",
    "Izmir",
    "Kars",
    "Kastamonu",
    "Kayseri",
    "Kirklareli",
    "Kirsehir",
    "Kocaeli",
    "Konya",
    "Kutahya",
    "Malatya",
    "Manisa",
    "Kahramanmaras",
    "Mardin",
    "Mugla",
    "Mus",
    "Nevsehir",
    "Nigde",
    "Ordu",
    "Rize",
    "Sakarya",
    "Samsun",
    "Siirt",
    "Sinop",
    "Sivas",
    "Tekirdag",
    "Tokat",
    "Trabzon",
    "Tunceli",
    "Sanliurfa",
    "Usak",
    "Van",
    "Yozgat",
    "Zonguldak",
    "Aksaray",
    "Bayburt",
    "Karaman",
    "Kirikkale",
    "Batman",
    "Sirnak",
    "Bartin",
    "Ardahan",
    "Igdir",
    "Yalova",
    "Karabuk",
    "Kilis",
    "Osmaniye",
    "Duzce",
  ],
  امارات: [
    "Abu Dhabi",
    "Dubai",
    "Sharjah",
    "Ajman",
    "Umm Al Quwain",
    "Ras Al Khaimah",
    "Fujairah",
  ],
  عربستان: [
    "Riyadh",
    "Makkah",
    "Madinah",
    "Al-Qassim",
    "Eastern Province",
    "Asir",
    "Tabuk",
    "Hail",
    "Northern Borders",
    "Jazan",
    "Najran",
    "Al-Bahah",
    "Al-Jawf",
  ],
  قطر: [
    "Doha",
    "Al Rayyan",
    "Al Wakrah",
    "Umm Salal",
    "Al Khor and Al Thakhira",
    "Al Shamal",
    "Al Daayen",
    "Al Shahaniya",
  ],
  کویت: [
    "Al Asimah",
    "Hawalli",
    "Al Farwaniyah",
    "Al Ahmadi",
    "Al Jahra",
    "Mubarak Al-Kabeer",
  ],
  عراق: [
    "Baghdad",
    "Basra",
    "Nineveh",
    "Erbil",
    "Najaf",
    "Al Anbar",
    "Karbala",
    "Kirkuk",
    "Diyala",
    "Dohuk",
    "Dhi Qar",
    "Saladin",
    "Sulaymaniyah",
    "Wasit",
    "Maysan",
    "Muthanna",
    "Al-Qadisiyyah",
    "Babil",
    "Halabja",
  ],
  ازبکستان: [
    "Tashkent",
    "Samarkand",
    "Bukhara",
    "Andijan",
    "Fergana",
    "Jizzakh",
    "Khorezm",
    "Jizzakh",
    "Namangan",
    "Navoiy",
    "Qashqadaryo",
    "Surxondaryo",
    "Sirdaryo",
    "Karakalpakstan",
  ],
  تاجیکستان: [
    "Gorno-Badakhshan",
    "Khatlon",
    "Sughd",
    "Districts of Republican Subordination",
    "Dushanbe",
  ],
  کانادا: [
    "Alberta",
    "British Columbia",
    "Manitoba",
    "New Brunswick",
    "Newfoundland and Labrador",
    "Nova Scotia",
    "Ontario",
    "Prince Edward Island",
    "Quebec",
    "Saskatchewan",
    "Northwest Territories",
    "Nunavut",
    "Yukon",
  ],
  "ایالات متحده آمریکا": [
    "Alabama",
    "Alaska",
    "Arizona",
    "Arkansas",
    "California",
    "Colorado",
    "Connecticut",
    "Delaware",
    "Florida",
    "Georgia",
    "Hawaii",
    "Idaho",
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Kentucky",
    "Louisiana",
    "Maine",
    "Maryland",
    "Massachusetts",
    "Michigan",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Montana",
    "Nebraska",
    "Nevada",
    "New Hampshire",
    "New Jersey",
    "New Mexico",
    "New York",
    "North Carolina",
    "North Dakota",
    "Ohio",
    "Oklahoma",
    "Oregon",
    "Pennsylvania",
    "Rhode Island",
    "South Carolina",
    "South Dakota",
    "Tennessee",
    "Texas",
    "Utah",
    "Vermont",
    "Virginia",
    "Washington",
    "West Virginia",
    "Wisconsin",
    "Wyoming",
    "District of Columbia",
  ],
  بریتانیا: ["England", "Scotland", "Wales", "Northern Ireland"],
  آلمان: [
    "Baden-Wurttemberg",
    "Bavaria",
    "Berlin",
    "Brandenburg",
    "Bremen",
    "Hamburg",
    "Hesse",
    "Lower Saxony",
    "Mecklenburg-Vorpommern",
    "North Rhine-Westphalia",
    "Rhineland-Palatinate",
    "Saarland",
    "Saxony",
    "Saxony-Anhalt",
    "Schleswig-Holstein",
    "Thuringia",
  ],
  استرالیا: [
    "New South Wales",
    "Victoria",
    "Queensland",
    "Western Australia",
    "South Australia",
    "Tasmania",
    "Northern Territory",
    "Australian Capital Territory",
  ],
};

const COUNTRY_NAME_ALIASES = {
  Canada: "کانادا",
  "United States": "ایالات متحده آمریکا",
  "United Kingdom": "بریتانیا",
  Afghanistan: "افغانستان",
  Iran: "ایران",
  Pakistan: "پاکستان",
  India: "هند",
  Turkey: "ترکیه",
  Germany: "آلمان",
  Australia: "استرالیا",
  UAE: "امارات",
  "Saudi Arabia": "عربستان",
  "United Arab Emirates": "امارات",
  Qatar: "قطر",
  Kuwait: "کویت",
  Iraq: "عراق",
  Uzbekistan: "ازبکستان",
  Tajikistan: "تاجیکستان",
};

const COUNTRY_OPTIONS = Object.keys(COUNTRY_CITY_OPTIONS);
const COUNTRY_DIAL_CODES = {
  افغانستان: "+93",
  ایران: "+98",
  پاکستان: "+92",
  هند: "+91",
  ترکیه: "+90",
  امارات: "+971",
  عربستان: "+966",
  قطر: "+974",
  کویت: "+965",
  عراق: "+964",
  ازبکستان: "+998",
  تاجیکستان: "+992",
  کانادا: "+1",
  "ایالات متحده آمریکا": "+1",
  بریتانیا: "+44",
  آلمان: "+49",
  استرالیا: "+61",
};

const EDUCATION_OPTIONS_FA = [
  "دیپلم",
  "لیسانس",
  "ماستری",
  "دکترا",
  "سایر",
];

const EDUCATION_OPTIONS_EN = [
  "High School",
  "Bachelor",
  "Master",
  "PhD",
  "Other",
];

const TEACHING_LANGUAGE_OPTIONS = [
  { value: "English", labelFa: "English", labelEn: "English" },
  { value: "Persian", labelFa: "فارسی", labelEn: "Persian" },
  { value: "Pashto", labelFa: "پشتو", labelEn: "Pashto" },
  { value: "Arabic", labelFa: "عربی", labelEn: "Arabic" },
];

const normalizeTeachingLanguages = (rows = []) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((item) => String(item || "").trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (
        item.length < TEACHING_LANGUAGE_MIN_CHARS ||
        item.length > TEACHING_LANGUAGE_MAX_CHARS ||
        seen.has(key)
      ) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, TEACHING_LANGUAGE_MAX_COUNT);
};

const normalizeCountryName = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return COUNTRY_NAME_ALIASES[raw] || raw;
};

const getCountryLabel = (countryValue = "", language = "fa") => {
  if (language === "en") {
    return COUNTRY_LABELS_EN[countryValue] || countryValue;
  }
  return countryValue;
};

const getProvinceLabel = (countryValue = "", provinceValue = "", language = "fa") => {
  if (language !== "en") return provinceValue;
  const faList = COUNTRY_CITY_OPTIONS[countryValue] || [];
  const enList = COUNTRY_CITY_OPTIONS_EN[countryValue] || [];
  const idx = faList.indexOf(provinceValue);
  if (idx >= 0 && enList[idx]) return enList[idx];
  return provinceValue;
};

const getInitialForm = (user = {}) => ({
  name: String(user?.name || "").trim(),
  email: String(user?.email || "").trim(),
  phone: String(user?.phone || "").trim(),
  country: normalizeCountryName(user?.country),
  city: String(user?.city || "").trim(),
  bio: String(user?.bio || "").trim(),
  linkedin: String(user?.socialLinks?.linkedin || "").trim(),
  youtube: String(user?.socialLinks?.youtube || "").trim(),
  instagram: String(user?.socialLinks?.instagram || "").trim(),
  facebook: String(user?.socialLinks?.facebook || "").trim(),
  whatsapp: String(user?.socialLinks?.whatsapp || "").trim(),
  github: String(user?.socialLinks?.github || "").trim(),
  professionalTitle: String(user?.teacherApplication?.professionalTitle || "").trim(),
  yearsExperience: String(user?.teacherApplication?.yearsExperience ?? "").trim(),
  education: String(user?.teacherApplication?.education || "").trim(),
  expertiseAreas: Array.isArray(user?.teacherApplication?.expertiseAreas)
    ? user.teacherApplication.expertiseAreas.join(", ")
    : "",
  teachingLevels: Array.isArray(user?.teacherApplication?.teachingLevels)
    ? user.teacherApplication.teachingLevels
    : [],
  languages: normalizeTeachingLanguages(user?.teacherApplication?.languages || []),
  skillRatings: normalizeSkillRatings(user?.teacherApplication?.skillRatings || []),
  portfolioUrl: String(user?.teacherApplication?.portfolioUrl || "").trim(),
  introVideoUrl: String(user?.teacherApplication?.introVideoUrl || "").trim(),
  courseIntroVideoUrls: Array.isArray(user?.teacherApplication?.courseIntroVideoUrls)
    ? user.teacherApplication.courseIntroVideoUrls
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .slice(0, COURSE_INTRO_VIDEO_MAX_COUNT)
    : [],
  motivation: String(user?.teacherApplication?.motivation || "").trim(),
});

const getEmptyForm = (lockedEmail = "") => ({
  name: "",
  email: String(lockedEmail || "").trim(),
  phone: "",
  country: "",
  city: "",
  bio: "",
  linkedin: "",
  youtube: "",
  instagram: "",
  facebook: "",
  whatsapp: "",
  github: "",
  professionalTitle: "",
  yearsExperience: "",
  education: "",
  expertiseAreas: "",
  teachingLevels: [],
  languages: [],
  skillRatings: [],
  portfolioUrl: "",
  introVideoUrl: "",
  courseIntroVideoUrls: [],
  motivation: "",
});

const resolveAssetUrl = (rawPath = "") => {
  const value = String(rawPath || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  if (value.startsWith("/")) {
    const apiBase = getApiBase();
    const backendOrigin = apiBase.replace(/\/api\/v\d+$/i, "").replace(/\/+$/, "");
    return `${backendOrigin}${value}`;
  }
  return value;
};

const withCacheBust = (url) => {
  if (!url) return "";
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
};

const normalizeLocaleDigits = (value = "") =>
  String(value || "").replace(/[۰-۹٠-٩]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    return char;
  });

const normalizePhone = (value = "") => {
  const ascii = normalizeLocaleDigits(value);
  const cleaned = String(ascii).replace(/[\s\-()]/g, "");
  if (!cleaned) return "";
  const hasPlus = cleaned.startsWith("+");
  const digitsOnly = cleaned.replace(/[^\d]/g, "");
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
};
const getCountryDialCode = (country = "") => COUNTRY_DIAL_CODES[String(country || "").trim()] || "";
const stripLocalLeadingZeros = (value = "") => String(value || "").replace(/^0+/, "");
const stripKnownDialCode = (value = "") => {
  const normalized = normalizePhone(value);
  if (!normalized) return "";
  for (const code of Object.values(COUNTRY_DIAL_CODES)) {
    if (normalized.startsWith(code)) {
      return normalized.slice(code.length);
    }
  }
  return normalized.replace(/^\+/, "");
};
const normalizePhoneByCountry = (value = "", country = "") => {
  const normalized = normalizePhone(value);
  const dialCode = getCountryDialCode(country);
  if (!dialCode || !normalized.startsWith(dialCode)) return normalized;
  const local = stripLocalLeadingZeros(normalized.slice(dialCode.length));
  return `${dialCode}${local}`;
};

const splitCsv = (value = "") =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeSkillRatings = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((item) => ({
      name: String(item?.name || "").trim(),
      percentage: Number(item?.percentage || 0),
    }))
    .filter((item) => item.name && Number.isFinite(item.percentage))
    .map((item) => ({
      name: item.name,
      percentage: Math.max(0, Math.min(100, Math.round(item.percentage))),
    }))
    .slice(0, SKILL_RATING_MAX_COUNT);

const uniqueNonEmptyStrings = (rows = []) => [
  ...new Set(
    (Array.isArray(rows) ? rows : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean),
  ),
];

const normalizeYouTubeInput = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const extractedUrl = raw.match(/https?:\/\/[^\s]+/i)?.[0] || raw;
  const withoutTrailingPunctuation = extractedUrl.replace(/[),.;]+$/g, "");
  return /^[a-z][a-z\d+.-]*:\/\//i.test(withoutTrailingPunctuation)
    ? withoutTrailingPunctuation
    : `https://${withoutTrailingPunctuation.replace(/^\/+/, "")}`;
};

const getYouTubeVideoId = (value = "") => {
  try {
    const url = new URL(normalizeYouTubeInput(value));
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] || "";
      return YOUTUBE_VIDEO_ID_PATTERN.test(id) ? id : "";
    }
    if (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtube-nocookie.com" ||
      hostname.endsWith(".youtube-nocookie.com")
    ) {
      if (url.pathname.startsWith("/watch")) {
        const id = url.searchParams.get("v") || "";
        return YOUTUBE_VIDEO_ID_PATTERN.test(id) ? id : "";
      }
      if (
        url.pathname.startsWith("/shorts/") ||
        url.pathname.startsWith("/embed/") ||
        url.pathname.startsWith("/live/") ||
        url.pathname.startsWith("/v/")
      ) {
        const id = url.pathname.split("/").filter(Boolean)[1] || "";
        return YOUTUBE_VIDEO_ID_PATTERN.test(id) ? id : "";
      }
    }
    return "";
  } catch {
    return "";
  }
};

const getYouTubeVideoKey = (value = "") => {
  const id = getYouTubeVideoId(value);
  return id ? `youtube:${id}` : "";
};

const hasYouTubeLink = (value = "") => Boolean(getYouTubeVideoKey(value));

const normalizeYouTubeVideoUrl = (value = "") => {
  const id = getYouTubeVideoId(value);
  return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : "";
};

const PROFILE_TEXT_RULES = [
  { key: "name", min: 3, max: 120, required: true, fa: "نام کامل", en: "Full name" },
  { key: "professionalTitle", min: 3, max: 120, required: true, fa: "عنوان حرفه‌ای", en: "Professional title" },
  { key: "expertiseAreas", min: 3, max: 500, required: true, fa: "حوزه‌های تخصص", en: "Expertise areas" },
  { key: "portfolioUrl", min: 0, max: 250, required: false, fa: "پورتفولیو", en: "Portfolio URL" },
  { key: "introVideoUrl", min: 0, max: 250, required: false, fa: "ویدیوی معرفی", en: "Intro video URL" },
  { key: "bio", min: 0, max: 1200, required: false, fa: "درباره مدرس", en: "Teacher bio" },
  { key: "motivation", min: 30, max: 1500, required: true, fa: "انگیزه همکاری", en: "Motivation" },
  { key: "linkedin", min: 0, max: 250, required: false, fa: "لینکدین", en: "LinkedIn" },
  { key: "youtube", min: 0, max: 250, required: false, fa: "یوتیوب", en: "YouTube" },
  { key: "instagram", min: 0, max: 250, required: false, fa: "اینستاگرام", en: "Instagram" },
  { key: "facebook", min: 0, max: 250, required: false, fa: "فیسبوک", en: "Facebook" },
  { key: "whatsapp", min: 0, max: 250, required: false, fa: "واتساپ", en: "WhatsApp" },
  { key: "github", min: 0, max: 250, required: false, fa: "گیت‌هاب", en: "GitHub" },
];

const SOCIAL_PROFILE_FIELDS = [
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/username" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@channel" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/username" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/username" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "https://wa.me/93700000000" },
  { key: "github", label: "GitHub", placeholder: "https://github.com/username" },
];

const mapBackendFieldToUiKey = (rawPath = "") => {
  const path = String(rawPath || "").trim();
  if (!path) return "";
  if (path === "name") return "name";
  if (path === "email") return "email";
  if (path === "phone") return "phone";
  if (path === "country") return "country";
  if (path === "city") return "city";
  if (path === "bio") return "bio";
  if (path === "socialLinks.linkedin") return "linkedin";
  if (path === "socialLinks.youtube") return "youtube";
  if (path === "socialLinks.instagram") return "instagram";
  if (path === "socialLinks.facebook") return "facebook";
  if (path === "socialLinks.whatsapp") return "whatsapp";
  if (path === "socialLinks.github") return "github";
  if (path === "teacherApplication.professionalTitle") return "professionalTitle";
  if (path === "teacherApplication.yearsExperience") return "yearsExperience";
  if (path === "teacherApplication.education") return "education";
  if (path === "teacherApplication.expertiseAreas" || path.startsWith("teacherApplication.expertiseAreas")) return "expertiseAreas";
  if (path === "teacherApplication.languages" || path.startsWith("teacherApplication.languages")) return "languages";
  if (path === "teacherApplication.portfolioUrl") return "portfolioUrl";
  if (path === "teacherApplication.introVideoUrl") return "introVideoUrl";
  if (path.startsWith("teacherApplication.courseIntroVideoUrls")) return "courseIntroVideoUrls";
  if (path === "teacherApplication.motivation") return "motivation";
  if (path.startsWith("teacherApplication.skillRatings")) return "skillRatings";
  return "";
};

const getLocalizedValidationMessage = (path = "", backendMessage = "", isFa = false) => {
  const uiKey = mapBackendFieldToUiKey(path);
  if (!uiKey) return "";

  const msg = String(backendMessage || "").toLowerCase();
  const lengthMatch = String(backendMessage || "").match(/(\d+)/);
  const lengthValue = lengthMatch ? Number(lengthMatch[1]) : 0;

  const labels = {
    name: isFa ? "نام کامل" : "Full name",
    email: isFa ? "ایمیل" : "Email",
    phone: isFa ? "شماره موبایل" : "Phone",
    country: isFa ? "کشور" : "Country",
    city: isFa ? "ولایت" : "Province/State",
    bio: isFa ? "درباره مدرس" : "Teacher bio",
    linkedin: "LinkedIn",
    youtube: "YouTube",
    instagram: "Instagram",
    facebook: "Facebook",
    whatsapp: "WhatsApp",
    github: "GitHub",
    professionalTitle: isFa ? "عنوان حرفه‌ای" : "Professional title",
    yearsExperience: isFa ? "سال‌های تجربه" : "Years of experience",
    education: isFa ? "تحصیلات" : "Education",
    expertiseAreas: isFa ? "حوزه‌های تخصص" : "Expertise areas",
    languages: isFa ? "زبان‌های تدریس" : "Teaching languages",
    portfolioUrl: isFa ? "پورتفولیو" : "Portfolio URL",
    introVideoUrl: isFa ? "ویدیوی معرفی" : "Intro video URL",
    courseIntroVideoUrls: isFa ? "ویدیوهای معرفی کورس" : "Course introduction videos",
    motivation: isFa ? "انگیزه همکاری" : "Motivation",
    skillRatings: isFa ? "مهارت‌ها و تخصص‌ها" : "Skills & expertise",
  };

  const label = labels[uiKey] || (isFa ? "فیلد" : "Field");

  if (msg.includes("required") || msg.includes("not allowed to be empty")) {
    return isFa ? `${label} الزامی است.` : `${label} is required.`;
  }
  if (msg.includes("must be a valid email")) {
    return isFa ? "ایمیل معتبر نیست." : "Email is not valid.";
  }
  if (msg.includes("must be less than or equal to")) {
    return isFa
      ? `${label} باید حداکثر ${lengthValue || 0} کاراکتر باشد.`
      : `${label} must be at most ${lengthValue || 0} characters.`;
  }
  if (msg.includes("must be greater than or equal to")) {
    return isFa
      ? `${label} مقدار کافی ندارد.`
      : `${label} is below the minimum allowed value.`;
  }
  if (msg.includes("must be one of")) {
    return isFa
      ? `مقدار ${label} معتبر نیست.`
      : `${label} value is not valid.`;
  }
  return isFa ? "ورودی نامعتبر است." : "Invalid input.";
};

export default function TeacherProfile() {
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const location = useLocation();
  const isFa = language === "fa";

  const [teacher, setTeacher] = useState(
    getAuthUser() || { name: "Teacher", email: "teacher@edutech.study", role: "teacher" },
  );
  const authEmail = String(getAuthUser()?.email || "").trim();
  const cachedProfile = readTeacherPageCache(PROFILE_CACHE_KEY);
  const [profile, setProfile] = useState(cachedProfile || null);
  const [form, setForm] = useState(() => {
    if (readLocalStorage(PROFILE_RESET_DRAFT_KEY) === "1") {
      return getEmptyForm(authEmail);
    }
    return mergeTeacherFormDraft(
      PROFILE_FORM_DRAFT_ID,
      getInitialForm({ ...(teacher || {}), ...(cachedProfile || {}) }),
    );
  });
  const [loading, setLoading] = useState(!cachedProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [cvFile, setCvFile] = useState(null);
  const [cvLabel, setCvLabel] = useState("");
  const [certificateFiles, setCertificateFiles] = useState([]);
  const [certificateLabel, setCertificateLabel] = useState("");
  const [isEditingApprovedProfile, setIsEditingApprovedProfile] = useState(false);
  const [customLanguageInput, setCustomLanguageInput] = useState("");
  const statusRef = useRef("draft");
  usePersistentFormDraft({
    draftId: PROFILE_FORM_DRAFT_ID,
    value: form,
    setValue: setForm,
    restore: false,
  });
  const getInputBorderClass = (fieldKey, defaultBorder = "border-[#E2E8F0]", errorBorder = "border-rose-300 bg-rose-50") =>
    fieldErrors[fieldKey] ? errorBorder : `${defaultBorder} bg-white`;
  const getTextInputClass = (fieldKey) =>
    `w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#0B4FD8] ${getInputBorderClass(fieldKey)}`;
  const getTextareaClass = (fieldKey) =>
    `w-full resize-y rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#0B4FD8] ${getInputBorderClass(fieldKey)}`;
  const getSelectClass = (fieldKey, extra = "") =>
    `w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#0B4FD8] ${getInputBorderClass(fieldKey)} ${extra}`.trim();
  const getPanelClass = (fieldKey, base = "border-[#E2E8F0] bg-white") =>
    fieldErrors[fieldKey] ? "border border-rose-300 bg-rose-50" : `border ${base}`;

  useEffect(() => {
    if (!success) return undefined;
    const timerId = window.setTimeout(() => {
      setSuccess("");
    }, 5000);
    return () => window.clearTimeout(timerId);
  }, [success]);

  useEffect(() => {
    if (!avatarPreview.startsWith("blob:")) return undefined;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      const cached = readTeacherPageCache(PROFILE_CACHE_KEY);
      if (cached) {
        const merged = { ...(getAuthUser() || {}), ...(cached || {}) };
        const accountEmail = String(merged?.email || authEmail || "").trim();
        const shouldUseResetDraft = readLocalStorage(PROFILE_RESET_DRAFT_KEY) === "1";
        setProfile(cached);
        setForm(
          shouldUseResetDraft
            ? getEmptyForm(accountEmail)
            : mergeTeacherFormDraft(PROFILE_FORM_DRAFT_ID, getInitialForm(merged)),
        );
        setAvatarPreview(shouldUseResetDraft ? "" : resolveAssetUrl(merged.avatar || ""));
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        setError("");
        const data = await fetchTeacherProfile();
        if (!mounted) return;
        setProfile(data || null);
        writeTeacherPageCache(PROFILE_CACHE_KEY, data || null);
        const merged = { ...(getAuthUser() || {}), ...(data || {}) };
        const accountEmail = String(merged?.email || authEmail || "").trim();
        const shouldUseResetDraft = readLocalStorage(PROFILE_RESET_DRAFT_KEY) === "1";
        setForm(
          shouldUseResetDraft
            ? getEmptyForm(accountEmail)
            : mergeTeacherFormDraft(PROFILE_FORM_DRAFT_ID, getInitialForm(merged)),
        );
        setFieldErrors({});
        setAvatarPreview(shouldUseResetDraft ? "" : resolveAssetUrl(merged.avatar || ""));
        const cvUrl = resolveAssetUrl(merged?.teacherApplication?.cvUrl || "");
        setCvLabel(shouldUseResetDraft ? "" : (cvUrl ? (isFa ? "رزومه ثبت شده" : "Saved CV") : ""));
        const existingCertificates = Array.isArray(merged?.teacherApplication?.certifications)
          ? merged.teacherApplication.certifications
          : [];
        const legacyCertificate = String(merged?.teacherApplication?.certificatesFileUrl || "").trim();
        const allCertificates = uniqueNonEmptyStrings([
          legacyCertificate,
          ...existingCertificates,
        ]);
        setCertificateLabel(shouldUseResetDraft
          ? ""
          : (allCertificates.length
            ? isFa
              ? `${allCertificates.length} گواهینامه ثبت شده`
              : `${allCertificates.length} saved certificate(s)`
            : ""));
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Failed to load profile data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [authEmail, isFa]);

  const merged = useMemo(() => ({ ...(teacher || {}), ...(profile || {}) }), [profile, teacher]);
  const lockedEmail = String(merged?.email || authEmail || "").trim();
  const displayName =
    merged?.name || (isFa ? merged?.nameFa : merged?.nameEn) || "Teacher";
  const avatarInitial = (displayName.trim()[0] || "T").toUpperCase();
  const normalizedDisplayCountry = normalizeCountryName(merged?.country || "");
  const countryDisplay = normalizedDisplayCountry
    ? getCountryLabel(normalizedDisplayCountry, language)
    : "-";
  const cityDisplay = merged?.city
    ? getProvinceLabel(normalizedDisplayCountry, merged.city, language)
    : "-";
  const selectedDialCode = getCountryDialCode(form.country);
  const phoneLocalValue = selectedDialCode
    ? (normalizePhone(form.phone).startsWith(selectedDialCode)
      ? stripLocalLeadingZeros(normalizePhone(form.phone).slice(selectedDialCode.length))
      : stripLocalLeadingZeros(stripKnownDialCode(form.phone)))
    : normalizePhone(form.phone);

  const serverStatus = String(profile?.teacherApplication?.status || "").trim();
  const localStatus = String(teacher?.teacherApplication?.status || "draft").trim();
  const applicationStatus = serverStatus || (loading ? localStatus : "draft");
  const isApproved = applicationStatus === "approved";
  const isSubmitted = applicationStatus === "submitted";
  const isRejected = applicationStatus === "rejected";
  const isUnderReview = !isApproved && isSubmitted;
  const requiresApproval = Boolean(location?.state?.approvalRequired);
  const isApprovalGateError = /not approved by admin/i.test(String(error || ""));
  const existingCvUrl = resolveAssetUrl(merged?.teacherApplication?.cvUrl || "");
  const existingCertificateUrls = useMemo(() => {
    const rows = Array.isArray(merged?.teacherApplication?.certifications)
      ? merged.teacherApplication.certifications
      : [];
    const legacyCertificate = String(merged?.teacherApplication?.certificatesFileUrl || "").trim();
    return uniqueNonEmptyStrings([legacyCertificate, ...rows]).filter((item) =>
      /\/uploads\/teacher-certificates\/|\.pdf(?:$|[?#])/i.test(item),
    );
  }, [merged]);
  const approvedPhone = normalizePhoneByCountry(
    merged?.phone || "",
    normalizeCountryName(merged?.country || ""),
  );
  const approvedApplication = merged?.teacherApplication || {};
  const showEditForm = !isApproved || isEditingApprovedProfile;
  const introVideoId = getYouTubeVideoId(form.introVideoUrl);
  const normalizedIntroVideoUrl = normalizeYouTubeVideoUrl(form.introVideoUrl);
  const introVideoEmbedUrl = introVideoId
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(introVideoId)}`
    : "";

  useEffect(() => {
    statusRef.current = applicationStatus;
  }, [applicationStatus]);

  useEffect(() => {
    let mounted = true;

    const syncApprovalStatus = async () => {
      try {
        const data = await fetchTeacherProfile();
        if (!mounted || !data) return;

        const nextStatus = String(data?.teacherApplication?.status || "draft").trim();
        const prevStatus = String(statusRef.current || "draft").trim();

        let nextTeacherSnapshot = null;
        setProfile(data);
        writeTeacherPageCache(PROFILE_CACHE_KEY, data);
        setTeacher((prev) => {
          const nextTeacher = { ...(prev || {}), ...data };
          nextTeacherSnapshot = nextTeacher;
          saveAuthUser(nextTeacher);
          return nextTeacher;
        });
        if (nextStatus !== prevStatus && (nextStatus === "rejected" || nextStatus === "draft")) {
          const shouldUseResetDraft = readLocalStorage(PROFILE_RESET_DRAFT_KEY) === "1";
          const accountEmail = String((nextTeacherSnapshot || data)?.email || authEmail || "").trim();
          setForm(
            shouldUseResetDraft
              ? getEmptyForm(accountEmail)
              : mergeTeacherFormDraft(
                  PROFILE_FORM_DRAFT_ID,
                  getInitialForm(nextTeacherSnapshot || data),
                ),
          );
        }

        setError((prev) => {
          if (/not approved by admin/i.test(String(prev || ""))) return "";
          return prev;
        });
      } catch {
        // Keep current UI state if periodic sync fails.
      }
    };

    window.addEventListener("teacher_auth_change", syncApprovalStatus);
    window.addEventListener("edutech_data_changed", syncApprovalStatus);
    const approvalPollTimer =
      applicationStatus === "submitted"
        ? window.setInterval(syncApprovalStatus, 30_000)
        : null;

    return () => {
      mounted = false;
      if (approvalPollTimer) window.clearInterval(approvalPollTimer);
      window.removeEventListener("teacher_auth_change", syncApprovalStatus);
      window.removeEventListener("edutech_data_changed", syncApprovalStatus);
    };
  }, [applicationStatus, authEmail]);

  const statusBadge =
    applicationStatus === "approved"
      ? { label: isFa ? "تایید شده" : "Approved", cls: "bg-emerald-100 text-emerald-700" }
      : applicationStatus === "submitted"
        ? { label: isFa ? "در انتظار بررسی" : "Pending Review", cls: "bg-amber-100 text-amber-700" }
        : applicationStatus === "rejected"
          ? { label: isFa ? "رد شده" : "Rejected", cls: "bg-rose-100 text-rose-700" }
          : { label: isFa ? "پیش‌نویس" : "Draft", cls: "bg-slate-100 text-slate-700" };

  const setSingleFieldError = (key, message) => {
    setFieldErrors((prev) => ({ ...prev, [key]: message }));
  };

  const clearFieldError = (key) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleFieldChange = (key, value) => {
    clearFieldError(key);
    const maxLength = FIELD_MAX_LENGTHS[key];
    const normalizedValue =
      typeof value === "string" && typeof maxLength === "number"
        ? value.slice(0, maxLength)
        : value;
    setForm((prev) => ({ ...prev, [key]: normalizedValue }));
  };

  const addCourseIntroVideo = () => {
    clearFieldError("courseIntroVideoUrls");
    setForm((prev) => {
      const rows = Array.isArray(prev.courseIntroVideoUrls) ? prev.courseIntroVideoUrls : [];
      if (rows.length >= COURSE_INTRO_VIDEO_MAX_COUNT) return prev;
      return { ...prev, courseIntroVideoUrls: [...rows, ""] };
    });
  };

  const updateCourseIntroVideo = (index, value) => {
    clearFieldError("courseIntroVideoUrls");
    setForm((prev) => {
      const rows = Array.isArray(prev.courseIntroVideoUrls)
        ? [...prev.courseIntroVideoUrls]
        : [];
      if (index < 0 || index >= rows.length) return prev;
      rows[index] = String(value || "").slice(0, 250);
      return { ...prev, courseIntroVideoUrls: rows };
    });
  };

  const removeCourseIntroVideo = (index) => {
    clearFieldError("courseIntroVideoUrls");
    setForm((prev) => ({
      ...prev,
      courseIntroVideoUrls: (Array.isArray(prev.courseIntroVideoUrls)
        ? prev.courseIntroVideoUrls
        : []
      ).filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const updateTeachingLanguages = (nextRows) => {
    handleFieldChange("languages", normalizeTeachingLanguages(nextRows));
  };

  const toggleTeachingLanguage = (value) => {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) return;
    const current = Array.isArray(form.languages) ? form.languages : [];
    const selected = current.some(
      (item) => item.toLowerCase() === normalizedValue.toLowerCase(),
    );
    updateTeachingLanguages(
      selected
        ? current.filter((item) => item.toLowerCase() !== normalizedValue.toLowerCase())
        : [...current, normalizedValue],
    );
  };

  const addCustomTeachingLanguage = () => {
    const nextLanguage = String(customLanguageInput || "").trim();
    if (
      nextLanguage.length < TEACHING_LANGUAGE_MIN_CHARS ||
      nextLanguage.length > TEACHING_LANGUAGE_MAX_CHARS
    ) {
      setSingleFieldError(
        "languages",
        isFa
          ? `نام زبان باید بین ${TEACHING_LANGUAGE_MIN_CHARS} تا ${TEACHING_LANGUAGE_MAX_CHARS} کاراکتر باشد.`
          : `Language name must be ${TEACHING_LANGUAGE_MIN_CHARS}-${TEACHING_LANGUAGE_MAX_CHARS} characters.`,
      );
      return;
    }

    const current = Array.isArray(form.languages) ? form.languages : [];
    if (current.length >= TEACHING_LANGUAGE_MAX_COUNT) {
      setSingleFieldError(
        "languages",
        isFa
          ? `حداکثر ${TEACHING_LANGUAGE_MAX_COUNT} زبان تدریس مجاز است.`
          : `You can add up to ${TEACHING_LANGUAGE_MAX_COUNT} teaching languages.`,
      );
      return;
    }

    updateTeachingLanguages([...current, nextLanguage]);
    setCustomLanguageInput("");
    clearFieldError("languages");
  };

  const addSkillRating = () => {
    setForm((prev) => {
      const rows = Array.isArray(prev.skillRatings) ? prev.skillRatings : [];
      if (rows.length >= SKILL_RATING_MAX_COUNT) return prev;
      return {
        ...prev,
        skillRatings: [...rows, { name: "", percentage: 50 }],
      };
    });
  };

  const updateSkillRating = (index, key, value) => {
    setForm((prev) => {
      const rows = Array.isArray(prev.skillRatings) ? [...prev.skillRatings] : [];
      if (!rows[index]) return prev;
      const nextValue =
        key === "percentage"
          ? Math.max(0, Math.min(100, Number(value || 0)))
          : String(value || "").slice(0, 80);
      rows[index] = {
        ...rows[index],
        [key]: nextValue,
      };
      return { ...prev, skillRatings: rows };
    });
  };

  const removeSkillRating = (index) => {
    setForm((prev) => {
      const rows = Array.isArray(prev.skillRatings) ? prev.skillRatings : [];
      return {
        ...prev,
        skillRatings: rows.filter((_, idx) => idx !== index),
      };
    });
  };

  const confirmSkillRating = (index) => {
    const rows = Array.isArray(form.skillRatings) ? form.skillRatings : [];
    const row = rows[index];
    if (!row) return;

    const normalizedName = String(row.name || "").trim();
    const normalizedPercentage = Math.max(
      0,
      Math.min(100, Math.round(Number(row.percentage || 0))),
    );

    if (!normalizedName) {
      setSingleFieldError(
        "skillRatings",
        isFa
          ? "لطفاً نام مهارت را وارد کنید."
          : "Please enter a skill name.",
      );
      return;
    }

    clearFieldError("skillRatings");
    setForm((prev) => {
      const nextRows = Array.isArray(prev.skillRatings) ? [...prev.skillRatings] : [];
      if (!nextRows[index]) return prev;
      nextRows[index] = {
        name: normalizedName,
        percentage: normalizedPercentage,
      };
      const hasBlankRow = nextRows.some((item, idx) => {
        if (idx === index) return false;
        return !String(item?.name || "").trim();
      });

      let focusIndex = index;
      if (!hasBlankRow && nextRows.length < SKILL_RATING_MAX_COUNT) {
        nextRows.push({ name: "", percentage: 50 });
        focusIndex = nextRows.length - 1;
      }

      requestAnimationFrame(() => {
        const nextInput = document.querySelector(`[data-skill-name="${focusIndex}"]`);
        if (nextInput instanceof HTMLElement) {
          nextInput.focus();
        }
      });

      return {
        ...prev,
        skillRatings: nextRows,
      };
    });
  };

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!AVATAR_MIME_TYPES.has(file.type)) {
      setSingleFieldError("avatarFile", isFa ? "فقط تصویر PNG، JPG یا WEBP مجاز است." : "Only PNG, JPG, or WEBP images are allowed.");
      event.target.value = "";
      return;
    }
    if (file.size > AVATAR_RAW_MAX_SIZE_BYTES) {
      setSingleFieldError("avatarFile", isFa ? "حجم تصویر اصلی باید کمتر از ۱۰ مگابایت باشد." : "The source image must be under 10 MB.");
      event.target.value = "";
      return;
    }
    clearFieldError("avatarFile");
    setPendingAvatarFile(file);
    event.target.value = "";
  };

  const handleCvSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setSingleFieldError("cvFile", isFa ? "فایل رزومه باید PDF باشد." : "CV file must be PDF.");
      return;
    }
    if (file.size > CV_MAX_SIZE_BYTES) {
      setSingleFieldError("cvFile", isFa ? "حجم رزومه باید کمتر از 2MB باشد." : "CV file must be less than 2MB.");
      return;
    }
    clearFieldError("cvFile");
    setCvFile(file);
    setCvLabel(file.name);
  };

  const handleCertificateSelect = (event) => {
    const incomingFiles = Array.from(event.target.files || []);
    if (!incomingFiles.length) return;

    for (const file of incomingFiles) {
      if (file.type !== "application/pdf") {
        setSingleFieldError("certificateFiles", isFa ? "تمام گواهینامه‌ها باید PDF باشند." : "All certificates must be PDF files.");
        event.target.value = "";
        return;
      }
      if (file.size > CERTIFICATE_MAX_SIZE_BYTES) {
        setSingleFieldError(
          "certificateFiles",
          isFa
            ? "حجم هر گواهینامه باید حداکثر ۱.۵ مگابایت باشد."
            : "Each certificate must be 1.5 MB or less.",
        );
        event.target.value = "";
        return;
      }
    }

    const makeFileKey = (file) => `${String(file?.name || "").trim().toLowerCase()}::${Number(file?.size || 0)}`;
    const existingSelected = Array.isArray(certificateFiles) ? certificateFiles : [];
    const existingKeys = new Set(existingSelected.map((file) => makeFileKey(file)));

    const uniqueIncoming = [];
    let hasDuplicate = false;

    for (const file of incomingFiles) {
      const key = makeFileKey(file);
      if (existingKeys.has(key)) {
        hasDuplicate = true;
        continue;
      }
      existingKeys.add(key);
      uniqueIncoming.push(file);
    }

    if (!uniqueIncoming.length) {
      setSingleFieldError(
        "certificateFiles",
        isFa
          ? "این فایل قبلاً انتخاب شده است."
          : "This PDF is already selected.",
      );
      event.target.value = "";
      return;
    }

    const existingSavedCount = existingCertificateUrls.length;
    const totalAfterAdd = existingSavedCount + existingSelected.length + uniqueIncoming.length;
    if (totalAfterAdd > CERTIFICATE_MAX_COUNT) {
      setSingleFieldError(
        "certificateFiles",
        isFa
          ? `حداکثر ${CERTIFICATE_MAX_COUNT} فایل گواهینامه مجاز است.`
          : `You can upload up to ${CERTIFICATE_MAX_COUNT} certificate files.`,
      );
      event.target.value = "";
      return;
    }

    const nextFiles = [...existingSelected, ...uniqueIncoming];
    const selectedTotalBytes = nextFiles.reduce((total, file) => total + Number(file?.size || 0), 0);
    if (selectedTotalBytes > CERTIFICATE_TOTAL_MAX_SIZE_BYTES) {
      setSingleFieldError(
        "certificateFiles",
        isFa
          ? "مجموع گواهینامه‌های جدید نباید بیشتر از ۵ مگابایت باشد."
          : "New certificate files must not exceed 5 MB in total.",
      );
      event.target.value = "";
      return;
    }
    setCertificateFiles(nextFiles);
    setSingleFieldError(
      "certificateFiles",
      hasDuplicate
        ? isFa
          ? "برخی فایل‌های تکراری اضافه نشدند."
          : "Duplicate files were skipped."
        : "",
    );
    if (!hasDuplicate) clearFieldError("certificateFiles");
    setCertificateLabel(
      isFa ? `${nextFiles.length} فایل انتخاب شد` : `${nextFiles.length} file(s) selected`,
    );
    event.target.value = "";
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;
    const submitAction = isApproved ? "save_draft" : "submit_for_review";

    setError("");
    setFieldErrors({});
    setSuccess("");

    const normalizedPhone = normalizePhoneByCountry(form.phone, form.country);
    const normalizedSkillRatings = normalizeSkillRatings(form.skillRatings || []);
    const normalizedTeachingLanguages = normalizeTeachingLanguages(form.languages || []);
    const nextFieldErrors = {};

    if (!String(form.name || "").trim()) nextFieldErrors.name = isFa ? "نام کامل الزامی است." : "Full name is required.";
    if (!String(lockedEmail || "").trim()) nextFieldErrors.email = isFa ? "ایمیل الزامی است." : "Email is required.";
    if (!String(form.professionalTitle || "").trim()) nextFieldErrors.professionalTitle = isFa ? "عنوان حرفه‌ای الزامی است." : "Professional title is required.";
    if (Number(form.yearsExperience || 0) <= 0) nextFieldErrors.yearsExperience = isFa ? "سال‌های تجربه الزامی است." : "Years of experience is required.";
    if (!String(form.education || "").trim()) nextFieldErrors.education = isFa ? "تحصیلات الزامی است." : "Education is required.";
    if (splitCsv(form.expertiseAreas).length === 0) nextFieldErrors.expertiseAreas = isFa ? "حوزه‌های تخصص الزامی است." : "Expertise areas are required.";
    if (normalizedTeachingLanguages.length === 0) nextFieldErrors.languages = isFa ? "حداقل یک زبان تدریس را انتخاب کنید." : "Select at least one teaching language.";
    if (!String(form.country || "").trim()) nextFieldErrors.country = isFa ? "کشور الزامی است." : "Country is required.";
    if (!String(form.city || "").trim()) nextFieldErrors.city = isFa ? "ولایت الزامی است." : "Province/State is required.";
    if (!String(form.bio || "").trim()) nextFieldErrors.bio = isFa ? "درباره مدرس الزامی است." : "Teacher bio is required.";
    if (!isApproved && !String(form.motivation || "").trim()) {
      nextFieldErrors.motivation = isFa ? "انگیزه همکاری الزامی است." : "Motivation is required.";
    }
    if (!isApproved && !(cvFile || existingCvUrl)) {
      nextFieldErrors.cvFile = isFa ? "رزومه الزامی است." : "CV file is required.";
    }

    if (!normalizedPhone) {
      nextFieldErrors.phone = isFa ? "شماره موبایل الزامی است." : "Phone is required.";
    } else if (selectedDialCode && normalizedPhone === selectedDialCode) {
      nextFieldErrors.phone = isFa
        ? "بعد از کد کشور، شماره موبایل را وارد کنید."
        : "Enter phone number after the country code.";
    } else if (!PHONE_REGEX.test(normalizedPhone)) {
      nextFieldErrors.phone = isFa
        ? "شماره موبایل معتبر نیست. نمونه: +93701234567"
        : "Invalid phone number. Example: +93701234567";
    }

    for (const rule of PROFILE_TEXT_RULES) {
      if (isApproved && rule.key === "motivation") continue;
      const value = String(form[rule.key] || "").trim();
      if (!value && !rule.required) continue;
      if (rule.required && !value) {
        nextFieldErrors[rule.key] = isFa ? `${rule.fa} الزامی است.` : `${rule.en} is required.`;
        continue;
      }
      if (value.length < rule.min || value.length > rule.max) {
        nextFieldErrors[rule.key] = isFa
          ? `${rule.fa} باید بین ${rule.min} تا ${rule.max} کاراکتر باشد.`
          : `${rule.en} must be between ${rule.min} and ${rule.max} characters.`;
      }
    }

    if (form.introVideoUrl.trim() && !normalizedIntroVideoUrl) {
      nextFieldErrors.introVideoUrl = isFa
        ? "لینک ویدیوی معرفی باید از YouTube باشد."
        : "Intro video must be a YouTube link.";
    }

    const rawCourseIntroVideoUrls = (Array.isArray(form.courseIntroVideoUrls)
      ? form.courseIntroVideoUrls
      : []
    )
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const courseIntroVideoUrls = rawCourseIntroVideoUrls
      .map((value) => normalizeYouTubeVideoUrl(value))
      .filter(Boolean);
    const uniqueCourseIntroVideoKeys = new Set(
      rawCourseIntroVideoUrls.map((value) => getYouTubeVideoKey(value)),
    );
    if (rawCourseIntroVideoUrls.some((value) => !hasYouTubeLink(value))) {
      nextFieldErrors.courseIntroVideoUrls = isFa
        ? "همه لینک‌های معرفی کورس باید از YouTube باشند."
        : "All course introduction videos must be YouTube links.";
    } else if (uniqueCourseIntroVideoKeys.size !== rawCourseIntroVideoUrls.length) {
      nextFieldErrors.courseIntroVideoUrls = isFa
        ? "لینک تکراری را حذف کنید."
        : "Remove the duplicate video link.";
    } else if (rawCourseIntroVideoUrls.length > COURSE_INTRO_VIDEO_MAX_COUNT) {
      nextFieldErrors.courseIntroVideoUrls = isFa
        ? `حداکثر ${COURSE_INTRO_VIDEO_MAX_COUNT} ویدیو مجاز است.`
        : `You can add up to ${COURSE_INTRO_VIDEO_MAX_COUNT} videos.`;
    }

    if (normalizedSkillRatings.length === 0) {
      nextFieldErrors.skillRatings = isFa
        ? "حداقل یک مهارت ثبت کنید."
        : "Add at least one skill.";
    } else if (normalizedSkillRatings.length > SKILL_RATING_MAX_COUNT) {
      nextFieldErrors.skillRatings = isFa
        ? `حداکثر ${SKILL_RATING_MAX_COUNT} مهارت قابل ثبت است.`
        : `You can add up to ${SKILL_RATING_MAX_COUNT} skills.`;
    } else {
      for (const skill of normalizedSkillRatings) {
        if (skill.name.length < 2 || skill.name.length > 80) {
          nextFieldErrors.skillRatings = isFa
            ? "نام هر مهارت باید بین ۲ تا ۸۰ کاراکتر باشد."
            : "Each skill name must be between 2 and 80 characters.";
          break;
        }
        if (skill.percentage < 0 || skill.percentage > 100) {
          nextFieldErrors.skillRatings = isFa
            ? "درصد هر مهارت باید بین ۰ تا ۱۰۰ باشد."
            : "Each skill percentage must be between 0 and 100.";
          break;
        }
      }
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name,
        email: lockedEmail,
        phone: normalizedPhone,
        country: form.country,
        city: form.city,
        bio: form.bio,
        socialLinks: {
          linkedin: form.linkedin,
          youtube: form.youtube,
          instagram: form.instagram,
          facebook: form.facebook,
          whatsapp: form.whatsapp,
          github: form.github,
        },
        teacherApplication: {
          professionalTitle: form.professionalTitle,
          yearsExperience: Number(form.yearsExperience || 0),
          education: form.education,
          expertiseAreas: splitCsv(form.expertiseAreas),
          teachingLevels: form.teachingLevels,
          languages: normalizedTeachingLanguages,
          skillRatings: normalizedSkillRatings,
          portfolioUrl: form.portfolioUrl,
          introVideoUrl: normalizedIntroVideoUrl,
          courseIntroVideoUrls,
          motivation: form.motivation,
        },
        teacherApplicationAction: submitAction,
        avatarFile,
        cvFile,
        certificateFiles,
      };

      const response = await updateTeacherProfile(payload);
      const updatedUser = response?.user || {};
      removeLocalStorage(PROFILE_RESET_DRAFT_KEY);
      clearTeacherFormDraft(PROFILE_FORM_DRAFT_ID);
      const nextTeacher = { ...(teacher || {}), ...updatedUser };
      const nextProfile = { ...(profile || {}), ...updatedUser };
      setTeacher(nextTeacher);
      setProfile(nextProfile);
      setForm(getInitialForm(nextProfile));
      writeTeacherPageCache(PROFILE_CACHE_KEY, nextProfile);
      saveAuthUser(nextTeacher);
      window.dispatchEvent(new Event("teacher_auth_change"));
      window.dispatchEvent(new Event("edutech_data_changed"));

      const updatedAvatar = resolveAssetUrl(updatedUser.avatar || "");
      setAvatarPreview(updatedAvatar ? withCacheBust(updatedAvatar) : "");
      setAvatarFile(null);
      setPendingAvatarFile(null);
      setCvFile(null);
      setCertificateFiles([]);
      setFieldErrors({});
      const cvUrl = resolveAssetUrl(updatedUser?.teacherApplication?.cvUrl || "");
      setCvLabel(cvUrl ? (isFa ? "رزومه ثبت شده" : "Saved CV") : "");
      const nextCertificates = uniqueNonEmptyStrings([
        updatedUser?.teacherApplication?.certificatesFileUrl,
        ...(Array.isArray(updatedUser?.teacherApplication?.certifications)
          ? updatedUser.teacherApplication.certifications
          : []),
      ]);
      setCertificateLabel(
        nextCertificates.length
          ? isFa
            ? `${nextCertificates.length} گواهینامه ثبت شده`
            : `${nextCertificates.length} saved certificate(s)`
          : "",
      );

      setSuccess(
        submitAction === "submit_for_review"
          ? isFa
            ? "درخواست شما برای بررسی مدیر ارسال شد."
            : "Your application was submitted for admin review."
          : isFa
            ? "تغییرات پروفایل با موفقیت ذخیره شد."
            : "Profile changes saved successfully.",
      );
      if (isApproved) {
        setIsEditingApprovedProfile(false);
      }
    } catch (err) {
      const rawMessage = String(err?.message || "").trim();
      const duplicateEmailError =
        /another user already uses this email|email is already in use|this email is already in use/i.test(
          rawMessage,
        );
      if (duplicateEmailError) {
        setFieldErrors((prev) => ({
          ...prev,
          email: isFa
            ? "این ایمیل توسط کاربر دیگری استفاده شده است."
            : "Another user already uses this email.",
        }));
        setError("");
        return;
      }
      const pathMatch = rawMessage.match(/"([^"]+)"/);
      const backendPath = String(pathMatch?.[1] || "").trim();
      const uiKey = mapBackendFieldToUiKey(backendPath);

      if (uiKey) {
        setFieldErrors((prev) => ({
          ...prev,
          [uiKey]: getLocalizedValidationMessage(backendPath, rawMessage, isFa),
        }));
        setError("");
      } else {
        setError(rawMessage || (isFa ? "ذخیره ناموفق بود." : "Save failed."));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResetForm = () => {
    writeLocalStorage(PROFILE_RESET_DRAFT_KEY, "1");
    clearTeacherFormDraft(PROFILE_FORM_DRAFT_ID);
    setForm(getEmptyForm(lockedEmail));
    setFieldErrors({});
    setError("");
    setSuccess("");
    setAvatarFile(null);
    setCvFile(null);
    setCertificateFiles([]);
    setAvatarPreview("");
    setCvLabel("");
    setCertificateLabel("");
  };

  const handleCancelApprovedEdit = () => {
    clearTeacherFormDraft(PROFILE_FORM_DRAFT_ID);
    removeLocalStorage(PROFILE_RESET_DRAFT_KEY);
    setForm(getInitialForm(merged));
    setFieldErrors({});
    setError("");
    setSuccess("");
    setAvatarFile(null);
    setPendingAvatarFile(null);
    setCvFile(null);
    setCertificateFiles([]);
    setAvatarPreview(resolveAssetUrl(merged?.avatar || ""));
    setCvLabel(existingCvUrl ? (isFa ? "رزومه ثبت شده" : "Saved CV") : "");
    setCertificateLabel(
      existingCertificateUrls.length
        ? isFa
          ? `${existingCertificateUrls.length} گواهینامه ثبت شده`
          : `${existingCertificateUrls.length} saved certificate(s)`
        : "",
    );
    setIsEditingApprovedProfile(false);
  };

  const educationOptions = isFa ? EDUCATION_OPTIONS_FA : EDUCATION_OPTIONS_EN;
  const baseCityOptions = form.country ? COUNTRY_CITY_OPTIONS[form.country] || [] : [];
  const cityOptions =
    form.city && !baseCityOptions.includes(form.city)
      ? [form.city, ...baseCityOptions]
      : baseCityOptions;
  return (
    <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
      <section
        className={`mx-auto w-full max-w-[1280px] overflow-hidden rounded-3xl border border-[#E2E8F0] bg-slate-50 p-3 shadow-sm sm:p-5 lg:p-6 ${
          isRTL ? "text-right [&_input]:text-right [&_textarea]:text-right [&_select]:text-right" : "text-left"
        }`}
      >
        <div className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-[linear-gradient(135deg,#EFF6FF_0%,#FFFFFF_55%,#F0FDFA_100%)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-[#0F172A] sm:text-3xl">
              {isFa ? "پروفایل مدرس" : "Teacher Profile"}
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-600">
              {isApproved
                ? isFa
                  ? "پروفایل شما تایید شده است."
                  : "Your profile is approved."
                : isUnderReview
                  ? isFa
                    ? "درخواست شما ثبت شده و در حال بررسی مدیر است."
                    : "Your application is submitted and currently under admin review."
                : isFa
                  ? "فقط فرم درخواست همکاری را تکمیل و ارسال کنید."
                  : "Only complete and submit the teacher application form."}
            </p>
          </div>
          <span className={`inline-flex w-fit shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        </div>

        {error && !isApprovalGateError ? (
          <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {success}
          </div>
        ) : null}
        {requiresApproval && !isApproved && !isUnderReview ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            {isFa
              ? "پروفایل شما هنوز توسط مدیر تایید نشده است. برای استفاده از بخش‌های دیگر، لطفاً فرم پروفایل را کامل کرده و برای بررسی ارسال کنید."
              : "Your profile is not approved by admin yet. To use other teacher pages, please complete and submit your profile form for review."}
          </div>
        ) : null}
        {isUnderReview ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            <div className="flex items-center gap-2">
              <Clock3 size={16} />
              <span>
                {isFa
                  ? "درخواست شما زیر بررسی است. تا اعلام نتیجه می‌توانید اطلاعات ارسال‌شده را در همین صفحه مشاهده کنید."
                  : "Your application is under review. You can view your submitted information here until the result is announced."}
              </span>
            </div>
          </div>
        ) : null}
        {!isApproved ? (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
            {isFa
              ? "لطفاً فورم خود را به زبان انگلیسی و با اطلاعات دقیق تکمیل کنید. این اطلاعات با شاگردان شما به اشتراک گذاشته می‌شود."
              : "Please fill your form in English with accurate information. This data will be shared with your students."}
          </div>
        ) : null}

        {showEditForm ? (
          <form className="mt-5 space-y-5 sm:mt-6 sm:space-y-6" onSubmit={handleSave} noValidate>
            <fieldset disabled={isUnderReview} className="space-y-6 disabled:opacity-100">
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-sm sm:p-4 lg:p-5">
                <h2 className="mb-3 text-sm font-black text-[#0F172A]">
                  {isUnderReview
                    ? isFa
                      ? "بخش ۱: درخواست ارسال‌شده (در حال بررسی)"
                      : "Section 1: Submitted Application (Under Review)"
                    : isFa
                      ? "بخش ۱: فرم کامل درخواست همکاری"
                      : "Section 1: Complete Application Form"}
                </h2>
                <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm sm:h-36 sm:w-36">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-4xl font-black text-slate-600">
                        {avatarInitial}
                      </div>
                    )}
                  </div>
                  <label className="flex w-full max-w-[180px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                    <Upload size={14} />
                    {isFa ? "آپلود عکس" : "Upload Image"}
                    <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarSelect} />
                  </label>
                  {fieldErrors.avatarFile ? (
                    <p className="text-center text-xs font-semibold text-rose-600">{fieldErrors.avatarFile}</p>
                  ) : null}
                </div>

                <div className="grid w-full gap-4 md:grid-cols-2 md:items-start">
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">{isFa ? "نام کامل" : "Full Name"} *</span>
                    <input value={form.name} minLength={3} maxLength={120} onChange={(e) => handleFieldChange("name", e.target.value)} placeholder={isFa ? "احمد رحیمی" : "e.g. Ahmad Rahimi"} className={getTextInputClass("name")} />
                    {fieldErrors.name ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.name}</p> : null}
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">{isFa ? "ایمیل" : "Email"} *</span>
                    <input type="email" maxLength={120} value={lockedEmail} readOnly disabled className="w-full cursor-not-allowed rounded-xl border border-[#E2E8F0] bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-600 outline-none" dir="ltr" />
                    {fieldErrors.email ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.email}</p> : null}
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">{isFa ? "کشور" : "Country"} *</span>
                    <select
                      value={form.country}
                      onChange={(e) => {
                        const nextCountry = e.target.value;
                        const nextCityOptions = COUNTRY_CITY_OPTIONS[nextCountry] || [];
                        const nextDialCode = getCountryDialCode(nextCountry);
                        setForm((prev) => ({
                          ...prev,
                          phone: nextDialCode
                            ? `${nextDialCode}${stripLocalLeadingZeros(stripKnownDialCode(prev.phone))}`
                            : stripKnownDialCode(prev.phone),
                          country: nextCountry,
                          city: nextCityOptions.includes(prev.city) ? prev.city : "",
                        }));
                        clearFieldError("country");
                        clearFieldError("phone");
                      }}
                      className={getSelectClass("country")}
                    >
                      <option value="">{isFa ? "انتخاب کشور" : "Select country"}</option>
                      {COUNTRY_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {getCountryLabel(item, language)}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.country ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.country}</p> : null}
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">
                      {isFa ? "ولایت" : "Province / State"} *
                    </span>
                    <select
                      value={form.city}
                      onChange={(e) => handleFieldChange("city", e.target.value)}
                      className={getSelectClass("city", "disabled:bg-slate-100")}
                      disabled={!form.country || cityOptions.length === 0}
                    >
                      <option value="">
                        {isFa ? "انتخاب ولایت" : "Select province/state"}
                      </option>
                      {cityOptions.map((item) => (
                        <option key={item} value={item}>
                          {getProvinceLabel(form.country, item, language)}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.city ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.city}</p> : null}
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">{isFa ? "شماره موبایل" : "Phone"} *</span>
                    <div
                      className={`flex w-full overflow-hidden rounded-xl border focus-within:border-[#0B4FD8] ${
                        fieldErrors.phone ? "border-rose-300 bg-rose-50" : "border-[#E2E8F0] bg-white"
                      } ${
                        isRTL ? "flex-row-reverse" : ""
                      }`}
                    >
                      {selectedDialCode ? (
                        <span
                          className={`inline-flex items-center bg-slate-50 px-3 text-sm font-black text-slate-700 ${
                            isRTL ? "border-s border-[#E2E8F0]" : "border-e border-[#E2E8F0]"
                          }`}
                        >
                          {selectedDialCode}
                        </span>
                      ) : null}
                      <input
                        value={phoneLocalValue}
                        minLength={6}
                        maxLength={14}
                        onChange={(e) => {
                          const localDigits = String(e.target.value || "").replace(/[^\d]/g, "");
                          const localWithoutLeadingZero = stripLocalLeadingZeros(localDigits);
                          const nextPhone = selectedDialCode
                            ? `${selectedDialCode}${localWithoutLeadingZero}`
                            : localWithoutLeadingZero;
                          handleFieldChange("phone", nextPhone);
                        }}
                        className="w-full px-3 py-2.5 text-sm font-semibold outline-none"
                        dir="ltr"
                        placeholder={isFa ? "701234567" : "e.g. 701234567"}
                      />
                    </div>
                    {fieldErrors.phone ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.phone}</p> : null}
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">{isFa ? "تحصیلات" : "Education"} *</span>
                    <select value={form.education} onChange={(e) => handleFieldChange("education", e.target.value)} className={getSelectClass("education")}>
                      <option value="">{isFa ? "انتخاب تحصیلات" : "Select education"}</option>
                      {educationOptions.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                    {fieldErrors.education ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.education}</p> : null}
                  </label>
                  <div className="space-y-2 md:col-span-2">
                    <span className="text-xs font-bold text-slate-600">
                      {isFa ? "زبان‌های تدریس" : "Teaching languages"} *
                    </span>
                    <div className={`grid gap-2 rounded-xl p-1 ${fieldErrors.languages ? "border border-rose-300 bg-rose-50" : ""} sm:grid-cols-2 lg:grid-cols-4`}>
                      {TEACHING_LANGUAGE_OPTIONS.map((item) => {
                        const selected = Array.isArray(form.languages) && form.languages.some(
                          (value) => value.toLowerCase() === item.value.toLowerCase(),
                        );
                        return (
                          <label
                            key={item.value}
                            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-black transition ${
                              selected
                                ? "border-[#0B4FD8] bg-[#0B4FD8]/5 text-[#0B4FD8]"
                                : "border-[#E2E8F0] bg-white text-slate-700 hover:border-[#0B4FD8]/40"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleTeachingLanguage(item.value)}
                              className="h-4 w-4 accent-[#0B4FD8]"
                            />
                            <span>{isFa ? item.labelFa : item.labelEn}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={customLanguageInput}
                        maxLength={TEACHING_LANGUAGE_MAX_CHARS}
                        onChange={(e) => {
                          clearFieldError("languages");
                          setCustomLanguageInput(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomTeachingLanguage();
                          }
                        }}
                        placeholder={isFa ? "زبان دیگر، مثال: اردو، فرانسوی، چینی" : "Other language, e.g. Urdu, French, Chinese"}
                        className={getTextInputClass("languages")}
                      />
                      <button
                        type="button"
                        onClick={addCustomTeachingLanguage}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#0B4FD8]/25 bg-[#0B4FD8]/5 px-4 text-sm font-black text-[#0B4FD8] transition hover:bg-[#0B4FD8]/10"
                      >
                        {isFa ? "افزودن زبان" : "Add language"}
                      </button>
                    </div>
                    {Array.isArray(form.languages) && form.languages.length ? (
                      <div className="flex flex-wrap gap-2">
                        {form.languages.map((item) => (
                          <span
                            key={item}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700"
                          >
                            <span>{item}</span>
                            <button
                              type="button"
                              onClick={() => toggleTeachingLanguage(item)}
                              className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                              aria-label={isFa ? `حذف ${item}` : `Remove ${item}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {fieldErrors.languages ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.languages}</p> : null}
                  </div>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">{isFa ? "عنوان حرفه‌ای" : "Professional Title"} *</span>
                    <input value={form.professionalTitle} minLength={3} maxLength={120} onChange={(e) => handleFieldChange("professionalTitle", e.target.value)} placeholder={isFa ? "مدرس برنامه‌نویسی وب" : "e.g. Web Development Instructor"} className={getTextInputClass("professionalTitle")} />
                    {fieldErrors.professionalTitle ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.professionalTitle}</p> : null}
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">{isFa ? "سال‌های تجربه" : "Years Experience"} *</span>
                    <input type="number" min={1} max={60} value={form.yearsExperience} onChange={(e) => handleFieldChange("yearsExperience", e.target.value)} placeholder={isFa ? "3" : "e.g. 3"} className={getTextInputClass("yearsExperience")} />
                    {fieldErrors.yearsExperience ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.yearsExperience}</p> : null}
                  </label>
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-xs font-bold text-slate-600">{isFa ? "حوزه‌های تخصص (کاما)" : "Expertise Areas (comma)"} *</span>
                    <input value={form.expertiseAreas} minLength={3} maxLength={500} onChange={(e) => handleFieldChange("expertiseAreas", e.target.value)} placeholder={isFa ? "JavaScript, React, Node.js" : "e.g. JavaScript, React, Node.js"} className={getTextInputClass("expertiseAreas")} />
                    {fieldErrors.expertiseAreas ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.expertiseAreas}</p> : null}
                  </label>
                  <div className={`space-y-2 rounded-xl p-1 md:col-span-2 ${fieldErrors.skillRatings ? "border border-rose-300 bg-rose-50" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-600">
                        {isFa ? "مهارت‌ها و تخصص‌ها (درصد)" : "Skills & Expertise (percentage)"} *
                      </span>
                      <button
                        type="button"
                        onClick={addSkillRating}
                        disabled={(form.skillRatings || []).length >= SKILL_RATING_MAX_COUNT}
                        className="rounded-lg border border-[#0B4FD8] bg-white px-2.5 py-1 text-xs font-black text-[#0B4FD8] hover:bg-[#EFF6FF] disabled:opacity-50"
                      >
                        {isFa ? "افزودن مهارت" : "Add Skill"}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {Array.isArray(form.skillRatings) && form.skillRatings.length ? (
                        form.skillRatings.map((item, idx) => (
                          <div key={`skill-rating-${idx}`} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_130px_auto] md:items-center">
                              <input
                                data-skill-name={idx}
                                value={item.name}
                                maxLength={80}
                                onChange={(e) => updateSkillRating(idx, "name", e.target.value)}
                                placeholder={isFa ? "نام مهارت (React)" : "Skill name (e.g. React)"}
                                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#0B4FD8]"
                              />
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={Number(item.percentage || 0)}
                                  onChange={(e) => updateSkillRating(idx, "percentage", e.target.value)}
                                  className="w-full accent-[#0B4FD8]"
                                />
                                <span className="w-10 text-center text-xs font-black text-slate-700">
                                  {Math.max(0, Math.min(100, Number(item.percentage || 0)))}%
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => confirmSkillRating(idx)}
                                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                                >
                                  {isFa ? "تایید" : "OK"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeSkillRating(idx)}
                                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700 hover:bg-rose-100"
                                >
                                  {isFa ? "حذف" : "Remove"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-slate-500">
                          {isFa ? "هنوز مهارتی اضافه نشده است." : "No skills added yet."}
                        </p>
                      )}
                    </div>
                    {fieldErrors.skillRatings ? (
                      <p className="text-xs font-semibold text-rose-600">{fieldErrors.skillRatings}</p>
                    ) : null}
                  </div>
                  {!isApproved ? (
                    <>
                      <div className="space-y-1.5 md:col-span-2">
                        <span className="text-xs font-bold text-slate-600">
                          {isFa ? "گواهینامه‌ها (هر PDF حداکثر ۱.۵MB، مجموع ۵MB، حداکثر ۵ فایل)" : "Certificates (1.5 MB each, 5 MB total, up to 5 PDFs)"}
                        </span>
                        <label className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 ${getPanelClass("certificateFiles")}`}>
                          <span className="truncate">
                            {certificateLabel ||
                              (existingCertificateUrls.length
                                ? isFa
                                  ? `${existingCertificateUrls.length} گواهینامه ثبت شده`
                                  : `${existingCertificateUrls.length} saved certificate(s)`
                                : isFa
                                  ? "فایل‌های گواهینامه را انتخاب کنید"
                                  : "Choose certificate files")}
                          </span>
                          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black">
                            {isFa ? "انتخاب فایل" : "Choose file"}
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept="application/pdf"
                            multiple
                            onChange={handleCertificateSelect}
                          />
                        </label>
                        {fieldErrors.certificateFiles ? (
                          <p className="text-xs font-semibold text-rose-600">{fieldErrors.certificateFiles}</p>
                        ) : null}
                      </div>
                      <label className="space-y-1.5">
                        <span className="text-xs font-bold text-slate-600">{isFa ? "پورتفولیو (لینک)" : "Portfolio URL"}</span>
                        <input value={form.portfolioUrl} maxLength={250} onChange={(e) => handleFieldChange("portfolioUrl", e.target.value)} placeholder={isFa ? "https://portfolio.example.com (اختیاری)" : "e.g. https://portfolio.example.com (optional)"} className={getTextInputClass("portfolioUrl")} dir="ltr" />
                        {fieldErrors.portfolioUrl ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.portfolioUrl}</p> : null}
                      </label>
                      <div className="space-y-1.5 md:col-span-2">
                        <span className="text-xs font-bold text-slate-600">{isFa ? "رزومه (PDF کمتر از 2MB)" : "CV (PDF under 2MB)"} *</span>
                        <label className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 ${getPanelClass("cvFile")}`}>
                          <span className="truncate">{cvLabel || (isFa ? "فایل رزومه را انتخاب کنید" : "Choose CV file")}</span>
                          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black">{isFa ? "انتخاب فایل" : "Choose file"}</span>
                          <input type="file" className="hidden" accept="application/pdf" onChange={handleCvSelect} />
                        </label>
                        {fieldErrors.cvFile ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.cvFile}</p> : null}
                      </div>
                    </>
                  ) : null}
                  <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm md:col-span-2">
                    <div className="bg-gradient-to-r from-red-50 via-white to-blue-50 p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-600 text-white shadow-sm">
                          <PlayCircle size={22} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-950 sm:text-base">
                            {isFa ? "ویدیوی معرفی برای شاگردان" : "Teacher Intro Video For Students"}
                          </p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600 sm:text-sm sm:leading-6">
                            {isFa
                              ? "لینک ویدیوی YouTube را وارد کنید. لینک‌های معمولی، کوتاه، Shorts، Live و Embed پذیرفته می‌شوند."
                              : "Paste a YouTube video link. Standard, short, Shorts, Live, and Embed links are accepted."}
                          </p>
                        </div>
                      </div>

                      <label className="mt-4 block space-y-1.5">
                        <span className="text-xs font-bold text-slate-700">
                          {isFa ? "لینک YouTube ویدیوی معرفی" : "YouTube intro video link"}
                        </span>
                        <div
                          className={`flex min-w-0 items-center gap-2 rounded-xl border bg-white px-3 transition focus-within:ring-4 ${
                            fieldErrors.introVideoUrl || (form.introVideoUrl.trim() && !introVideoId)
                              ? "border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-50"
                              : introVideoId
                                ? "border-emerald-300 focus-within:border-emerald-400 focus-within:ring-emerald-50"
                                : "border-slate-200 focus-within:border-[#0B4FD8] focus-within:ring-blue-50"
                          }`}
                        >
                          <PlayCircle size={18} className="shrink-0 text-red-600" />
                          <input
                            type="url"
                            inputMode="url"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            value={form.introVideoUrl}
                            maxLength={250}
                            onChange={(e) => handleFieldChange("introVideoUrl", e.target.value)}
                            onBlur={() => {
                              if (normalizedIntroVideoUrl) {
                                handleFieldChange("introVideoUrl", normalizedIntroVideoUrl);
                              }
                            }}
                            placeholder="https://youtu.be/..."
                            className="h-11 min-w-0 flex-1 bg-transparent text-left text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                            dir="ltr"
                          />
                          {introVideoId ? (
                            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                          ) : null}
                        </div>
                      </label>

                      {fieldErrors.introVideoUrl ? (
                        <p className="mt-2 text-xs font-semibold text-rose-600">{fieldErrors.introVideoUrl}</p>
                      ) : form.introVideoUrl.trim() && !introVideoId ? (
                        <p className="mt-2 text-xs font-semibold text-rose-600">
                          {isFa
                            ? "این لینک ویدیوی YouTube شناخته نشد. لینک را مستقیماً از گزینه Share در YouTube کپی کنید."
                            : "This YouTube video link was not recognized. Copy it directly from YouTube’s Share option."}
                        </p>
                      ) : (
                        <p className="mt-2 text-[11px] font-semibold text-slate-500">
                          {isFa
                            ? "نمونه: youtube.com/watch، youtu.be، youtube.com/shorts یا youtube.com/live"
                            : "Examples: youtube.com/watch, youtu.be, youtube.com/shorts, or youtube.com/live"}
                        </p>
                      )}
                    </div>

                    {introVideoEmbedUrl ? (
                      <div className="border-t border-slate-100 p-3 sm:p-4">
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                          <iframe
                            src={`${introVideoEmbedUrl}?rel=0`}
                            title={isFa ? "پیش‌نمایش ویدیوی معرفی" : "Intro video preview"}
                            className="aspect-video w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        </div>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="inline-flex items-center gap-2 text-xs font-black text-emerald-700">
                            <CheckCircle2 size={15} />
                            {isFa ? "لینک معتبر است و برای شاگردان نمایش داده می‌شود." : "Valid link — students will be able to watch it."}
                          </p>
                          <a
                            href={normalizedIntroVideoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-black text-red-700 transition hover:bg-red-50"
                          >
                            <ExternalLink size={15} />
                            {isFa ? "باز کردن در YouTube" : "Open on YouTube"}
                          </a>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 md:col-span-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#0F172A]">
                          {isFa ? "ویدیوهای معرفی کورس در یوتیوب" : "Course Introduction Videos on YouTube"}
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                          {isFa
                            ? "ویدیوهای کوتاه معرفی کورس‌های خود را اضافه کنید تا شاگردان پیش از انتخاب کورس آن‌ها را ببینند."
                            : "Add short course introduction videos so learners can watch them before choosing a course."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addCourseIntroVideo}
                        disabled={(form.courseIntroVideoUrls?.length || 0) >= COURSE_INTRO_VIDEO_MAX_COUNT}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0B4FD8] px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus size={15} />
                        {isFa ? "افزودن لینک" : "Add link"}
                      </button>
                    </div>

                    {form.courseIntroVideoUrls?.length ? (
                      <div className="mt-4 space-y-3">
                        {form.courseIntroVideoUrls.map((videoUrl, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="flex h-10 w-8 shrink-0 items-center justify-center text-xs font-black text-slate-500">
                              {index + 1}
                            </span>
                            <input
                              value={videoUrl}
                              maxLength={250}
                              onChange={(event) => updateCourseIntroVideo(index, event.target.value)}
                              placeholder="https://youtube.com/watch?v=..."
                              className={`h-10 min-w-0 flex-1 rounded-xl border px-3 text-sm font-semibold outline-none focus:border-[#0B4FD8] ${fieldErrors.courseIntroVideoUrls ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50"}`}
                              dir="ltr"
                              aria-label={isFa ? `لینک ویدیوی ${index + 1}` : `Video link ${index + 1}`}
                            />
                            {hasYouTubeLink(videoUrl) ? (
                              <a
                                href={videoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:text-[#0B4FD8]"
                                title={isFa ? "باز کردن ویدیو" : "Open video"}
                                aria-label={isFa ? "باز کردن ویدیو" : "Open video"}
                              >
                                <ExternalLink size={16} />
                              </a>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => removeCourseIntroVideo(index)}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                              title={isFa ? "حذف لینک" : "Remove link"}
                              aria-label={isFa ? "حذف لینک" : "Remove link"}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">
                        {isFa ? "هنوز ویدیوی معرفی کورس اضافه نشده است." : "No course introduction video has been added yet."}
                      </p>
                    )}
                    {fieldErrors.courseIntroVideoUrls ? (
                      <p className="mt-2 text-xs font-semibold text-rose-600">
                        {fieldErrors.courseIntroVideoUrls}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">
                      {isFa
                        ? `حداکثر ${COURSE_INTRO_VIDEO_MAX_COUNT} لینک YouTube.`
                        : `Up to ${COURSE_INTRO_VIDEO_MAX_COUNT} YouTube links.`}
                    </p>
                  </div>
                </div>
                </div>
              </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-600">{isFa ? "درباره مدرس" : "Teacher Bio"} *</span>
              <textarea value={form.bio} maxLength={1200} onChange={(e) => handleFieldChange("bio", e.target.value)} placeholder={isFa ? "خودتان، روش تدریس و تجربه‌تان را کوتاه معرفی کنید" : "Briefly describe yourself, your teaching style, and experience"} rows={3} className={getTextareaClass("bio")} />
              {fieldErrors.bio ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.bio}</p> : null}
            </label>

            {!isApproved ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-600">{isFa ? "انگیزه همکاری با EduTech" : "Motivation For EduTech"} *</span>
                <textarea value={form.motivation} minLength={30} maxLength={1500} onChange={(e) => handleFieldChange("motivation", e.target.value)} placeholder={isFa ? "چرا می‌خواهید با EduTech همکاری کنید؟ (حداقل ۳۰ کاراکتر)" : "Why do you want to teach with EduTech? (min 30 characters)"} rows={4} className={getTextareaClass("motivation")} />
                {fieldErrors.motivation ? <p className="text-xs font-semibold text-rose-600">{fieldErrors.motivation}</p> : null}
              </label>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              {SOCIAL_PROFILE_FIELDS.map((social) => (
                <label key={social.key} className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-600">{social.label}</span>
                  <input
                    value={form[social.key]}
                    maxLength={250}
                    onChange={(event) => handleFieldChange(social.key, event.target.value)}
                    placeholder={`${social.placeholder} (${isFa ? "اختیاری" : "optional"})`}
                    className={getTextInputClass(social.key)}
                    dir="ltr"
                  />
                  {fieldErrors[social.key] ? (
                    <p className="text-xs font-semibold text-rose-600">
                      {fieldErrors[social.key]}
                    </p>
                  ) : null}
                </label>
              ))}
            </div>

            {isRejected && merged?.teacherApplication?.reviewNote ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {isFa ? "دلیل رد: " : "Rejection reason: "}
                {merged.teacherApplication.reviewNote}
              </div>
            ) : null}

            {!isUnderReview ? (
              <div className="sticky bottom-0 z-20 -mx-3 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_28px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:mx-0 sm:flex-row sm:flex-wrap sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                {isApproved ? (
                  <button
                    type="button"
                    onClick={handleCancelApprovedEdit}
                    disabled={loading || saving}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#0B4FD8] bg-white px-6 text-sm font-black text-[#0B4FD8] transition hover:bg-[#EFF6FF] disabled:opacity-70 sm:w-auto"
                  >
                    {isFa ? "لغو" : "Cancel"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    disabled={loading || saving}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#0B4FD8] bg-white px-6 text-sm font-black text-[#0B4FD8] transition hover:bg-[#EFF6FF] disabled:opacity-70 sm:w-auto"
                  >
                    {isFa ? "ریست فرم" : "Reset Form"}
                  </button>
                )}
                <button type="submit" name="teacherApplicationAction" value="submit_for_review" disabled={loading || saving} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#0B4FD8] px-6 text-sm font-black text-white shadow-sm transition hover:bg-[#083FAA] disabled:opacity-70 sm:h-11 sm:w-auto">
                  {saving
                    ? isFa
                      ? "در حال ارسال"
                      : "Submitting"
                    : isApproved
                      ? isFa
                        ? "ذخیره تغییرات"
                        : "Save Changes"
                      : isRejected
                        ? isFa
                          ? "ارسال دوباره برای بررسی"
                          : "Submit Again For Review"
                        : isFa
                          ? "ارسال برای بررسی"
                          : "Submit For Review"}
                </button>
              </div>
            ) : null}
            </fieldset>
          </form>
        ) : (
          <section className="mt-6 space-y-4">
            <div className="flex justify-center">
              <div className="h-56 w-56 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]">
                <div className="h-full w-full overflow-hidden rounded-2xl">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-4xl font-black text-slate-600">
                      {avatarInitial}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5">
                <p className="text-[11px] font-extrabold text-slate-500">{isFa ? "نام" : "Name"}</p>
                <p className="mt-1 text-sm font-bold text-[#0F172A]">{displayName}</p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5">
                <p className="text-[11px] font-extrabold text-slate-500">{isFa ? "ایمیل" : "Email"}</p>
                <p className="mt-1 text-sm font-bold text-[#0F172A]" dir="ltr">{merged?.email || "-"}</p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5">
                <p className="text-[11px] font-extrabold text-slate-500">{isFa ? "کشور / شهر" : "Country / City"}</p>
                <p className="mt-1 text-sm font-bold text-[#0F172A]">{`${countryDisplay} / ${cityDisplay}`}</p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5">
                <p className="text-[11px] font-extrabold text-slate-500">{isFa ? "شماره موبایل" : "Phone"}</p>
                <p className={`mt-1 text-sm font-bold text-[#0F172A] ${isRTL ? "text-right" : "text-left"}`} dir="ltr">
                  {approvedPhone || "-"}
                </p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5">
                <p className="text-[11px] font-extrabold text-slate-500">{isFa ? "عنوان حرفه‌ای" : "Professional Title"}</p>
                <p className="mt-1 text-sm font-bold text-[#0F172A]">{approvedApplication?.professionalTitle || "-"}</p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5">
                <p className="text-[11px] font-extrabold text-slate-500">{isFa ? "سال‌های تجربه" : "Years of Experience"}</p>
                <p className="mt-1 text-sm font-bold text-[#0F172A]">
                  {Number(approvedApplication?.yearsExperience || 0) > 0
                    ? `${approvedApplication.yearsExperience} ${isFa ? "سال" : "years"}`
                    : "-"}
                </p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 sm:col-span-2">
                <p className="text-[11px] font-extrabold text-slate-500">{isFa ? "زبان‌های تدریس" : "Teaching Languages"}</p>
                <p className="mt-1 text-sm font-bold text-[#0F172A]">
                  {(approvedApplication?.languages || []).join(", ") || "-"}
                </p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 sm:col-span-2">
                <p className="text-[11px] font-extrabold text-slate-500">{isFa ? "حوزه‌های تخصص" : "Expertise Areas"}</p>
                <p className="mt-1 text-sm font-bold text-[#0F172A]">{(approvedApplication?.expertiseAreas || []).join(", ") || "-"}</p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 sm:col-span-2">
                <p className="text-[11px] font-extrabold text-slate-500">{isFa ? "مهارت‌ها و تخصص‌ها" : "Skills & Expertise"}</p>
                {Array.isArray(approvedApplication?.skillRatings) && approvedApplication.skillRatings.length ? (
                  <div className="mt-2 space-y-2">
                    {approvedApplication.skillRatings.map((item, idx) => {
                      const percentage = Math.max(0, Math.min(100, Number(item?.percentage || 0)));
                      return (
                        <div key={`${item?.name || "skill"}-${idx}`}>
                          <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-700">
                            <span>{item?.name || "-"}</span>
                            <span>{percentage}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-[#0B4FD8]" style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-bold text-[#0F172A]">-</p>
                )}
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 sm:col-span-2">
                <p className="text-[11px] font-extrabold text-blue-700">
                  {isFa ? "ویدیوی معرفی برای شاگردان" : "Intro Video For Students"}
                </p>
                {approvedApplication?.introVideoUrl ? (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="break-all text-sm font-bold text-[#0F172A]" dir="ltr">
                      {approvedApplication.introVideoUrl}
                    </p>
                    <a
                      href={approvedApplication.introVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#0B4FD8] px-3 text-xs font-black text-white"
                    >
                      {isFa ? "دیدن ویدیو" : "View Video"}
                    </a>
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-bold text-[#0F172A]">-</p>
                )}
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 sm:col-span-2">
                <p className="text-[11px] font-extrabold text-slate-500">
                  {isFa ? "ویدیوهای معرفی کورس در یوتیوب" : "Course Introduction Videos on YouTube"}
                </p>
                {Array.isArray(approvedApplication?.courseIntroVideoUrls) &&
                approvedApplication.courseIntroVideoUrls.length ? (
                  <div className="mt-2 space-y-2">
                    {approvedApplication.courseIntroVideoUrls.map((videoUrl, index) => (
                      <div
                        key={`${videoUrl}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <p className="min-w-0 truncate text-sm font-bold text-[#0F172A]" dir="ltr">
                          {videoUrl}
                        </p>
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#0B4FD8]"
                          title={isFa ? "دیدن ویدیو" : "View video"}
                          aria-label={isFa ? "دیدن ویدیو" : "View video"}
                        >
                          <ExternalLink size={15} />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-bold text-[#0F172A]">-</p>
                )}
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 sm:col-span-2">
                <p className="text-[11px] font-extrabold text-slate-500">{isFa ? "درباره مدرس" : "Teacher Bio"}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold leading-6 text-[#0F172A]">
                  {merged?.bio || "-"}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsEditingApprovedProfile(true)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#0B4FD8] px-6 text-sm font-black text-white transition hover:bg-[#083FAA]"
              >
                {isFa ? "ویرایش پروفایل" : "Edit Profile"}
              </button>
            </div>
          </section>
        )}

      </section>
      <ProfileImageCropModal
        open={pendingAvatarFile instanceof File}
        file={pendingAvatarFile}
        language={language}
        onClose={() => setPendingAvatarFile(null)}
        onApply={(croppedFile) => {
          setAvatarFile(croppedFile);
          setAvatarPreview(URL.createObjectURL(croppedFile));
          setPendingAvatarFile(null);
          clearFieldError("avatarFile");
        }}
      />
    </TeacherLayout>
  );
}
