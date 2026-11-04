import test from "node:test"
import assert from "node:assert/strict"
import { triageFacilityIssue } from "../lib/ai/gemini"

test("AI triage: HVAC issue detection and department routing", async () => {
  const result = await triageFacilityIssue({
    title: "Air conditioning is leaking water",
    description: "The AC unit in Room 302 is dripping water onto student desks.",
    room: "Room 302",
    building: "Science Hall",
  })

  assert.equal(result.suggestedCategory, "HVAC")
  assert.equal(result.recommendedDepartment, "Facilities Services")
  assert.ok(result.confidence > 0.7)
  assert.equal(result.requiresHumanReview, true)
  assert.ok(result.detectedObject.length > 0)
})

test("AI triage: Electrical hazard triggers high priority", async () => {
  const result = await triageFacilityIssue({
    title: "Sparking wall outlet in chemistry lab",
    description: "A plug sparked and smoke was visible near lab bench 4.",
    room: "Lab 201",
  })

  assert.equal(result.suggestedCategory, "Electrical")
  assert.equal(result.suggestedPriority, "high")
  assert.equal(result.recommendedDepartment, "Electrical Services")
  assert.ok(result.confidence > 0.8)
})

test("AI triage: Plumbing leak routing to Plumbing Services", async () => {
  const result = await triageFacilityIssue({
    title: "Bathroom sink faucet broken and leaking",
    description: "Water continuously runs from the faucet and will not shut off.",
  })

  assert.equal(result.suggestedCategory, "Plumbing")
  assert.equal(result.recommendedDepartment, "Plumbing Services")
  assert.ok(result.detectedObject.includes("plumbing"))
})

test("AI triage: Safety hazard classified with high priority", async () => {
  const result = await triageFacilityIssue({
    title: "Emergency exit door is locked and blocked",
    description: "Fire escape path is obstructed by boxes and the exit sign is dark.",
  })

  assert.equal(result.suggestedCategory, "Safety")
  assert.equal(result.suggestedPriority, "high")
  assert.equal(result.recommendedDepartment, "Campus Safety")
})

test("AI triage: IT & AV issues routed to Campus IT", async () => {
  const result = await triageFacilityIssue({
    title: "Classroom projector HDMI port is broken",
    description: "Cannot display slides on the main projector screen.",
  })

  assert.equal(result.suggestedCategory, "IT & AV")
  assert.equal(result.recommendedDepartment, "Campus IT")
})
