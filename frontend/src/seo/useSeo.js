import { useEffect } from "react";
import { localizePath, stripLanguagePrefix } from "../utils/localizedRoutes.js";

const SITE_NAME_EN = "EduTech Academy";
const SITE_NAME_FA = "آکادمی ایجوتک";
const DEFAULT_SITE_URL = "https://edutech.study";
const DEFAULT_OG_IMAGE = "/logo.png";
const OFFICIAL_SOCIAL_URLS = [
  "https://www.instagram.com/edutech_main/",
  "https://t.me/edutech_main",
  "https://www.facebook.com/share/1KuPqHbFMv/",
  "https://www.youtube.com/@edutech_main",
];

const BASE_KEYWORDS = [
  "EduTech ",
  "edutech academy",
  "edutech online academy",
  "EduTech Online Academy",
  "EduTech Academy",
  "Edutech",
  "Edutech Academy",
  "edutech study",
  "edutech.study",
  "edutech online",
  "edutch",
  "edutch study",
  "online academy",
  "live online classes",
  "interactive learning",
  "ایجوتک",
  "ایجو تک",
  "ایجوتیک",
  "آکادمی ایجوتک",
  "ایجوتک اکادمی",
  "ایجوتک آکادمی",
  "کلاس آنلاین",
  "آموزش آنلاین",
];

function normalizeSiteUrl(url) {
  const normalizedInput =
    typeof url === "string" ? url.trim() : "";

  if (normalizedInput) {
    return normalizedInput.endsWith("/")
      ? normalizedInput.slice(0, -1)
      : normalizedInput;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return String(window.location.origin).replace(/\/+$/, "");
  }

  return DEFAULT_SITE_URL;
}

