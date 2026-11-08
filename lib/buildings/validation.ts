import { ReportError, textField } from "@/lib/reports/validation"

export function buildingInput(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ReportError("Expected a building object.")
  const data = raw as Record<string, unknown>
  const allowed = ["name", "code", "indonesianName", "aliases", "faculty", "buildingType", "description", "mapsUrl", "latitude", "longitude", "verificationStatus", "sourceUrl", "isActive"]
  if (Object.keys(data).some(key => !allowed.includes(key))) throw new ReportError("Unsupported building field.")
  const optional = (key: string, max: number) => data[key] == null ? null : textField(data[key], key, 0, max) || null
  const url = (key: string, maps = false) => {
    const value = optional(key, 1000)
    if (!value) return null
    let parsed: URL
    try { parsed = new URL(value) } catch { throw new ReportError(`Invalid ${key}.`) }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new ReportError(`${key} must use HTTPS without embedded credentials.`)
    if (maps && !["maps.google.com", "www.google.com", "google.com", "maps.app.goo.gl", "goo.gl"].includes(parsed.hostname)) throw new ReportError("Use a Google Maps link.")
    return value
  }
  const status = data.verificationStatus ?? "unverified"
  if (!["verified", "unverified", "historical"].includes(String(status))) throw new ReportError("Invalid verification status.")
  if (data.isActive !== undefined && typeof data.isActive !== "boolean") throw new ReportError("Invalid active status.")
  const aliases = data.aliases ?? []
  if (!Array.isArray(aliases) || aliases.length > 30) throw new ReportError("Use at most 30 alternative names.")
  const coordinate = (key: string, limit: number) => {
    if (data[key] == null || data[key] === "") return null
    if (typeof data[key] !== "number" || !Number.isFinite(data[key]) || Math.abs(data[key] as number) > limit) throw new ReportError(`Invalid ${key}.`)
    return data[key] as number
  }
  const latitude = coordinate("latitude", 90), longitude = coordinate("longitude", 180)
  if ((latitude === null) !== (longitude === null)) throw new ReportError("Supply both coordinates or neither.")
  if (latitude !== null && status !== "verified") throw new ReportError("Coordinates require a verified location.")
  const sourceUrl = url("sourceUrl")
  if (status === "verified" && !sourceUrl) throw new ReportError("Add an authoritative source URL before marking a building verified.")
  return { name: textField(data.name, "Building name", 2, 160), code: optional("code", 30),
    indonesianName: optional("indonesianName", 160), aliases: [...new Set(aliases.map(value => textField(value, "Alternative name", 1, 120)))],
    faculty: optional("faculty", 160), buildingType: optional("buildingType", 80), description: optional("description", 1000),
    mapsUrl: url("mapsUrl", true), latitude, longitude, verificationStatus: String(status), sourceUrl, isActive: data.isActive !== false }
}
