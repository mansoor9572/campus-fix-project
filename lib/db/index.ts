import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

if (!process.env.DATABASE_URL) {
  config({ path: ".env.local" })
  config({ path: ".env" })
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Please add it to your .env.local file."
  )
}

const sql = neon(process.env.DATABASE_URL)

export const db = drizzle(sql, { schema })

export type Database = typeof db
export * from "./schema"