function ensureAbsoluteUrl(pathOrUrl, siteUrl) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return `${siteUrl}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function getSeoConfig(pathname, language) {
  const isFa = language === "fa";
  const shared = {
    siteName: isFa ? SITE_NAME_FA : SITE_NAME_EN,
    type: "website",
    image: DEFAULT_OG_IMAGE,
    robots:
      "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
    shouldIndex: true,
  };

  const routeConfigs = [
    {
      match: /^\/$/,
      title: isFa
        ? "ایجوتک | دوره‌های آنلاین زنده در افغانستان"
        : "EduTech Academy | Live Online Courses in Afghanistan",
      description: isFa
        ? "در ایجوتک با مدرسان حرفه‌ای در دوره‌ها و کلاس‌های آنلاین زنده شرکت کنید و مهارت‌های کاربردی را به فارسی و انگلیسی بیاموزید."
        : "Join live online courses with expert instructors at EduTech Academy. Learn practical skills in English and Persian from Kabul, Afghanistan.",
      keywords: [
        "live classes",
        "online courses",
        "دوره آنلاین",
        "مدرس آنلاین",
      ],
    },
    {
      match: /^\/live-courses\/?$/,
      title: isFa
        ? "دوره‌های زنده | آکادمی ایجوتک"
        : "Live Courses | EduTech Academy",
      description: isFa
        ? "لیست دوره‌های زنده ایجوتک را ببینید، دوره مناسب خود را پیدا کنید و یادگیری را همین امروز شروع کنید."
        : "Explore EduTech live courses, compare options, and start learning with real-time classes.",
      keywords: ["course catalog", "live course", "دوره زنده", "کلاس زنده"],
    },
    {
      match: /^\/packages\/?$/,
      title: isFa
        ? "بسته‌های آموزشی | آکادمی ایجوتک"
        : "Learning Packages | EduTech Academy",
      description: isFa
        ? "بسته‌های آموزشی مرحله‌به‌مرحله ایجوتک را ببینید و کورس‌های مناسب هدف خود را به ترتیب انتخاب کنید."
        : "Explore EduTech learning packages and follow courses organized into a clear step-by-step path.",
      keywords: [
        "learning packages",
        "course bundles",
        "learning path",
        "بسته آموزشی",
        "مسیر یادگیری",
      ],
    },
    {
      match: /^\/packages\/[^/]+\/?$/,
      title: isFa
        ? "مسیر بسته آموزشی | آکادمی ایجوتک"
        : "Learning Package Path | EduTech Academy",
      description: isFa
        ? "مرحله‌ها و کورس‌های این بسته آموزشی را ببینید و مسیر یادگیری خود را با ایجوتک آغاز کنید."
        : "View every step and course in this EduTech learning package and begin your learning path.",
      keywords: [
        "learning package",
        "course sequence",
        "بسته کورس",
        "مراحل یادگیری",
      ],
    },
    {
      match: /^\/bootcamps\/?$/,
      title: isFa
        ? "بوت‌کمپ‌های رایگان | آکادمی ایجوتک"
        : "Free Bootcamps | EduTech Academy",
      description: isFa
        ? "در بوت‌کمپ‌های رایگان ایجوتک ثبت‌نام کنید و پس از تکمیل ظرفیت با مدرس‌های حرفه‌ای در جلسات زنده شرکت کنید."
        : "Register for free EduTech bootcamps and join live sessions with expert teachers once the required group is ready.",
      keywords: ["free bootcamp", "live bootcamp", "بوت کمپ رایگان", "ثبت نام بوت کمپ"],
    },
    {
      match: /^\/bootcamps\/[^/]+\/?$/,
      title: isFa
        ? "ثبت‌نام بوت‌کمپ رایگان | آکادمی ایجوتک"
        : "Free Bootcamp Registration | EduTech Academy",
      description: isFa
        ? "جزئیات بوت‌کمپ، تعداد ثبت‌نام‌ها و فرم ثبت‌نام رایگان را مشاهده کنید."
        : "View bootcamp details, registration progress, and reserve your free place.",
      keywords: ["bootcamp registration", "free course", "ثبت نام رایگان", "بوت کمپ"],
    },
    {
      match: /^\/live-courses\/category\/[^/]+\/?$/,
      title: isFa
        ? "دسته‌بندی دوره‌ها | آکادمی ایجوتک"
        : "Course Category | EduTech Academy",
      description: isFa
        ? "دوره‌های زنده ایجوتک را بر اساس موضوع، سطح و زبان آموزشی پیدا کنید."
        : "Browse EduTech live courses by subject, level, and teaching language.",
      keywords: ["course category", "دسته‌بندی دوره", "موضوعات آموزشی"],
    },
    {
      match: /^\/course\/[^/]+\/?$/,
      title: isFa
        ? "جزئیات دوره | آکادمی ایجوتک"
        : "Course Details | EduTech Academy",
      description: isFa
        ? "جزئیات کامل دوره شامل برنامه، مدرس، پیش‌نیازها و مسیر ثبت‌نام در ایجوتک."
        : "View complete course details, syllabus, teacher profile, and enrollment information on EduTech.",
      keywords: ["course details", "enroll", "ثبت نام دوره", "جزئیات دوره"],
    },
    {
      match: /^\/teachers\/?$/,
      title: isFa ? "مدرس‌ها | آکادمی ایجوتک" : "Teachers | EduTech Academy",
      description: isFa
        ? "با مدرس‌های ایجوتک آشنا شوید و بهترین استاد را برای مسیر یادگیری خود انتخاب کنید."
        : "Meet EduTech teachers and choose the best instructor for your learning journey.",
      keywords: ["teachers", "instructors", "مدرس", "اساتید آنلاین"],
    },
    {
      match: /^\/teacher\/[^/]+\/?$/,
      title: isFa
        ? "پروفایل مدرس | آکادمی ایجوتک"
        : "Teacher Profile | EduTech Academy",
      description: isFa
        ? "تجربه، تخصص و دوره‌های مدرس را ببینید و بهترین انتخاب را انجام دهید."
        : "Check teacher expertise, experience, and available classes before you enroll.",
      keywords: [
        "teacher profile",
        "instructor bio",
        "پروفایل مدرس",
        "رزومه استاد",
      ],
    },
    {
      match: /^\/blog\/?$/,
      title: isFa ? "وبلاگ آموزشی | آکادمی ایجوتک" : "Learning Blog | EduTech Academy",
      description: isFa
        ? "مقاله‌ها، راهنماهای عملی و نکته‌های آموزشی ایجوتک را برای یادگیری بهتر مطالعه کنید."
        : "Read practical guides, learning strategies, and educational insights from EduTech.",
      keywords: ["learning blog", "education articles", "وبلاگ آموزشی", "مقالات آموزشی"],
    },
    {
      match: /^\/blog\/[^/]+\/?$/,
      title: isFa ? "مقاله آموزشی | آکادمی ایجوتک" : "Learning Article | EduTech Academy",
      description: isFa ? "این مقاله آموزشی را در وبلاگ ایجوتک بخوانید." : "Read this educational article on the EduTech blog.",
      keywords: ["EduTech article", "learning guide", "مقاله ایجوتک"],
    },
    {
      match: /^\/roadmaps\/?$/,
      title: isFa ? "نقشه‌های راه یادگیری | آکادمی ایجوتک" : "Learning Roadmaps | EduTech Academy",
      description: isFa ? "نقشه‌های راه ایجوتک به شما کمک می‌کنند کورس‌ها را برای یادگیری هر مهارت به ترتیب درست انتخاب کنید." : "EduTech learning roadmaps help you choose courses in the right order for each skill and goal.",
      keywords: ["learning roadmaps", "course path", "نقشه راه یادگیری", "مسیر کورس"],
    },
    {
      match: /^\/videos\/?$/,
      title: isFa ? "ویدیوهای آموزشی | آکادمی ایجوتک" : "Learning Videos | EduTech Academy",
      description: isFa
        ? "ویدیوهای آموزشی، نکته‌های کوتاه و محتوای تازه ایجوتک را از یوتیوب و اینستاگرام تماشا کنید."
        : "Watch EduTech lessons, quick learning tips, and fresh videos from YouTube and Instagram.",
      keywords: ["learning videos", "educational videos", "ویدیو آموزشی", "آموزش ویدیویی"],
    },
    {
      match: /^\/gallery(?:\/[^/]+)?\/?$/,
      title: isFa ? "گالری تصاویر | آکادمی ایجوتک" : "Image Gallery | EduTech Academy",
      description: isFa
        ? "تصاویر صنف‌ها، رویدادها و فعالیت‌های جامعه آموزشی ایجوتک را ببینید."
        : "Explore photos from EduTech classes, events, and learning community activities.",
      keywords: ["EduTech gallery", "class photos", "گالری ایجوتک", "تصاویر رویدادها"],
    },
    {
      match: /^\/roadmaps\/english\/?$/,
      title: isFa
        ? "نقشه راه یادگیری انگلیسی | آکادمی ایجوتک"
        : "English Learning Roadmap | EduTech Academy",
      description: isFa
        ? "سطح انگلیسی خود را پیدا کنید و کورس‌های مناسب را در یک مسیر روشن از مبتدی تا پیشرفته انتخاب کنید."
        : "Find your English level and follow a clear course roadmap from beginner foundations to advanced fluency.",
      keywords: ["English roadmap", "learn English", "نقشه راه انگلیسی", "کورس انگلیسی"],
    },
    {
      match: /^\/about\/?$/,
      title: isFa ? "درباره ما | آکادمی ایجوتک" : "About Us | EduTech Academy",
      description: isFa
        ? "درباره ماموریت، چشم‌انداز و رویکرد آموزشی ایجوتک بیشتر بدانید."
        : "Learn about EduTech mission, vision, and our approach to interactive online education.",
      keywords: ["about academy", "mission", "درباره ایجوتک", "ماموریت آموزشی"],
    },
    {
      match: /^\/contact\/?$/,
      title: isFa
        ? "تماس با ما | آکادمی ایجوتک"
        : "Contact Us | EduTech Academy",
      description: isFa
        ? "برای مشاوره آموزشی، ثبت‌نام دوره یا همکاری با ایجوتک با ما در تماس باشید."
        : "Contact EduTech for course enrollment, academic consultation, or partnership opportunities.",
      keywords: ["contact", "support", "تماس با ایجوتک", "پشتیبانی آموزش"],
    },
    {
      match: /^\/privacy-policy\/?$/,
      title: isFa
        ? "حریم خصوصی | آکادمی ایجوتک"
        : "Privacy Policy | EduTech Academy",
      description: isFa
        ? "سیاست حریم خصوصی ایجوتک درباره جمع‌آوری، استفاده و محافظت از معلومات کاربران."
        : "EduTech privacy policy on data collection, usage, and protection.",
      keywords: [
        "privacy policy",
        "data protection",
        "حریم خصوصی",
        "محافظت از داده",
      ],
    },
    {
      match: /^\/terms\/?$/,
      title: isFa
        ? "شرایط استفاده | آکادمی ایجوتک"
        : "Terms of Service | EduTech Academy",
      description: isFa
        ? "شرایط و قوانین استفاده از خدمات آموزشی ایجوتک."
        : "Terms and conditions for using EduTech educational services.",
      keywords: ["terms of service", "terms", "شرایط استفاده", "قوانین"],
    },
    {
      match: /^\/(login|register)\/?$/,
      title: isFa ? "ورود و ثبت‌نام | ایجوتک" : "Login & Register | EduTech",
      description: isFa
        ? "برای دسترسی به پنل محصل در ایجوتک وارد شوید یا حساب جدید بسازید."
        : "Sign in or create your EduTech account to access your student dashboard.",
      keywords: ["login", "register", "ورود", "ثبت نام"],
      robots: "noindex, nofollow",
      shouldIndex: false,
    },
    {
      match: /^\/verify\/?$/,
      title: isFa
        ? "بررسی اعتبار سرتیفیکیت | ایجوتک"
        : "Verify a Certificate | EduTech Academy",
      description: isFa
        ? "اعتبار سرتیفیکیت صادرشده توسط ایجوتک را با شناسه آن بررسی کنید."
        : "Verify the authenticity of a certificate issued by EduTech Academy.",
      keywords: ["certificate verification", "بررسی سرتیفیکیت"],
    },
    {
      match: /^\/payment\/(success|failure|crypto)\/?$/,
      title: isFa ? "پرداخت | ایجوتک" : "Payment | EduTech",
      description: isFa
        ? "وضعیت پرداخت شما در ایجوتک ثبت شد."
        : "Your EduTech payment status has been recorded.",
      keywords: ["payment", "پرداخت"],
      robots: "noindex, nofollow",
      shouldIndex: false,
    },
    {
      match: /^\/support\/login\/?$/,
      title: isFa
        ? "ورود تیم پشتیبانی | ایجوتک"
        : "Support Team Login | EduTech",
      description: isFa
        ? "ورود اختصاصی اعضای تیم پشتیبانی ایجوتک."
        : "Private sign-in page for EduTech support team members.",
      keywords: ["support login", "ورود پشتیبانی"],
      robots: "noindex, nofollow",
      shouldIndex: false,
    },
    {
      match: /^\/support-team\/?$/,
      title: isFa
        ? "محیط کاری تیم پشتیبانی | ایجوتک"
        : "Support Team Workspace | EduTech",
      description: isFa
        ? "محیط اختصاصی مدیریت تکت‌ها و ارتباطات تیم پشتیبانی ایجوتک."
        : "Private workspace for EduTech support tickets and team communication.",
      keywords: ["support workspace", "محیط پشتیبانی"],
      robots: "noindex, nofollow",
      shouldIndex: false,
    },
    {
      match: /^\/student\/.+/,
      title: isFa ? "پنل محصل | ایجوتک" : "Student Portal | EduTech",
      description: isFa
        ? "پنل اختصاصی محصل برای مدیریت کلاس‌ها، تمرین‌ها و پروفایل."
        : "Private student area for classes, assignments, payments, and profile management.",
      keywords: ["student portal", "dashboard", "پنل محصل", "داشبورد"],
      robots: "noindex, nofollow",
      shouldIndex: false,
    },
  ];

  const matched = routeConfigs.find((item) => item.match.test(pathname));
  if (matched) return { ...shared, ...matched };

  return {
    ...shared,
    title: isFa ? "صفحه یافت نشد | ایجوتک" : "Page Not Found | EduTech",
    description: isFa
      ? "این صفحه در وب‌سایت ایجوتک وجود ندارد یا منتقل شده است."
      : "This page does not exist or has moved on the EduTech website.",
    keywords: [],
    robots: "noindex, nofollow",
    shouldIndex: false,
  };
}

function getOrCreateMetaByName(name) {
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  return tag;
}

function getOrCreateMetaByProperty(property) {
  let tag = document.head.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  return tag;
}

function setLinkRel(rel, href, hreflang) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]`;
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    if (hreflang) tag.setAttribute("hreflang", hreflang);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

