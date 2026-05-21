export type DtpOutputLanguage =
  | "pt-BR"
  | "pt-PT"
  | "en"
  | "es"
  | "de"
  | "fr";

export const DEFAULT_DTP_OUTPUT_LANGUAGE: DtpOutputLanguage = "pt-BR";

export type DtpOutputLanguageOption = {
  value: DtpOutputLanguage;
  label: string;
};

/** Idiomas disponíveis no select da UI (rótulos em português). */
export const DTP_OUTPUT_LANGUAGE_OPTIONS: DtpOutputLanguageOption[] = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "pt-PT", label: "Português (Portugal)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
];

const VALID = new Set<string>(DTP_OUTPUT_LANGUAGE_OPTIONS.map((o) => o.value));

export function isDtpOutputLanguage(value: string): value is DtpOutputLanguage {
  return VALID.has(value);
}

export function resolveDtpOutputLanguage(value: string | null | undefined): DtpOutputLanguage {
  const trimmed = value?.trim();
  if (trimmed && isDtpOutputLanguage(trimmed)) return trimmed;
  return DEFAULT_DTP_OUTPUT_LANGUAGE;
}

/** Instrução de idioma injectada no prompt da Vertex. */
export function dtpAiLanguageInstruction(language: DtpOutputLanguage): string {
  const map: Record<DtpOutputLanguage, string> = {
    "pt-BR":
      "Escreva títulos e descrições em português do Brasil, com linguagem clara e operacional.",
    "pt-PT":
      "Escreva títulos e descrições em português de Portugal, com linguagem clara e operacional.",
    en: "Write titles and descriptions in English, using clear operational language.",
    es: "Escriba títulos y descripciones en español, con lenguaje claro y operativo.",
    de: "Schreiben Sie Titel und Beschreibungen auf Deutsch, in klarer operativer Sprache.",
    fr: "Rédigez les titres et les descriptions en français, dans un langage opérationnel clair.",
  };
  return map[language];
}
