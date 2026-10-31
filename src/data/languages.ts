import type { TeachingLanguage } from "@/types/language";

export const LANGUAGES: TeachingLanguage[] = [
  {
    id: "hi-IN",
    nameEnglish: "Hindi",
    nameNative: "हिन्दी",
    languageCode: "hi-IN",
    popular: true,
  },
  {
    id: "en-IN",
    nameEnglish: "English",
    nameNative: "English",
    languageCode: "en-IN",
    popular: true,
  },
  {
    id: "ta-IN",
    nameEnglish: "Tamil",
    nameNative: "தமிழ்",
    languageCode: "ta-IN",
    popular: true,
  },
  {
    id: "te-IN",
    nameEnglish: "Telugu",
    nameNative: "తెలుగు",
    languageCode: "te-IN",
    popular: true,
  },
  {
    id: "bn-IN",
    nameEnglish: "Bengali",
    nameNative: "বাংলা",
    languageCode: "bn-IN",
    popular: true,
  },
  {
    id: "mr-IN",
    nameEnglish: "Marathi",
    nameNative: "मराठी",
    languageCode: "mr-IN",
    popular: true,
  },
  {
    id: "kn-IN",
    nameEnglish: "Kannada",
    nameNative: "ಕನ್ನಡ",
    languageCode: "kn-IN",
  },
  {
    id: "ml-IN",
    nameEnglish: "Malayalam",
    nameNative: "മലയാളം",
    languageCode: "ml-IN",
  },
  {
    id: "gu-IN",
    nameEnglish: "Gujarati",
    nameNative: "ગુજરાતી",
    languageCode: "gu-IN",
  },
  {
    id: "pa-IN",
    nameEnglish: "Punjabi",
    nameNative: "ਪੰਜਾਬੀ",
    languageCode: "pa-IN",
  },
  {
    id: "od-IN",
    nameEnglish: "Odia",
    nameNative: "ଓଡ଼ିଆ",
    languageCode: "od-IN",
  },
  {
    id: "as-IN",
    nameEnglish: "Assamese",
    nameNative: "অসমীয়া",
    languageCode: "as-IN",
  },
  {
    id: "kok-IN",
    nameEnglish: "Konkani",
    nameNative: "कोंकणी",
    languageCode: "kok-IN",
  },
  {
    id: "mai-IN",
    nameEnglish: "Maithili",
    nameNative: "मैथिली",
    languageCode: "mai-IN",
  },
  {
    id: "sd-IN",
    nameEnglish: "Sindhi",
    nameNative: "سنڌي",
    languageCode: "sd-IN",
  },
  {
    id: "sa-IN",
    nameEnglish: "Sanskrit",
    nameNative: "संस्कृतम्",
    languageCode: "sa-IN",
  },
  {
    id: "ne-IN",
    nameEnglish: "Nepali",
    nameNative: "नेपाली",
    languageCode: "ne-IN",
  },
  {
    id: "doi-IN",
    nameEnglish: "Dogri",
    nameNative: "डोगरी",
    languageCode: "doi-IN",
  },
  {
    id: "brx-IN",
    nameEnglish: "Bodo",
    nameNative: "बड़ो",
    languageCode: "brx-IN",
  },
  {
    id: "mni-IN",
    nameEnglish: "Manipuri",
    nameNative: "মৈতৈলোন্",
    languageCode: "mni-IN",
  },
  {
    id: "sat-IN",
    nameEnglish: "Santali",
    nameNative: "ᱥᱟᱱᱛᱟᱲᱤ",
    languageCode: "sat-IN",
  },
  {
    id: "ks-IN",
    nameEnglish: "Kashmiri",
    nameNative: "کٲشُر",
    languageCode: "ks-IN",
  },
  {
    id: "ur-IN",
    nameEnglish: "Urdu",
    nameNative: "اردو",
    languageCode: "ur-IN",
  },
];

export const allLanguages: readonly TeachingLanguage[] = LANGUAGES;

export const popularLanguages: readonly TeachingLanguage[] = LANGUAGES.filter(
  (lang) => lang.popular === true,
);

export function getLanguageById(id: string): TeachingLanguage | undefined {
  return LANGUAGES.find((lang) => lang.id === id);
}

export function filterLanguages(query: string): TeachingLanguage[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [...LANGUAGES];
  }

  return LANGUAGES.filter(
    (lang) =>
      lang.nameEnglish.toLowerCase().includes(trimmed) ||
      lang.nameNative.toLowerCase().includes(trimmed) ||
      lang.languageCode.toLowerCase().includes(trimmed),
  );
}
