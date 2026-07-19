import { useEffect } from "react";

const SITE_NAME_EN = "EduTech Academy";
const SITE_NAME_FA = "آکادمی ایجوتک";
const DEFAULT_SITE_URL = "https://edutech.study";
const DEFAULT_OG_IMAGE = "/logo-en.png";

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
        ? "ایجوتک | آکادمی آموزش آنلاین"
        : "EduTech | Online Learning Academy",
      description: isFa
        ? "ایجوتک آکادمی آموزش آنلاین با کلاس‌های زنده، مدرس‌های حرفه‌ای و دوره‌های تعاملی برای یادگیری موثر است."
        : "EduTech Academy (edutech.study) offers live online classes, expert teachers, and interactive courses for practical learning.",
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
        ? "دوره‌های زنده | ایجوتک آکادمی"
        : "Live Courses | EduTech Academy",
      description: isFa
        ? "لیست دوره‌های زنده ایجوتک را ببینید، دوره مناسب خود را پیدا کنید و یادگیری را همین امروز شروع کنید."
        : "Explore EduTech live courses, compare options, and start learning with real-time classes.",
      keywords: ["course catalog", "live course", "دوره زنده", "کلاس زنده"],
    },
    {
      match: /^\/course\/[^/]+\/?$/,
      title: isFa
        ? "جزئیات دوره | ایجوتک آکادمی"
        : "Course Details | EduTech Academy",
      description: isFa
        ? "جزئیات کامل دوره شامل برنامه، مدرس، پیش‌نیازها و مسیر ثبت‌نام در ایجوتک."
        : "View complete course details, syllabus, teacher profile, and enrollment information on EduTech.",
      keywords: ["course details", "enroll", "ثبت نام دوره", "جزئیات دوره"],
    },
    {
      match: /^\/teachers\/?$/,
      title: isFa ? "مدرس‌ها | ایجوتک آکادمی" : "Teachers | EduTech Academy",
      description: isFa
        ? "با مدرس‌های ایجوتک آشنا شوید و بهترین استاد را برای مسیر یادگیری خود انتخاب کنید."
        : "Meet EduTech teachers and choose the best instructor for your learning journey.",
      keywords: ["teachers", "instructors", "مدرس", "اساتید آنلاین"],
    },
    {
      match: /^\/teacher\/[^/]+\/?$/,
      title: isFa
        ? "پروفایل مدرس | ایجوتک آکادمی"
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
      title: isFa
        ? "نقشه‌های راه یادگیری | ایجوتک آکادمی"
        : "Learning Roadmaps | EduTech Academy",
      description: isFa
        ? "نقشه‌های راه ایجوتک به شما کمک می‌کنند کورس‌ها را برای یادگیری هر مهارت به ترتیب درست انتخاب کنید."
        : "EduTech learning roadmaps help you choose courses in the right order for each skill and goal.",
      keywords: ["learning roadmaps", "course path", "نقشه راه یادگیری", "مسیر کورس"],
    },
    {
      match: /^\/blog\/english\/?$/,
      title: isFa
        ? "نقشه راه یادگیری انگلیسی | ایجوتک آکادمی"
        : "English Learning Roadmap | EduTech Academy",
      description: isFa
        ? "سطح انگلیسی خود را پیدا کنید و کورس‌های مناسب را در یک مسیر روشن از مبتدی تا پیشرفته انتخاب کنید."
        : "Find your English level and follow a clear course roadmap from beginner foundations to advanced fluency.",
      keywords: ["English roadmap", "learn English", "نقشه راه انگلیسی", "کورس انگلیسی"],
    },
    {
      match: /^\/about\/?$/,
      title: isFa ? "درباره ما | ایجوتک آکادمی" : "About Us | EduTech Academy",
      description: isFa
        ? "درباره ماموریت، چشم‌انداز و رویکرد آموزشی ایجوتک بیشتر بدانید."
        : "Learn about EduTech mission, vision, and our approach to interactive online education.",
      keywords: ["about academy", "mission", "درباره ایجوتک", "ماموریت آموزشی"],
    },
    {
      match: /^\/contact\/?$/,
      title: isFa
        ? "تماس با ما | ایجوتک آکادمی"
        : "Contact Us | EduTech Academy",
      description: isFa
        ? "برای مشاوره آموزشی، ثبت‌نام دوره یا همکاری با ایجوتک با ما در تماس باشید."
        : "Contact EduTech for course enrollment, academic consultation, or partnership opportunities.",
      keywords: ["contact", "support", "تماس با ایجوتک", "پشتیبانی آموزش"],
    },
    {
      match: /^\/privacy-policy\/?$/,
      title: isFa
        ? "حریم خصوصی | ایجوتک آکادمی"
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
        ? "شرایط استفاده | ایجوتک آکادمی"
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
      match: /^\/payment\/(success|failure)\/?$/,
      title: isFa ? "پرداخت | ایجوتک" : "Payment | EduTech",
      description: isFa
        ? "وضعیت پرداخت شما در ایجوتک ثبت شد."
        : "Your EduTech payment status has been recorded.",
      keywords: ["payment", "پرداخت"],
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
    title: isFa ? "ایجوتک آکادمی" : "EduTech Academy",
    description: isFa
      ? "ایجوتک آکادمی آموزش آنلاین با دوره‌های زنده و تعاملی."
      : "EduTech Academy with live and interactive online courses.",
    keywords: ["academy", "online learning", "آموزش آنلاین"],
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

export default function useSeo({ pathname, language }) {
  useEffect(() => {
    const siteUrl = normalizeSiteUrl(import.meta.env.VITE_SITE_URL);
    const config = getSeoConfig(pathname, language);
    const canonicalUrl = ensureAbsoluteUrl(pathname || "/", siteUrl);
    const ogImage = ensureAbsoluteUrl(config.image, siteUrl);
    const locale = language === "fa" ? "fa_IR" : "en_US";
    const keywords = [...BASE_KEYWORDS, ...(config.keywords || [])].join(", ");

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
    getOrCreateMetaByProperty("og:image").setAttribute("content", ogImage);

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

    setLinkRel("canonical", canonicalUrl);
    setLinkRel("alternate", canonicalUrl, "en");
    setLinkRel("alternate", canonicalUrl, "fa");
    setLinkRel("alternate", canonicalUrl, "x-default");

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
        },
        {
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          url: siteUrl,
          name: SITE_NAME_EN,
          inLanguage: ["en", "fa"],
          publisher: { "@id": `${siteUrl}/#organization` },
          potentialAction: {
            "@type": "SearchAction",
            target: `${siteUrl}/live-courses?search={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
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
    }

    structuredDataTag.textContent = JSON.stringify(structuredData);
  }, [language, pathname]);
}
