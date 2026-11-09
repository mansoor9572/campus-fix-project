import { AuthInputError } from "./validation"

type OriginEnvironment = Record<string, string | undefined>

export function resolveAppOrigin(env: OriginEnvironment): string {
  const configured = env.APP_URL?.trim() || env.AUTH_URL?.trim()
  // These hostnames come from deployment configuration, never request headers.
  const deploymentHost = env.VERCEL_ENV === "preview"
    ? env.VERCEL_URL?.trim()
    : env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_URL?.trim()
  const value = configured || (deploymentHost ? `https://${deploymentHost}` : env.NODE_ENV !== "production" ? "http://localhost:3000" : "")
  try {
    const url = new URL(value)
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid origin")
    if (!["http:", "https:"].includes(url.protocol) || (env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error("Invalid protocol")
    return url.origin
  } catch {
    throw new AuthInputError("Application URL configuration is invalid. Set APP_URL to this website's HTTPS origin in Vercel, then redeploy.", 503)
  }
}
