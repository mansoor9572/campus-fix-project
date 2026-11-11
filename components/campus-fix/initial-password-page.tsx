"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function InitialPasswordPage() {
  const { status } = useSession()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [saved, setSaved] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true); setError("")
    try {
      const response = await fetch("/api/account/change-initial-password", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)),
      })
      if (response.status === 401) {
        form.reset()
        setSessionExpired(true)
        setBusy(false)
        return
      }
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to change your password.")
      // Saving already revokes the user's sessions. Do not make success depend
      // on another sign-out request, or leave the old form available to retry.
      form.reset()
      setSaved(true)
    } catch (error) { setError(error instanceof Error ? error.message : "Please try again."); setBusy(false) }
  }
  if (saved) return <main className="team-password-page"><section className="portal-card team-password-card">
    <h1>Password changed</h1>
    <p role="status">Your new password is saved. Sign in with it to open your workspace.</p>
    <Link className="button-link button-link-primary" href="/login" prefetch={false}>Sign in with new password</Link>
  </section></main>
  if (sessionExpired || status === "unauthenticated") return <main className="team-password-page"><section className="portal-card team-password-card">
    <h1>Sign in again to continue</h1>
    <p role="alert">Your sign-in session ended. This can happen if an administrator resets your password or signs you out.</p>
    <p>Use the latest temporary password from your administrator. If you already changed it successfully, use your new password.</p>
    <Link className="button-link button-link-primary" href="/login" prefetch={false}>Sign in again</Link>
  </section></main>
  return <main className="team-password-page"><section className="portal-card team-password-card">
    <h1>Choose your own password</h1>
    <p>Your administrator created your account with a temporary password. Replace it before opening your workspace.</p>
    <form onSubmit={submit} className="team-form">
      <label>Temporary password<input className="form-control" name="currentPassword" type="password" autoComplete="current-password" required /></label>
      <label>New password<input className="form-control" name="password" type="password" autoComplete="new-password" minLength={12} required /></label>
      <label>Confirm new password<input className="form-control" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required /></label>
      <p>Use at least 12 characters. You will sign in again after changing your password.</p>
      {error && <p role="alert" className="field-error">{error}</p>}
      <Button disabled={busy} type="submit">{busy ? "Saving…" : "Change password"}</Button>
      <Button type="button" variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</Button>
    </form>
  </section></main>
}
