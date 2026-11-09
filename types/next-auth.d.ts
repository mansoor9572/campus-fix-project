import type { DefaultSession } from "next-auth"
import type { UserRole } from "@/lib/db/schema"
declare module "next-auth" {
  interface Session { user: DefaultSession["user"] & { id: string; role: UserRole; mustChangePassword?: boolean } }
  interface User { role?: UserRole; sessionId?: string; sessionExpires?: number; credentialVersion?: string }
}
declare module "next-auth/jwt" {
  interface JWT { sid?: string; role?: UserRole; sessionExpires?: number; credentialVersion?: string; mustChangePassword?: boolean }
}
