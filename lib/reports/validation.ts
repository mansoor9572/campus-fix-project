import { statusLabels, priorityLabels } from "./policy"
import type { ReportStatus, Priority } from "@/lib/db/schema"
import { LOCATION_LIMITS } from "./location"

export class ReportError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export function uuid(value: unknown, field = "ID"): string {
  if (typeof value !== "string" || !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value)) throw new ReportError(`Invalid ${field}.`)
  return value
}
export function textField(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max || /\u0000/.test(value)) throw new ReportError(`${field} must contain ${min}–${max} characters.`)
  return value.trim()
}
function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ReportError("Expected a JSON object.")
  return input as Record<string, unknown>
}
function keys(input: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new ReportError("Unsupported field in request.")
}
function enumValue<T extends string>(value: unknown, options: Record<T, string>, name: string): T {
  if (typeof value !== "string") throw new ReportError(`Invalid ${name}.`)
  if (Object.hasOwn(options, value)) return value as T
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_")
  if (Object.hasOwn(options, normalized)) return normalized as T
  // Also check if value matches any label value
  for (const [k, v] of Object.entries(options)) {
    if (typeof v === "string" && v.toLowerCase() === value.toLowerCase()) return k as T
  }
  throw new ReportError(`Invalid ${name}.`)
}
export function createInput(raw: unknown) {
  const input = object(raw)
  keys(input, ["title", "description", "buildingId", "categoryId", "floor", "roomNumber", "additionalDetails", "priority", "images"])
  // Validate optional images array: each entry must have storageKey, fileUrl, originalFilename, mimeType, fileSize
  let images: Array<{ storageKey: string; fileUrl: string; originalFilename: string; mimeType: string; fileSize: number }> = []
  if (input.images !== undefined) {
    if (!Array.isArray(input.images) || input.images.length > 10) throw new ReportError("Images must be an array of at most 10 items.")
    images = (input.images as Array<Record<string, unknown>>).map((img, i) => {
      if (!img || typeof img !== "object") throw new ReportError(`Image ${i + 1} is invalid.`)
      if (typeof img.storageKey !== "string" || !img.storageKey) throw new ReportError(`Image ${i + 1} missing storageKey.`)
      if (typeof img.fileUrl !== "string" || !img.fileUrl) throw new ReportError(`Image ${i + 1} missing fileUrl.`)
      return {
        storageKey: img.storageKey as string,
        fileUrl: img.fileUrl as string,
        originalFilename: (typeof img.originalFilename === "string" ? img.originalFilename : "photo.jpg"),
        mimeType: (typeof img.mimeType === "string" ? img.mimeType : "image/jpeg"),
        fileSize: (typeof img.fileSize === "number" ? img.fileSize : 0),
      }
    })
  }
  return { title: textField(input.title, "Title", 8, 120), description: textField(input.description, "Description", 20, 4000),
    floor: textField(input.floor, "Floor", 1, LOCATION_LIMITS.floor),
    roomNumber: textField(input.roomNumber, "Room number", 1, LOCATION_LIMITS.roomNumber),
    additionalDetails: input.additionalDetails === undefined ? "" : textField(input.additionalDetails, "Additional details", 0, LOCATION_LIMITS.additionalDetails),
    buildingId: uuid(input.buildingId, "building"), categoryId: uuid(input.categoryId, "category"),
    priority: input.priority === undefined ? "medium" as Priority : enumValue(input.priority, priorityLabels, "priority"),
    images }
}
export type ReportPatchInput = { version: string; status?: ReportStatus; priority?: Priority; title?: string; description?: string; room?: string; floor?: string; roomNumber?: string; additionalDetails?: string; buildingId?: string; categoryId?: string; departmentId?: string | null; assignedStaffId?: string | null; note?: string }
export function patchInput(raw: unknown): ReportPatchInput {
  const input = object(raw)
  keys(input, ["version", "status", "priority", "title", "description", "room", "floor", "roomNumber", "additionalDetails", "buildingId", "categoryId", "departmentId", "assignedStaffId", "note"])
  const output: ReportPatchInput = { version: textField(input.version, "Version", 10, 60) }
  if (Object.keys(input).every(key => key === "version" || key === "note")) throw new ReportError("No report change supplied.")
  if (input.status !== undefined) output.status = enumValue(input.status, statusLabels, "status")
  if (input.priority !== undefined) output.priority = enumValue(input.priority, priorityLabels, "priority")
  if (input.title !== undefined) output.title = textField(input.title, "Title", 8, 120)
  if (input.description !== undefined) output.description = textField(input.description, "Description", 20, 4000)
  if (input.room !== undefined) output.room = textField(input.room, "Location", 2, 120)
  if (input.floor !== undefined) output.floor = textField(input.floor, "Floor", 1, LOCATION_LIMITS.floor)
  if (input.roomNumber !== undefined) output.roomNumber = textField(input.roomNumber, "Room number", 1, LOCATION_LIMITS.roomNumber)
  if (input.additionalDetails !== undefined) output.additionalDetails = textField(input.additionalDetails, "Additional details", 0, LOCATION_LIMITS.additionalDetails)
  if (input.room !== undefined && (input.floor !== undefined || input.roomNumber !== undefined)) throw new ReportError("Use the separate floor and room number fields.")
  for (const key of ["buildingId", "categoryId"] as const) if (input[key] !== undefined) output[key] = uuid(input[key], key)
  for (const key of ["departmentId", "assignedStaffId"] as const) if (input[key] !== undefined) output[key] = input[key] === null ? null : uuid(input[key], key)
  if (input.note !== undefined) output.note = textField(input.note, "Note", 4, 1000)
  return output
}
export function noteInput(raw: unknown) {
  const input = object(raw)
  keys(input, ["message", "isPublic", "version"])
  if (input.isPublic !== undefined && typeof input.isPublic !== "boolean") throw new ReportError("Invalid note visibility.")
  return { message: textField(input.message, "Note", 4, 1000), isPublic: input.isPublic !== false, version: textField(input.version, "Version", 10, 60) }
}
export function listInput(params: URLSearchParams) {
  const allowed = ["page", "pageSize", "q", "status", "priority", "buildingId", "categoryId", "days", "sort"]
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length > 1) throw new ReportError("Unsupported query parameter.")
  const positive = (name: string, fallback: number, max: number) => {
    const value = params.get(name)
    if (value === null) return fallback
    if (!/^\d+$/.test(value) || +value < 1 || +value > max) throw new ReportError(`Invalid ${name}.`)
    return +value
  }
  const q = params.get("q")?.trim() || ""
  if (q.length > 100) throw new ReportError("Search must be at most 100 characters.")
  const days = params.get("days") || "all"
  if (!["all", "7", "30"].includes(days)) throw new ReportError("Invalid date range.")
  const sort = params.get("sort") || "newest"
  if (!["newest", "priority"].includes(sort)) throw new ReportError("Invalid sort.")
  return { page: positive("page", 1, 100000), pageSize: positive("pageSize", 20, 100), q, days, sort,
    status: params.has("status") ? enumValue(params.get("status"), statusLabels, "status") : undefined,
    priority: params.has("priority") ? enumValue(params.get("priority"), priorityLabels, "priority") : undefined,
    buildingId: params.has("buildingId") ? uuid(params.get("buildingId"), "building") : undefined,
    categoryId: params.has("categoryId") ? uuid(params.get("categoryId"), "category") : undefined }
}
