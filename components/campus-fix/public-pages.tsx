"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Eye,
  EyeOff,
  Info,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { BrandMark } from "@/components/campus-fix/shared"
import { signIn, getSession } from "next-auth/react"
import { dashboardFor } from "@/lib/auth/policy"
import { accountRequest } from "@/lib/auth/client"

function ProductPreview() {
  return (
    <div className="hero-visual" aria-label="CampusFix product dashboard preview">
      <div className="product-preview">
        <div className="preview-browser-bar">
          <div className="window-dots"><span className="preview-browser-dot" /><span className="preview-browser-dot" /><span className="preview-browser-dot" /></div>
          <div className="preview-url" aria-hidden="true" />
          <div className="window-dots"><span className="preview-browser-dot" /><span className="preview-browser-dot" /><span className="preview-browser-dot" /></div>
        </div>
        <div className="preview-window">
          <aside className="preview-sidebar" aria-hidden="true">
            <div className="preview-brand">
              <span className="preview-brand-mark"><ClipboardList /></span>
              CampusFix
            </div>
            <div className="preview-nav-item preview-nav-item-active"><BarChart3 />Overview</div>
            <div className="preview-nav-item"><ClipboardCheck />My reports</div>
            <div className="preview-nav-item"><Bell />Notifications</div>
          </aside>
          <div className="preview-main">
            <div className="preview-main-header">
              <div>
                <h3>Good morning, Aisha</h3>
                <p>Here&apos;s what&apos;s happening with your reports.</p>
              </div>
              <span className="preview-new-report">+ New report</span>
            </div>
            <div className="preview-stats">
              <div className="preview-stat"><label>My reports</label><strong>6</strong><span>+1 this week</span></div>
              <div className="preview-stat"><label>In progress</label><strong>2</strong><span>Team assigned</span></div>
              <div className="preview-stat"><label>Resolved</label><strong>4</strong><span>All time</span></div>
            </div>
            <div className="preview-reports">
              <div className="preview-reports-header"><span>Recent reports</span><span>View all</span></div>
              <div className="preview-report-row">
                <div><strong>Air conditioning leak</strong><small>North Science Center · A101</small></div>
                <span className="preview-tag preview-priority">High</span>
                <span className="preview-tag preview-status">Review</span>
              </div>
              <div className="preview-report-row">
                <div><strong>Loose stairwell handrail</strong><small>Student Union · East stairwell</small></div>
                <span className="preview-tag preview-priority">High</span>
                <span className="preview-tag preview-status">New</span>
              </div>
              <div className="preview-report-row">
                <div><strong>Library restroom faucet</strong><small>Morrow Library · 1st floor</small></div>
                <span className="preview-tag preview-priority preview-priority-low">Low</span>
                <span className="preview-tag preview-status preview-status-done">Done</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="preview-resolved-toast">
        <div className="preview-resolved-icon"><CheckCircle2 /></div>
        <div><strong>Issue resolved</strong><small>Faucet · Morrow Library</small></div>
      </div>
    </div>
  )
}

const features: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Sparkles,
    title: "AI-powered analysis",
    description: "A demo analysis previews how descriptions and photos can help teams understand a request faster."
  },
  {
    icon: ShieldCheck,
    title: "Smart priority classification",
    description: "Suggested urgency gives campus teams a clearer starting point for review and triage."
  },
  {
    icon: ClipboardList,
    title: "Centralized reporting",
    description: "Bring issue details, locations, assignments, and maintenance notes into one shared workflow."
  },
  {
    icon: Bell,
    title: "Real-time status tracking",
    description: "Students can follow reviews, assignments, work notes, and resolutions from one place."
  },
]

