import "server-only"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db, users, accounts, sessions, verificationTokens } from "@/lib/db"
import { authenticate, readSession, revokeSession } from "@/lib/auth/service"
import { SESSION_MAX_AGE } from "@/lib/auth/policy"
import { privateKey } from "@/lib/auth/crypto"

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  privateKey("configuration-check")
  return {
    adapter: DrizzleAdapter(db, { usersTable: users, accountsTable: accounts, sessionsTable: sessions, verificationTokensTable: verificationTokens }),
    // beta.32 Credentials explicitly requires JWT. The existing sessions table
    // supplies revocation/absolute expiry; Auth.js handles encrypted cookies and CSRF.
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
    pages: { signIn: "/login", error: "/login" },
    providers: [Credentials({
      credentials: { email: {}, password: {}, remember: {} },
      async authorize(credentials) {
        return authenticate(credentials)
      },
    })],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.sid = user.sessionId
          token.sessionExpires = user.sessionExpires
          token.credentialVersion = user.credentialVersion
        }
        if (typeof token.sid !== "string" || typeof token.credentialVersion !== "string") return null
        const current = await readSession(token.sid, token.credentialVersion)
        if (!current) return null
        token.sub = current.id
        token.name = current.name
        token.email = current.email
        token.picture = current.image
        token.role = current.role
        token.sessionExpires = current.expires.getTime()
        return token
      },
      async session({ session, token }) {
        if (token.role !== "student" && token.role !== "admin" && token.role !== "maintenance_staff") throw new Error("Invalid role")
        if (typeof token.sessionExpires !== "number") throw new Error("Invalid session expiry")
        return { ...session, user: { ...session.user, id: token.sub!, role: token.role }, expires: new Date(token.sessionExpires).toISOString() }
      },
    },
    events: {
      async signOut(message) {
        if ("token" in message && typeof message.token?.sid === "string") await revokeSession(message.token.sid)
      },
    },
    // Do not log credential payloads, SQL parameters, or token-bearing URLs.
    logger: {
      error(error) {
        // JWTSessionError occurs normally when an unauthenticated visitor has a stale/expired cookie.
        // CredentialsSignin occurs normally when wrong credentials are submitted.
        // We log these non-fatal client states as warnings so they don't trigger the Next.js dev error overlay.
        const errorName = error.name || (error as { type?: string }).type
        if (errorName === "JWTSessionError") {
          const cause = (error as { cause?: { err?: Error } })?.cause?.err
          if (cause && cause.name !== "JWEInvalid" && cause.name !== "JWEDecryptionFailed" && cause.message !== "Invalid JWT") {
            console.error("Authentication session error:", cause.name || errorName)
          } else {
            console.warn("Auth: Cleared invalid or expired session cookie.")
          }
          return
        }
        if (errorName === "CredentialsSignin" || errorName === "SignInError") {
          console.warn("Auth: Invalid credentials submitted.")
          return
        }
        console.error("Authentication request failed:", errorName)
      },
    },
  }
})
