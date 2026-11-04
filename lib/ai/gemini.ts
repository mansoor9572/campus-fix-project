import { GoogleGenAI } from "@google/genai"
import type { AiTriageResult } from "./types"

const VALID_CATEGORIES = [
  "HVAC",
  "Electrical",
  "Plumbing",
  "IT & AV",
  "Furniture",
  "Safety",
  "Cleaning",
  "Lighting",
  "Doors & Windows",
  "Wi-Fi & Network",
  "Other",
] as const

const VALID_DEPARTMENTS = [
  "Facilities Services",
  "Electrical Services",
  "Plumbing Services",
  "Campus IT",
  "Campus Safety",
  "Housekeeping",
] as const

export type AnalyzeInput = {
  title: string
  description: string
  building?: string
  room?: string
  image?: {
    base64: string
    mimeType: string
  }
}

/**
 * Intelligent deterministic fallback when GEMINI_API_KEY is not configured
 */
function localRuleBasedTriage(input: AnalyzeInput): AiTriageResult {
  const combined = `${input.title} ${input.description} ${input.room || ""}`.toLowerCase()

  let category = "Other"
  let department = "Facilities Services"
  let priority: "low" | "medium" | "high" = "low"
  let object = "general facility fixture"
  let confidence = 0.82

  if (combined.includes("fire") || combined.includes("hazard") || combined.includes("emergency") || combined.includes("danger") || combined.includes("alarm") || combined.includes("slip hazard")) {
    category = "Safety"
    department = "Campus Safety"
    object = "safety equipment or hazard zone"
    priority = "high"
    confidence = 0.95
  } else if (combined.includes("spark") || combined.includes("shock") || combined.includes("exposed wire") || combined.includes("smoke") || combined.includes("power outage") || combined.includes("circuit breaker") || combined.includes("electrical")) {
    category = "Electrical"
    department = "Electrical Services"
    object = "electrical outlet / wiring / breaker"
    priority = "high"
    confidence = 0.94
  } else if (combined.includes("ac") || combined.includes("air conditioning") || combined.includes("hvac") || combined.includes("thermostat") || combined.includes("heating") || combined.includes("cooling") || combined.includes("ventilation")) {
    category = "HVAC"
    department = "Facilities Services"
    object = "HVAC cooling / heating unit"
    priority = combined.includes("leak") || combined.includes("freeze") ? "high" : "medium"
    confidence = 0.90
  } else if (combined.includes("leak") || combined.includes("water") || combined.includes("pipe") || combined.includes("faucet") || combined.includes("toilet") || combined.includes("sink") || combined.includes("drain") || combined.includes("flood")) {
    category = "Plumbing"
    department = "Plumbing Services"
    object = "plumbing fixtures or water lines"
    priority = combined.includes("flood") || combined.includes("burst") || combined.includes("gushing") ? "high" : "medium"
    confidence = 0.91
  } else if (combined.includes("wifi") || combined.includes("wi-fi") || combined.includes("internet") || combined.includes("router") || combined.includes("ethernet") || combined.includes("network")) {
    category = "Wi-Fi & Network"
    department = "Campus IT"
    object = "wireless access point / network switch"
    priority = "medium"
    confidence = 0.90
  } else if (combined.includes("projector") || combined.includes("screen") || combined.includes("audio") || combined.includes("mic") || combined.includes("speaker") || combined.includes("hdmi") || combined.includes("display")) {
    category = "IT & AV"
    department = "Campus IT"
    object = "AV projector / media system"
    priority = "medium"
    confidence = 0.88
  } else if (combined.includes("light") || combined.includes("bulb") || combined.includes("lamp") || combined.includes("ballast") || combined.includes("flicker")) {
    category = "Lighting"
    department = "Electrical Services"
    object = "light fixture / ballast"
    priority = "low"
    confidence = 0.87
  } else if (combined.includes("door") || combined.includes("window") || combined.includes("lock") || combined.includes("handle") || combined.includes("hinge") || combined.includes("glass")) {
    category = "Doors & Windows"
    department = "Facilities Services"
    object = "door lock / window frame"
    priority = combined.includes("lock") || combined.includes("broken glass") ? "high" : "medium"
    confidence = 0.88
  } else if (combined.includes("trash") || combined.includes("spill") || combined.includes("dirty") || combined.includes("clean") || combined.includes("stain") || combined.includes("garbage") || combined.includes("mess")) {
    category = "Cleaning"
    department = "Housekeeping"
    object = "floor / sanitation area"
    priority = "low"
    confidence = 0.86
  } else if (combined.includes("chair") || combined.includes("desk") || combined.includes("table") || combined.includes("bench") || combined.includes("podium")) {
    category = "Furniture"
    department = "Facilities Services"
    object = "classroom furniture"
    priority = "low"
    confidence = 0.85
  }

  return {
    problemSummary: input.title.trim(),
    detectedObject: object,
    suggestedCategory: category,
    suggestedPriority: priority,
    recommendedDepartment: department,
    generatedDescription: input.description.trim() || `Reported issue regarding ${object}.`,
    confidence,
    requiresHumanReview: true,
    aiProvider: "CampusFix AI Engine (Local)",
    modelName: "rule-triage-v1",
  }
}