function removeLanguageAlternates() {
  document.head
    .querySelectorAll('link[rel="alternate"][hreflang]')
    .forEach((tag) => tag.remove());
}

export function applySeo({
  pathname,
  language,
  overrides = {},
  additionalStructuredData = [],
}) {
    const siteUrl = normalizeSiteUrl(import.meta.env.VITE_SITE_URL);
    const config = { ...getSeoConfig(pathname, language), ...overrides };
    const baseCanonicalPath = config.canonicalPath || pathname || "/";
    const canonicalPath =
      baseCanonicalPath.startsWith("http://") ||
      baseCanonicalPath.startsWith("https://")
        ? baseCanonicalPath
        : localizePath(baseCanonicalPath, language);
    const canonicalUrl = ensureAbsoluteUrl(canonicalPath, siteUrl);
    const alternateSource = config.alternatePath || baseCanonicalPath;
    const alternateAppPath =
      alternateSource.startsWith("http://") ||
      alternateSource.startsWith("https://")
        ? new URL(alternateSource).pathname
        : stripLanguagePrefix(alternateSource);
    const englishUrl = ensureAbsoluteUrl(
      localizePath(alternateAppPath, "en"),
      siteUrl,
    );
    const persianUrl = ensureAbsoluteUrl(
      localizePath(alternateAppPath, "fa"),
      siteUrl,
    );
    const ogImage = ensureAbsoluteUrl(config.image, siteUrl);
    const locale = language === "fa" ? "fa_IR" : "en_US";
    const keywords = [...new Set([...BASE_KEYWORDS, ...(config.keywords || [])])]
      .map((keyword) => String(keyword || "").trim())
      .filter(Boolean)
      .join(", ");

    document.title = config.title;

    getOrCreateMetaByName("description").setAttribute(
      "content",
      config.description,
    );
    getOrCreateMetaByName("keywords").setAttribute("content", keywords);
    getOrCreateMetaByName("robots").setAttribute("content", config.robots);
    getOrCreateMetaByName("googlebot").setAttribute("content", config.robots);
    getOrCreateMetaByName("author").setAttribute("content", SITE_NAME_EN);

    getOrCreateMetaByProperty("og:title").setAttribute("content", config.title);
    getOrCreateMetaByProperty("og:description").setAttribute(
      "content",
      config.description,
    );
    getOrCreateMetaByProperty("og:type").setAttribute("content", config.type);
    getOrCreateMetaByProperty("og:url").setAttribute("content", canonicalUrl);
    getOrCreateMetaByProperty("og:site_name").setAttribute(
      "content",
      config.siteName,
    );
    getOrCreateMetaByProperty("og:locale").setAttribute("content", locale);
    getOrCreateMetaByProperty("og:locale:alternate").setAttribute(
      "content",
      language === "fa" ? "en_US" : "fa_AF",
    );
    getOrCreateMetaByProperty("og:image").setAttribute("content", ogImage);
    getOrCreateMetaByProperty("og:image:alt").setAttribute(
      "content",
      config.imageAlt || config.title,
    );

    getOrCreateMetaByName("twitter:card").setAttribute(
      "content",
      "summary_large_image",
    );
    getOrCreateMetaByName("twitter:title").setAttribute(
      "content",
      config.title,
    );
    getOrCreateMetaByName("twitter:description").setAttribute(
      "content",
      config.description,
    );
    getOrCreateMetaByName("twitter:image").setAttribute("content", ogImage);
    getOrCreateMetaByName("twitter:image:alt").setAttribute(
      "content",
      config.imageAlt || config.title,
    );

    setLinkRel("canonical", canonicalUrl);
    removeLanguageAlternates();
    if (config.shouldIndex) {
      setLinkRel("alternate", persianUrl, "fa");
      setLinkRel("alternate", englishUrl, "en");
      setLinkRel("alternate", persianUrl, "x-default");
    }

    let structuredDataTag = document.getElementById("edutech-structured-data");
    if (!structuredDataTag) {
      structuredDataTag = document.createElement("script");
      structuredDataTag.type = "application/ld+json";
      structuredDataTag.id = "edutech-structured-data";
      document.head.appendChild(structuredDataTag);
    }

    const structuredData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${siteUrl}/#organization`,
          name: SITE_NAME_EN,
          alternateName: [
            SITE_NAME_FA,
            "ایجوتک",
            "EduTech",
            "Edutech",
            "Edutech Study",
            "edutech.study",
            "Edutch",
          ],
          url: siteUrl,
          logo: ensureAbsoluteUrl("/logo.png", siteUrl),
          sameAs: OFFICIAL_SOCIAL_URLS,
          areaServed: {
            "@type": "Country",
            name: "Afghanistan",
          },
        },
        {
          "@type": "EducationalOrganization",
          "@id": `${siteUrl}/#education`,
          name: SITE_NAME_EN,
          alternateName: [
            SITE_NAME_FA,
            "EduTech",
            "Edutech Study",
            "edutech.study",
          ],
          url: siteUrl,
          inLanguage: ["en", "fa"],
          keywords: BASE_KEYWORDS.join(", "),
          sameAs: OFFICIAL_SOCIAL_URLS,
          areaServed: {
            "@type": "Country",
            name: "Afghanistan",
          },
        },
        {
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          url: siteUrl,
          name: SITE_NAME_EN,
          alternateName: SITE_NAME_FA,
          inLanguage: ["en", "fa"],
          publisher: { "@id": `${siteUrl}/#organization` },
        },
        {
          "@type": "WebPage",
          "@id": `${canonicalUrl}#webpage`,
          url: canonicalUrl,
          name: config.title,
          description: config.description,
          isPartOf: { "@id": `${siteUrl}/#website` },
          inLanguage: language === "fa" ? "fa" : "en",
        },
      ],
    };

    if (!config.shouldIndex) {
      structuredData["@graph"] = structuredData["@graph"].filter(
        (item) => item["@type"] !== "WebPage",
      );
    } else {
      structuredData["@graph"].push(
        ...additionalStructuredData.filter(Boolean),
      );
    }

    structuredDataTag.textContent = JSON.stringify(structuredData);
}

export default function useSeo({ pathname, language }) {
  useEffect(() => {
    applySeo({ pathname, language });
  }, [language, pathname]);
}
