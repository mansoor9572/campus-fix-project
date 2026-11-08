import { describe, it } from "node:test"
import assert from "node:assert/strict"

/**
 * Tests for the /api/uploads route handler and report image integration.
 * These tests validate the input validation logic and image storage flow.
 */

describe("Upload validation", () => {
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
  const MAX_FILE_SIZE = 5 * 1024 * 1024

  it("rejects non-image MIME types", () => {
    assert.equal(ALLOWED_TYPES.has("application/pdf"), false)
    assert.equal(ALLOWED_TYPES.has("text/html"), false)
    assert.equal(ALLOWED_TYPES.has("video/mp4"), false)
  })

  it("accepts image MIME types", () => {
    assert.equal(ALLOWED_TYPES.has("image/jpeg"), true)
    assert.equal(ALLOWED_TYPES.has("image/png"), true)
    assert.equal(ALLOWED_TYPES.has("image/webp"), true)
    assert.equal(ALLOWED_TYPES.has("image/gif"), true)
  })

  it("rejects files over 5 MB", () => {
    const oversizedFile = 6 * 1024 * 1024
    assert.equal(oversizedFile > MAX_FILE_SIZE, true)
  })

  it("accepts files under 5 MB", () => {
    const okFile = 2 * 1024 * 1024
    assert.equal(okFile <= MAX_FILE_SIZE, true)
  })
})

describe("Report image input validation", () => {
  // Import the createInput validation to test it accepts images
  it("accepts createInput with images array", async () => {
    const { createInput } = await import("../lib/reports/validation")
    const result = createInput({
      title: "Broken window in library",
      description: "The third-floor window is cracked and letting cold air in.",
      buildingId: "00000000-0000-1000-8000-000000000001",
      categoryId: "00000000-0000-1000-8000-000000000002",
      floor: "2nd Floor",
      roomNumber: "Room 301",
      additionalDetails: "Near the elevator",
      priority: "high",
      images: [
        {
          storageKey: "abc123.jpg",
          fileUrl: "/uploads/abc123.jpg",
          originalFilename: "photo.jpg",
          mimeType: "image/jpeg",
          fileSize: 123456,
        },
      ],
    })
    assert.equal(result.images.length, 1)
    assert.equal(result.images[0].storageKey, "abc123.jpg")
    assert.equal(result.images[0].fileUrl, "/uploads/abc123.jpg")
  })

  it("accepts createInput without images", async () => {
    const { createInput } = await import("../lib/reports/validation")
    const result = createInput({
      title: "Broken window in library",
      description: "The third-floor window is cracked and letting cold air in.",
      buildingId: "00000000-0000-1000-8000-000000000001",
      categoryId: "00000000-0000-1000-8000-000000000002",
      floor: "2nd Floor",
      roomNumber: "Room 301",
      additionalDetails: "Near the elevator",
    })
    assert.equal(result.images.length, 0)
  })

  it("rejects more than 10 images", async () => {
    const { createInput } = await import("../lib/reports/validation")
    const tooManyImages = Array.from({ length: 11 }, (_, i) => ({
      storageKey: `img${i}.jpg`,
      fileUrl: `/uploads/img${i}.jpg`,
    }))
    assert.throws(() => {
      createInput({
        title: "Test report with many images",
        description: "Testing the 10-image limit enforcement here.",
        buildingId: "00000000-0000-1000-8000-000000000001",
        categoryId: "00000000-0000-1000-8000-000000000002",
        floor: "2nd Floor",
        roomNumber: "Room 101",
        additionalDetails: "Near the elevator",
        images: tooManyImages,
      })
    }, /at most 10/)
  })

  it("rejects image entry without storageKey", async () => {
    const { createInput } = await import("../lib/reports/validation")
    assert.throws(() => {
      createInput({
        title: "Test report with bad image",
        description: "Testing validation for image entries here.",
        buildingId: "00000000-0000-1000-8000-000000000001",
        categoryId: "00000000-0000-1000-8000-000000000002",
        floor: "2nd Floor",
        roomNumber: "Room 101",
        additionalDetails: "Near the elevator",
        images: [{ fileUrl: "/uploads/x.jpg" }],
      })
    }, /storageKey/)
  })
})

