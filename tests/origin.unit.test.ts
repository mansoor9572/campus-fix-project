import test from "node:test"
import assert from "node:assert/strict"
import { resolveAppOrigin } from "../lib/auth/origin"
import { readMutation, accountError } from "../lib/auth/json-request"
import { AuthInputError } from "../lib/auth/validation"

test("production origin falls back to trusted deployment settings instead of localhost", () => {
  assert.equal(resolveAppOrigin({ NODE_ENV: "production", AUTH_URL: "https://campus.example/" }), "https://campus.example")
  assert.equal(resolveAppOrigin({ NODE_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "campus.vercel.app" }), "https://campus.vercel.app")
  assert.equal(resolveAppOrigin({ NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "campus.vercel.app", VERCEL_URL: "campus-preview.vercel.app" }), "https://campus-preview.vercel.app")
  assert.equal(resolveAppOrigin({ NODE_ENV: "development" }), "http://localhost:3000")
})

test("explicit configuration has priority and unsafe origins return a helpful error", () => {
  assert.equal(resolveAppOrigin({ NODE_ENV: "production", APP_URL: " https://campus.example/ ", AUTH_URL: "https://other.example" }), "https://campus.example")
  for (const value of [undefined, "http://localhost:3000", "https://user:secret@campus.example", "https://campus.example/admin", "https://campus.example?secret=value", "not a URL"]) {
    assert.throws(() => resolveAppOrigin({ NODE_ENV: "production", APP_URL: value }), error => error instanceof AuthInputError && error.status === 503 && error.message.includes("APP_URL"))
  }
})

test("worker mutations accept the configured origin and still reject other origins", async () => {
  const old = process.env.APP_URL
  process.env.APP_URL = "https://campus.example"
  try {
    const request = (origin: string) => new Request("https://campus.example/api/admin/team", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ name: "Worker" }) })
    assert.deepEqual(await readMutation(request("https://campus.example")), { name: "Worker" })
    await assert.rejects(() => readMutation(request("https://attacker.example")), error => error instanceof AuthInputError && error.status === 403)
    const response = accountError(new AuthInputError("Application URL configuration is invalid. Set APP_URL.", 503))
    assert.equal(response.status, 503)
    assert.match((await response.json()).message, /APP_URL/)
  } finally { if (old === undefined) delete process.env.APP_URL; else process.env.APP_URL = old }
})
