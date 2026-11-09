"use client"

import { useState, type FormEvent } from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function InitialPasswordPage() {
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true); setError("")
    try {
      const response = await fetch("/api/account/change-initial-password", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to change your password.")
      await signOut({ callbackUrl: "/login" })
    } catch (error) { setError(error instanceof Error ? error.message : "Please try again."); setBusy(false) }
  }
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
