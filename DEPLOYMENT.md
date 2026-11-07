# CampusFix — Production Deployment & Configuration Guide

This guide covers deploying **CampusFix** to production (Vercel, Railway, or custom Node.js servers) with Neon PostgreSQL, Auth.js v5, Google Gemini AI, and Resend email delivery.

---

## 1. System Architecture Overview

- **Framework**: Next.js 16 (App Router + Turbopack + Node.js 20+)
- **Database**: PostgreSQL (Neon Serverless with Drizzle ORM)
- **Authentication**: Auth.js v5 (JWT strategy, session revocation, credentials provider, RBAC)
- **AI Triage**: Google Gemini 3.8 Flash (`@google/genai`) with automatic local fallback
- **Email Delivery**: Resend API (HTTPS-based transactional email)
- **File Storage**: Persistent storage in `/public/uploads/` with automatic data URL fallback on serverless

---

## 2. Production Environment Variables Checklist

Configure these environment variables in your deployment settings (e.g. **Vercel Project Settings → Environment Variables**):

| Variable | Description | Example / Value |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL pooled connection string | `postgresql://user:pass@ep-xyz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `AUTH_SECRET` | 32+ character random cryptographic secret | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `APP_URL` | Canonical public HTTPS URL of your deployed application | `https://campusfix.vercel.app` |
| `AUTH_URL` | Auth.js base URL (same as `APP_URL`) | `https://campusfix.vercel.app` |
| `AUTH_TRUST_HOST` | Set to `true` on Vercel or reverse-proxy deployments | `true` |
| `AUTH_EMAIL_PROVIDER` | Email provider engine (`resend` in production, `file` in dev) | `resend` |
| `RESEND_API_KEY` | Resend API key from https://resend.com/ | `re_123456789...` |
| `AUTH_EMAIL_FROM` | Verified sender address or Resend test domain | `CampusFix <onboarding@resend.dev>` or `support@yourdomain.edu` |
| `GEMINI_API_KEY` | Google AI Studio key for live AI issue triage | `AIzaSy...` (from https://aistudio.google.com/) |
| `GEMINI_MODEL` | Gemini AI model identifier | `gemini-3.8-flash` |

---

## 3. Step-by-Step Vercel Deployment

### Step A: Push to GitHub / GitLab
Make sure your changes are pushed to your Git repository:
```bash
git push origin main
```

### Step B: Import Project in Vercel
1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **Add New... → Project**.
3. Import the `ai-campus-fix-frontend` repository.
4. Select Framework Preset: **Next.js**.

### Step C: Add Environment Variables
Add all the variables from Section 2 into the Vercel **Environment Variables** panel.

### Step D: Deploy
Click **Deploy**. Next.js will build all 14 dynamic routes in ~30 seconds.

---

## 4. Initializing the Production Database

Once deployed, ensure your Neon PostgreSQL database has the schema migrations and campus reference data applied:

```bash
# Apply migrations to live Neon database
npx pnpm@12.3.4 run db:migrate

# Seed campus buildings (6), departments (6), and facility categories (11)
npx pnpm@12.3.4 run db:seed
```

### Create Your Production Administrator Account
Run the automated account provisioning script with your own university email and a strong password:

```bash
npx tsx scripts/create-test-user.ts your.name@university.edu YourSecurePassword2026! --admin
```

This creates an active, email-verified administrator account ready for immediate sign-in at `https://your-domain.vercel.app/login`.

---

## 5. Email Setup with Resend

1. Sign up for a free account at [resend.com](https://resend.com).
2. Generate an API Key under **API Keys**.
3. For testing, Resend provides the free sandbox domain `onboarding@resend.dev` to deliver emails to your verified account address.
4. For full production campus delivery, add and verify your custom university or department domain under **Domains** in Resend.

---

## 6. Production Health & Verification Checklist

- [x] **Database Connectivity**: Neon PostgreSQL connection uses `sslmode=require`.
- [x] **Authentication**: Auth.js cookies are encrypted and secured with `AUTH_SECRET`.
- [x] **Role-Based Access Control**:
  - `student`: Submits reports, views own reports, accesses real-time AI triage.
  - `maintenance_staff`: Views assigned work orders, updates task status to In Progress / Resolved.
  - `admin`: Full review queue, category/priority triage, technician dispatching, analytics overview.
- [x] **Image Persistence**: Report photos are stored with UUID storage keys and linked in the `report_images` table.
- [x] **Live Metrics**: Dashboard aggregations, resolution rates, and team workloads calculate directly on the database.
- [x] **Build Verification**: Zero TypeScript errors (`tsc --noEmit`), zero ESLint errors (`eslint .`).