export function LandingPage() {
  return (
    <main className="public-site">
      <header className="public-nav-wrap">
        <nav className="public-nav" aria-label="Main navigation">
          <Link href="/" aria-label="CampusFix home"><BrandMark /></Link>
          <div className="public-nav-links">
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#for-campus">For campus teams</a>
          </div>
          <div className="public-nav-actions">
            <Link className="text-link public-nav-signin public-desktop-signin" href="/login">Sign in</Link>
            <Link className="button-link public-cta" href="/login">Report a Problem <ArrowRight aria-hidden="true" /></Link>
            <Link className="text-link public-nav-signin public-mobile-signin" href="/login">Sign in</Link>
          </div>
        </nav>
      </header>

      <section className="public-hero" id="home">
        <div className="public-container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" />Campus care, made easier</span>
            <h1>A Smarter Way to <span>Maintain Your Campus.</span></h1>
            <p className="hero-description">
              Report the little things before they become big things. CampusFix connects students with the teams who keep campus running.
            </p>
            <div className="hero-actions">
              <Link className="button-link public-cta" href="/login">Report a Problem <ArrowRight aria-hidden="true" /></Link>
              <a className="button-link public-cta public-cta-light" href="#features">Explore Features <ChevronRight aria-hidden="true" /></a>
            </div>
            <div className="hero-social-proof">
              <div className="proof-avatars" aria-hidden="true"><span className="proof-avatar">AP</span><span className="proof-avatar">JM</span><span className="proof-avatar">DR</span></div>
              <span>Designed for students and the teams behind campus.</span>
            </div>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section className="public-section" id="features">
        <div className="public-container">
          <div className="public-section-heading">
            <span className="eyebrow"><span className="eyebrow-dot" />A simpler campus workflow</span>
            <h2>Good campus care starts with a clear signal.</h2>
            <p>From a flickering light to a facilities request, make it easy to report an issue and easy for the right team to act on it.</p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, description }) => (
              <article className="feature-card" key={title}>
                <span className="feature-icon"><Icon aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section process-section" id="how-it-works">
        <div className="public-container">
          <div className="public-section-heading">
            <span className="eyebrow"><span className="eyebrow-dot" />From issue to resolved</span>
            <h2>Three steps. No guesswork.</h2>
            <p>Give campus teams the information they need and stay in the loop while they take care of the rest.</p>
          </div>
          <div className="steps-grid">
            <article className="step-card"><span className="step-number">01 / REPORT</span><h3>Tell us what&apos;s wrong</h3><p>Choose a location, describe the issue, and attach a photo if it helps explain what you&apos;re seeing.</p></article>
            <article className="step-card"><span className="step-number">02 / ROUTE</span><h3>The right team picks it up</h3><p>Campus staff review requests, set a priority, and assign work to the team best equipped to help.</p></article>
            <article className="step-card"><span className="step-number">03 / RESOLVE</span><h3>Follow progress as it happens</h3><p>Check status updates and notes from the team, then see when the issue is taken care of.</p></article>
          </div>
        </div>
      </section>

      <section className="public-section" id="for-campus">
        <div className="public-container promise-grid">
          <div className="promise-copy">
            <span className="eyebrow"><span className="eyebrow-dot" />Built for your whole campus</span>
            <h2>Better spaces are a team effort.</h2>
            <p>CampusFix gives students a dependable way to speak up and gives operations teams a shared picture of what needs attention.</p>
            <div className="promise-checks">
              <div className="promise-check"><Check aria-hidden="true" />Clear status updates for every request</div>
              <div className="promise-check"><Check aria-hidden="true" />Priority and ownership visible to teams</div>
              <div className="promise-check"><Check aria-hidden="true" />A searchable record of campus care</div>
            </div>
          </div>
          <div className="promise-stats" aria-label="CampusFix demo statistics">
            <div className="promise-stat-card"><strong>1 place</strong><span>for reports, updates, and team handoffs</span></div>
            <div className="promise-stat-card"><strong>3 roles</strong><span>student, administrator, and facilities staff</span></div>
            <div className="promise-stat-card"><strong>Clear</strong><span>ownership from first report to resolution</span></div>
            <div className="promise-stat-card"><strong>Campus-wide</strong><span>visibility across buildings and categories</span></div>
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-cta-inner">
          <div><h2>See something that needs attention?</h2><p>Help make the next campus day a little better.</p></div>
          <Link className="button-link public-cta" href="/login">Start a report <ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>

      <footer className="public-footer">
        <div className="public-footer-inner">
          <Link href="/" aria-label="CampusFix home"><BrandMark small /></Link>
          <span>© 2026 CampusFix · A campus operations demo</span>
          <div className="public-footer-links"><Link href="/login">Sign in</Link><Link href="/register">Create account</Link></div>
        </div>
      </footer>
    </main>
  )
}

