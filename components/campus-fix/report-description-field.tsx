"use client"

import { useEffect, useRef, useState } from "react"
import { LoaderCircle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { REPORT_TEXT_MAX, REPORT_TEXT_MIN } from "@/lib/reports/text"

export function ReportDescriptionField({ value, onChange, error, disabled }: {
  value: string; onChange: (value: string) => void; error?: string; disabled?: boolean
}) {
  const [pending, setPending] = useState(false)
  const [suggestion, setSuggestion] = useState("")
  const [rewriteError, setRewriteError] = useState("")
  const [original, setOriginal] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  useEffect(() => () => requestRef.current?.abort(), [])

  function edit(text: string) {
    requestRef.current?.abort()
    setPending(false); setSuggestion(""); setRewriteError(""); setOriginal(null)
    onChange(text)
  }

  async function rewrite() {
    if (pending || disabled) return
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setPending(true); setSuggestion(""); setRewriteError("")
    try {
      const response = await fetch("/api/reports/rewrite", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || "Unable to rewrite right now. Please try again.")
      if (typeof data.text !== "string" || data.text.trim().length < REPORT_TEXT_MIN || data.text.length > REPORT_TEXT_MAX) throw new Error("The AI suggestion could not be used. Your wording has been kept.")
      if (!controller.signal.aborted) setSuggestion(data.text.trim())
    } catch (error) {
      if (!controller.signal.aborted) setRewriteError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "The rewrite took too long. Your wording has been kept. Please try again.")
    } finally { if (!controller.signal.aborted) setPending(false) }
  }

  return <Field data-invalid={Boolean(error)} className="form-span-2">
    <FieldLabel htmlFor="report-description">What needs attention? <span aria-hidden="true">*</span></FieldLabel>
    <Textarea id="report-description" className="form-control" rows={6} value={value} onChange={event => edit(event.target.value)}
      placeholder="Describe the issue in your own words — what happened, where exactly (e.g. near the elevator, beside the entrance), when you noticed it, and anything the maintenance team should know before arriving."
      required minLength={REPORT_TEXT_MIN} maxLength={REPORT_TEXT_MAX} aria-invalid={Boolean(error)} disabled={disabled} />
    {error ? <FieldError>{error}</FieldError> : <FieldDescription>{value.length}/{REPORT_TEXT_MAX} characters · Include all the details here — location specifics, timing, and anything else that helps (at least {REPORT_TEXT_MIN} characters).</FieldDescription>}
    <div className="report-rewrite-actions">
      <Button type="button" variant="outline" size="sm" onClick={rewrite} disabled={disabled || pending || value.trim().length < REPORT_TEXT_MIN}>
        {pending ? <LoaderCircle className="spin-icon" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
        {pending ? "Rewriting..." : "Rewrite with AI"}
      </Button>
      <span>Optional — review the suggestion before using it.</span>
      {original !== null && <Button type="button" variant="ghost" size="sm" disabled={disabled || pending} onClick={() => { onChange(original); setOriginal(null); setSuggestion(""); setRewriteError("") }}>Undo rewrite</Button>}
    </div>
    {rewriteError && <p className="report-rewrite-error" role="alert">{rewriteError}</p>}
    {suggestion && <section className="report-rewrite-preview" aria-label="AI rewrite suggestion">
      <strong>Suggested wording</strong>
      <p className="report-rewrite-text">{suggestion}</p>
      <p>Check that this still describes exactly what you noticed.</p>
      <div className="report-rewrite-actions">
        <Button type="button" size="sm" disabled={disabled} onClick={() => { setOriginal(value); onChange(suggestion); setSuggestion("") }}>Use this wording</Button>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setSuggestion("")}>Keep my wording</Button>
      </div>
    </section>}
  </Field>
}
