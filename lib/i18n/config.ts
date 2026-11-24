export type Language = "en" | "id"

/** Cookie that remembers the visitor's chosen language across visits. */
export const LANGUAGE_COOKIE = "cf-lang"

export function parseLanguage(value: string | undefined | null): Language {
  return value === "id" ? "id" : "en"
}
