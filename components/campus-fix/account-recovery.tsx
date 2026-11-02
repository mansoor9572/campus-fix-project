"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { AuthBrandPanel } from "./public-pages"
import { accountRequest } from "@/lib/auth/client"

export function AccountRecoveryPage({ action }: { action: "forgot-password" | "reset-password" | "verify-email" | "resend-verification" }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [token, setToken] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const needsToken = action === "reset-password" || action === "verify-email"
  const title = { "forgot-password": "Forgot password?", "reset-password": "Choose a new password", "verify-email": "Verify your email", "resend-verification": "Resend verification" }[action]

  useEffect(() => {
    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token")
    if (!fragmentToken) return
    // Synchronize the browser-only fragment after hydration, then remove the secret from history.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(fragmentToken)
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setPending(true)
    try {
      const result = await accountRequest(action, { email, token, password, confirmPassword })
      setMessage(result.message)
      setPassword("")
      setConfirmPassword("")
    } catch (error) { setError(error instanceof Error ? error.message : "Please try again.") }
    finally { setPending(false) }
  }

  return <main className="auth-shell">
    <AuthBrandPanel />
    <section className="auth-form-side"><div className="auth-form-wrap">
      <h2>{title}</h2>
      <p className="auth-subtitle">{needsToken ? "Use the link from your email to continue." : "Enter the email address you used to register."}</p>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {message ? <div className="register-success" role="status">{message}</div> : <form className="auth-form" onSubmit={submit}>
        {!needsToken && <Field><FieldLabel htmlFor="recovery-email">Campus email</FieldLabel><Input id="recovery-email" className="form-control" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></Field>}
        {needsToken && !token && <p role="alert">The link is missing its token. Open your email link again or request a new one below.</p>}
        {action === "reset-password" && <>
          <Field><FieldLabel htmlFor="new-password">New password</FieldLabel><Input id="new-password" className="form-control" type="password" autoComplete="new-password" minLength={12} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} required /></Field>
          <Field><FieldLabel htmlFor="confirm-new-password">Confirm password</FieldLabel><Input id="confirm-new-password" className="form-control" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></Field>
          <p>Use at least 12 characters (at most 72 UTF-8 bytes).</p>
        </>}
        <Button className="auth-submit" type="submit" disabled={pending || (needsToken && !token)}>{pending ? "Please wait…" : action === "verify-email" ? "Verify email" : action === "reset-password" ? "Reset password" : "Send link"}</Button>
      </form>}
      <p className="auth-switch"><Link className="text-link" href="/login">Back to sign in</Link></p>
      {needsToken && <p className="auth-switch"><Link className="text-link" href={action === "verify-email" ? "/resend-verification" : "/forgot-password"}>Request a new link</Link></p>}
    </div></section>
  </main>
}
