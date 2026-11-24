import { ID_DICTIONARY } from "./id"

export type { Language } from "./config"

const MONTHS: Record<string, string> = {
  Jan: "Jan", Feb: "Feb", Mar: "Mar", Apr: "Apr", May: "Mei", Jun: "Jun",
  Jul: "Jul", Aug: "Agu", Sep: "Sep", Oct: "Okt", Nov: "Nov", Dec: "Des",
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").replace(/[’‘]/g, "'").trim()
}

const dictionary = new Map(Object.entries(ID_DICTIONARY).map(([en, id]) => [normalize(en), id]))

function lookup(text: string): string | undefined {
  const exact = dictionary.get(text)
  if (exact !== undefined) return exact
  // Same label used with or without a trailing period/colon.
  const punctuation = text.match(/[.:]$/)?.[0]
  if (!punctuation) return undefined
  const bare = dictionary.get(text.slice(0, -1))
  return bare === undefined ? undefined : bare + punctuation
}

/** Translate a phrase that may itself be a dictionary entry (used inside patterns). */
function inner(text: string) {
  return lookup(normalize(text)) ?? text
}

function formatTime(hour: string, minute: string, meridiem: string) {
  let h = Number(hour) % 12
  if (meridiem === "PM") h += 12
  return `${String(h).padStart(2, "0")}.${minute}`
}

const PATTERNS: Array<[RegExp, (...groups: string[]) => string]> = [
  // Dates produced by Intl "en-US": "Nov 24" and "Nov 24, 10:30 AM"
  [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})(?:, (\d{4}))?$/, (m, d, y) => `${d} ${MONTHS[m]}${y ? ` ${y}` : ""}`],
  [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{1,2}):(\d{2}) (AM|PM)$/, (m, d, h, min, ap) => `${d} ${MONTHS[m]}, ${formatTime(h, min, ap)}`],
  [/^Good morning, (.+)$/, (name) => `Selamat pagi, ${name}`],
  [/^Welcome back, (.+?)\. Here's the campus service picture today\.$/, (name) => `Selamat datang kembali, ${name}. Berikut gambaran layanan kampus hari ini.`],
  [/^Status updated to (.+)\.$/, (s) => `Status diperbarui menjadi ${inner(s)}.`],
  [/^Priority updated to (.+)\.$/, (s) => `Prioritas diperbarui menjadi ${inner(s)}.`],
  [/^Category updated to (.+)\.$/, (s) => `Kategori diperbarui menjadi ${inner(s)}.`],
  [/^Task status changed to (.+)\.$/, (s) => `Status tugas diubah menjadi ${inner(s)}.`],
  [/^Manage assignment, priority, and progress for (.+)\.$/, (id) => `Kelola penugasan, prioritas, dan progres untuk ${id}.`],
  [/^Photo attached to (.+)$/, (id) => `Foto terlampir pada ${id}`],
  [/^Work started on (.+)\.$/, (id) => `Pekerjaan dimulai pada ${id}.`],
  [/^View task (.+)$/, (id) => `Lihat tugas ${id}`],
  [/^Work order (\S+) · (.+)$/, (id, rest) => `Perintah kerja ${id} · ${rest}`],
  [/^Completion evidence for (.+)$/, (id) => `Bukti penyelesaian untuk ${id}`],
  [/^Describe the issue in (\d+) to (\d+) characters\.$/, (a, b) => `Jelaskan masalah dalam ${a} sampai ${b} karakter.`],
  [/^Preview of (.+)$/, (name) => `Pratinjau ${name}`],
  [/^Follow the progress on (.+)\.$/, (id) => `Ikuti progres ${id}.`],
  [/^Last updated (.+)$/, (date) => `Terakhir diperbarui ${translateText(date)}`],
  [/^You have (\d+) unread updates?\.$/, (n) => `Anda memiliki ${n} pembaruan yang belum dibaca.`],
  [/^Deactivate (.+)\? They will be signed out and unable to log in\.$/, (name) => `Nonaktifkan ${name}? Akun ini akan dikeluarkan dan tidak dapat masuk lagi.`],
  [/^(\d+) open tasks?$/, (n) => `${n} tugas terbuka`],
  [/^Notifications, (\d+) unread$/, (n) => `Notifikasi, ${n} belum dibaca`],
  [/^Powered by (.+)$/, (rest) => `Didukung oleh ${rest}`],
  [/^(\d+) unread$/, (n) => `${n} belum dibaca`],
  [/^(\d+) reports?$/, (n) => `${n} laporan`],
  [/^(\d+) tasks?$/, (n) => `${n} tugas`],
]

/** Return the Indonesian version of an English UI string, or the string unchanged when unknown. */
export function translateText(source: string): string {
  const text = normalize(source)
  if (!text) return source
  const lead = source.match(/^\s*/)?.[0] ?? ""
  const trail = source.match(/\s*$/)?.[0] ?? ""

  const direct = lookup(text)
  if (direct !== undefined) return lead + direct + trail

  for (const [pattern, build] of PATTERNS) {
    const match = text.match(pattern)
    if (match) return lead + build(...match.slice(1)) + trail
  }

  // Composite labels such as "Environmental Science · Class of 2027".
  if (text.includes(" · ")) {
    const parts = text.split(" · ")
    const translated = parts.map((part) => translateText(part))
    if (translated.some((part, index) => part !== parts[index])) return lead + translated.join(" · ") + trail
  }

  return source
}
