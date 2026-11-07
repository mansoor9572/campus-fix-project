import { randomUUID } from "crypto"
import { writeFile, mkdir } from "fs/promises"
import { join, extname } from "path"
import { authorizeApi } from "@/lib/auth/authorization"

export const runtime = "nodejs"

// Allowed image MIME types
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

// Map MIME type to file extension
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

export async function POST(request: Request) {
  const authResult = await authorizeApi()
  if (authResult.error) return authResult.error

  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return Response.json(
        { message: "No file provided. Send a file in the 'file' field." },
        { status: 400 }
      )
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json(
        { message: "Invalid file type. Accepted: JPEG, PNG, WebP, GIF." },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { message: "File too large. Maximum size is 5 MB." },
        { status: 400 }
      )
    }

    // Generate a unique storage key
    const id = randomUUID()
    const ext = MIME_TO_EXT[file.type] || extname(file.name) || ".jpg"
    const storageKey = `${id}${ext}`

    // Write file to disk (or fallback to data URL if filesystem is read-only in serverless)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    try {
      // Ensure uploads directory exists
      const uploadsDir = join(process.cwd(), "public", "uploads")
      await mkdir(uploadsDir, { recursive: true })

      const filePath = join(uploadsDir, storageKey)
      await writeFile(filePath, buffer)

      // Public URL for the uploaded file
      const fileUrl = `/uploads/${storageKey}`

      return Response.json(
        {
          id,
          storageKey,
          fileUrl,
          originalFilename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        },
        { status: 201 }
      )
    } catch (writeErr) {
      console.warn("Local uploads directory write failed, falling back to base64 data URL:", writeErr)
      const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`
      return Response.json(
        {
          id,
          storageKey,
          fileUrl: dataUrl,
          originalFilename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        },
        { status: 201 }
      )
    }
  } catch (error) {
    console.error("Upload error:", error)
    return Response.json(
      { message: "Failed to upload file." },
      { status: 500 }
    )
  }
}

