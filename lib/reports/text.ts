export const REPORT_TEXT_MIN = 20
export const REPORT_TEXT_MAX = 4000

// Retain the full report in description; derive only the short list heading.
export function titleFromDescription(description: string) {
  const text = description.replace(/\s+/g, " ").trim()
  if (text.length < 8) return text ? `Reported issue: ${text}` : "Campus facility issue"
  if (text.length <= 120) return text
  const prefix = text.slice(0, 117).replace(/[\uD800-\uDBFF]$/, "")
  return `${prefix.replace(/\s+\S*$/, "") || prefix}...`
}
