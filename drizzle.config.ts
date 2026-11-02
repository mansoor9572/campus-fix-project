import { config } from "dotenv"
import type { Config } from "drizzle-kit"

// Load .env.local (Next.js convention)
config({ path: ".env.local" })

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