/**
 * Perform real-time AI triage on a campus facility issue
 */
export async function triageFacilityIssue(input: AnalyzeInput): Promise<AiTriageResult> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return localRuleBasedTriage(input)
  }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash"

    const systemInstruction = `You are an expert campus facilities engineer and maintenance triage specialist for a university.
Analyze the student or staff report of an issue on campus.
You must respond with valid JSON matching this schema:
{
  "problemSummary": "One concise sentence describing the problem",
  "detectedObject": "Specific physical fixture or item involved (e.g. AC unit, fluorescent tube, door lock, toilet, projector)",
  "suggestedCategory": "Must be exactly one of: ${VALID_CATEGORIES.join(", ")}",
  "suggestedPriority": "Must be exactly one of: low, medium, high",
  "recommendedDepartment": "Must be exactly one of: ${VALID_DEPARTMENTS.join(", ")}",
  "generatedDescription": "Clear, professional, actionable 2-3 sentence technical description of the problem for the maintenance crew",
  "confidence": 0.0 to 1.0 numeric confidence score
}`

    const promptText = `Campus Report to Triage:
Title: ${input.title}
Description: ${input.description}
Building: ${input.building || "Unspecified"}
Room/Location: ${input.room || "Unspecified"}`

    const contents: Array<string | { inlineData: { data: string; mimeType: string } }> = [promptText]

    if (input.image?.base64) {
      contents.push({
        inlineData: {
          data: input.image.base64.replace(/^data:[^;]+;base64,/, ""),
          mimeType: input.image.mimeType || "image/jpeg",
        },
      })
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    })

    const rawText = response.text || ""
    if (!rawText) {
      return localRuleBasedTriage(input)
    }

    const parsed = JSON.parse(rawText) as {
      problemSummary?: string
      detectedObject?: string
      suggestedCategory?: string
      suggestedPriority?: string
      recommendedDepartment?: string
      generatedDescription?: string
      confidence?: number
    }

    const category = VALID_CATEGORIES.includes(parsed.suggestedCategory as (typeof VALID_CATEGORIES)[number])
      ? (parsed.suggestedCategory as string)
      : "Other"

    const department = VALID_DEPARTMENTS.includes(parsed.recommendedDepartment as (typeof VALID_DEPARTMENTS)[number])
      ? (parsed.recommendedDepartment as string)
      : "Facilities Services"

    const priority: "low" | "medium" | "high" =
      parsed.suggestedPriority === "high" || parsed.suggestedPriority === "medium"
        ? parsed.suggestedPriority
        : "low"

    return {
      problemSummary: parsed.problemSummary || input.title.trim(),
      detectedObject: parsed.detectedObject || "facility fixture",
      suggestedCategory: category,
      suggestedPriority: priority,
      recommendedDepartment: department,
      generatedDescription: parsed.generatedDescription || input.description.trim(),
      confidence: typeof parsed.confidence === "number" ? Math.min(Math.max(parsed.confidence, 0.5), 0.99) : 0.88,
      requiresHumanReview: true,
      aiProvider: "Google Gemini",
      modelName: model,
    }
  } catch (error) {
    console.error("Gemini API call failed, falling back to local triage:", (error as Error).message)
    return localRuleBasedTriage(input)
  }
}