export function AuthBrandPanel({ register = false }: { register?: boolean }) {
  return (
    <aside className="auth-brand-panel">
      <Link href="/" aria-label="CampusFix home"><BrandMark /></Link>
      <div className="auth-brand-content">
        <span className="eyebrow"><span className="eyebrow-dot" />Campus care, connected</span>
        <h1>{register ? "Make campus better, together." : "Good to have you back."}</h1>
        <p>{register ? "Create a CampusFix account to report an issue and follow the work that keeps your campus running." : "Sign in to see your reports, updates, and the campus work moving forward."}</p>
      </div>
      <div className="auth-quote">
        <p>“When everyone knows what needs attention, it&apos;s easier to take care of the place we share.”</p>
        <strong>CampusFix · Northfield University</strong>
      </div>
    </aside>
  )
}

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setPending(true)
    try {
      const result = await signIn("credentials", { email, password, remember: String(remember), redirect: false })
      if (result.error) {
        setError("Unable to sign in. Check your credentials, verify your email, or try again later if you have made several attempts.")
        return
      }
      const session = await getSession()
      if (!session?.user) throw new Error("Unable to start your session. Please try again.")
      window.location.assign(dashboardFor(session.user.role))
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to sign in. Please try again.") }
    finally { setPending(false) }
  }

  return (
    <main className="auth-shell">
      <AuthBrandPanel />
      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <Link className="auth-mobile-brand" href="/" aria-label="CampusFix home"><BrandMark small /></Link>
          <h2>Sign in to CampusFix</h2>
          <p className="auth-subtitle">Welcome back. Sign in with your verified campus account.</p>
          <form className="auth-form" onSubmit={submit} noValidate>
            {error ? <div className="auth-error" role="alert">{error}</div> : null}

            <FieldGroup>
              <Field data-invalid={Boolean(email) && !/^\S+@\S+\.\S+$/.test(email.trim())}>
                <FieldLabel htmlFor="login-email">Campus email</FieldLabel>
                <Input
                  id="login-email"
                  className="form-control"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(email) && !/^\S+@\S+\.\S+$/.test(email.trim())}
                  required
                />
                {email && !/^\S+@\S+\.\S+$/.test(email.trim()) ? <FieldError>Enter a valid email address.</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <div className="password-field-wrap">
                  <Input
                    id="login-password"
                    className="form-control"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                <FieldDescription>Use the password you chose when creating your account.</FieldDescription>
              </Field>
            </FieldGroup>

            <div className="auth-field-row">
              <label className="auth-remember" htmlFor="remember-session">
                <Checkbox id="remember-session" checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} />
                Keep me signed in
              </label>
              <Link className="text-link forgot-button" href="/forgot-password">Forgot password?</Link>
            </div>

            <Button className="auth-submit" type="submit" disabled={pending}>{pending ? "Signing in..." : "Sign in"} <ArrowRight data-icon="inline-end" /></Button>
          </form>
          <p className="auth-switch">New to CampusFix? <Link className="text-link" href="/register">Create an account</Link></p>
          <div className="auth-demo-note"><Info aria-hidden="true" /><Link className="text-link" href="/resend-verification">Need a verification email?</Link></div>
        </div>
      </section>
    </main>
  )
}

export function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [accepted, setAccepted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState(false)
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrors([])
    setPending(true)
    try {
      const result = await accountRequest("register", { name, email, password, confirmPassword, accepted })
      setMessage(result.message)
      setSuccess(true)
      setPassword("")
      setConfirmPassword("")
    } catch (error) { setErrors([error instanceof Error ? error.message : "Unable to create your account. Please try again."]) }
    finally { setPending(false) }
  }

  return (
    <main className="auth-shell">
      <AuthBrandPanel register />
      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <Link className="auth-mobile-brand" href="/" aria-label="CampusFix home"><BrandMark small /></Link>
          <h2>Create your account</h2>
          <p className="auth-subtitle">Get updates on the campus issues you report.</p>
          {success ? (
            <div className="register-success" role="status">
              <CheckCircle2 aria-hidden="true" />
              <div><strong>Check your email.</strong><p>{message}</p></div>
            </div>
          ) : null}
          {errors.length > 0 ? <div className="auth-error" role="alert">{errors[0]}</div> : null}
          {!success ? (
            <form className="auth-form" onSubmit={submit} noValidate>
              <FieldGroup>
                <Field data-invalid={errors.includes("Add your full name.")}>
                  <FieldLabel htmlFor="register-name">Full name</FieldLabel>
                  <Input id="register-name" className="form-control" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Aisha Patel" required />
                </Field>
                <Field data-invalid={errors.includes("Enter a valid campus email address.")}>
                  <FieldLabel htmlFor="register-email">Campus email</FieldLabel>
                  <Input id="register-email" className="form-control" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@northfield.edu" required />
                </Field>
                <Field data-invalid={errors.includes("Use at least 12 characters and at most 72 UTF-8 bytes for your password.")}>
                  <FieldLabel htmlFor="register-password">Password</FieldLabel>
                  <div className="password-field-wrap">
                    <Input id="register-password" className="form-control" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                    <Button type="button" variant="ghost" size="icon-sm" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff /> : <Eye />}</Button>
                  </div>
                </Field>
                <Field data-invalid={errors.includes("Your passwords do not match.")}>
                  <FieldLabel htmlFor="register-confirm">Confirm password</FieldLabel>
                  <Input id="register-confirm" className="form-control" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                </Field>
              </FieldGroup>
              <label className="auth-remember register-terms" htmlFor="register-terms">
                <Checkbox id="register-terms" checked={accepted} onCheckedChange={(checked) => setAccepted(checked === true)} />
                <span>I agree to create a CampusFix account using this information.</span>
              </label>
              <Button className="auth-submit" type="submit" disabled={pending}>{pending ? "Creating account..." : "Create account"} <ArrowRight data-icon="inline-end" /></Button>
            </form>
          ) : (
            <Button className="auth-submit" onClick={() => router.push("/login")}>Go to sign in <ArrowRight data-icon="inline-end" /></Button>
          )}
          <p className="auth-switch">Already have an account? <Link className="text-link" href="/login">Sign in</Link></p>
          <div className="auth-demo-note"><Info aria-hidden="true" /> Student accounts require email verification. Passwords must have at least 12 characters (at most 72 UTF-8 bytes).</div>
        </div>
      </section>
    </main>
  )
}
