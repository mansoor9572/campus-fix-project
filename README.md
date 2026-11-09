# CampusFix — AI-Powered Campus Facility Maintenance System

Admins can now create department-based worker accounts and additional administrators under **Team management**, require a password change at first login, and assign reports to workers by account ID. See [Team management](docs/TEAM-MANAGEMENT.md) for the workflow, migration, and testing instructions.

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Serverless-4169E1?logo=postgresql)](https://neon.tech/)
[![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini_3.5/3.8-orange?logo=google)](https://aistudio.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS_v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Deployment](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://campus-fix-project-three.vercel.app)

> **CampusFix** is a full-stack, enterprise-grade campus facility reporting and operations management platform developed as a Semester 5 software engineering project for **Universitas Muhammadiyah Yogyakarta (UMY)**. It automates maintenance triage using Google Gemini AI, supports in-browser live camera capture, tracks work orders across departments, and provides real-time analytics for campus operations.

🌐 **Live Production URL**: [https://campus-fix-project-three.vercel.app](https://campus-fix-project-three.vercel.app)  
📦 **Repository**: [github.com/mansoor9572/campus-fix-project](https://github.com/mansoor9572/campus-fix-project)

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Core Features](#-core-features)
  - [Student Experience](#1-student-experience-reporting)
  - [Google Gemini AI Engine](#2-google-gemini-ai-engine)
  - [Operations & Maintenance Staff](#3-operations--maintenance-workspace)
  - [Live Dashboard & Analytics](#4-live-analytics--dashboard)
- [Tech Stack](#-tech-stack)
- [Database & Schema](#-database--schema)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Installation](#local-installation)
  - [Environment Variables](#environment-variables)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Deployment](#-deployment)
- [Demo Credentials](#-demo-credentials)
- [License](#-license)

---

## 🏛 System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Next.js 16 App Router)"]
        A1["Student Portal\n- Issue Reporting\n- AI Rewrite\n- Live Camera / Upload\n- Timeline Tracking"]
        A2["Staff Portal\n- Task Queue\n- In-Progress Actions\n- Completion Resolution"]
        A3["Admin Operations\n- Live Metrics Dashboard\n- AI Triage Review\n- Staff Assignment\n- Building Directory"]
    end

    subgraph Security ["Security & Auth Layer"]
        B1["Auth.js v5 (JWT & Sessions)"]
        B2["Role-Based Access Control (RBAC)"]
        B3["Origin & CSRF Protection"]
    end

    subgraph Backend ["Next.js API & Services"]
        C1["/api/reports (CRUD & Filters)"]
        C2["/api/reports/analyze (AI Triage)"]
        C3["/api/reports/rewrite (AI Text Polish)"]
        C4["/api/uploads (Image Pipeline)"]
        C5["/api/analytics (Live Stats)"]
        C6["/api/buildings (UMY Directory)"]
    end

    subgraph External ["External Services"]
        D1["Google Gemini AI API\n(gemini-3.5-flash / gemini-3.8-flash)"]
        D2["Neon PostgreSQL\n(Serverless DB + Connection Pooling)"]
        D3["Resend Transactional Email\n(Verification & Password Reset)"]
    end

    A1 --> Security
    A2 --> Security
    A3 --> Security
    Security --> Backend
    Backend --> D1
    Backend --> D2
    Backend --> D3
```

---

## ✨ Core Features

### 1. Student Experience (Reporting)
* **Single-Field Frictionless Input**: Reporters describe the problem naturally without technical categorization barriers.
* **"✨ Rewrite with AI"**: One-click clarity and grammar improvement powered by Google Gemini, preserving all facts, locations, and uncertainty.
* **Live Camera & Photo Upload**:
  * In-browser live camera viewfinder with front/back camera toggle.
  * Native smartphone camera access (`capture="environment"`).
  * Drag-and-drop file uploader with JPG, PNG, and WebP validation (up to 5 MB).
* **Searchable UMY Directory**: Instant search across 27 university buildings, faculties, and codes (e.g. F1, F6).
* **Live Status Tracking**: Real-time progress timeline showing status transitions (*Submitted &rarr; Under Review &rarr; In Progress &rarr; Resolved*).

### 2. Google Gemini AI Engine
* **Automated Background Triage**: When a report is submitted with a photo and description, Gemini automatically:
  * Detects specific physical objects and fixtures (e.g. *"fluorescent ballast"*, *"HVAC copper pipe"*, *"door lock latch"*).
  * Calculates urgency and severity (*Low, Medium, High*).
  * Recommends the maintenance department (*Electrical, Plumbing, Facilities, IT, Safety*).
  * Generates an actionable 2–3 sentence technical work order summary.
* **Multi-Model Auto-Failover**: Resilient cascade (`gemini-3.5-flash` &rarr; `gemini-3.5-flash-lite` &rarr; `gemini-3.8-flash`) that automatically reroutes on API demand spikes (503) without downtime.
* **Rule-Based Offline Fallback**: Deterministic emergency triage ensures zero downtime even during total network outages.

### 3. Operations & Maintenance Workspace
* **Triage Approval Card**: Operations staff can review AI recommendations, verify detected fixtures, and approve or modify categories and priorities in one click.
* **Technician Assignment**: Dispatch verified maintenance staff members directly to work orders.
* **Role-Based Task Management**: Technicians see their assigned queue, transition tasks to *In Progress*, and submit completion notes.

### 4. Live Analytics & Dashboard
* **Real-Time KPIs**: Total reports, pending reviews, active in-progress issues, and resolution rate percentages.
* **Mean Time to Resolution (MTTR)**: Average resolution time in hours calculated dynamically.
* **Staff Workload Distribution**: Live count of open tickets per technician to balance work across crews.
* **Aggregations by Category & Priority**: Visual charts and progress meters displaying current campus maintenance health.

---

## 🛠 Tech Stack

| Domain | Technology |
|---|---|
| **Frontend Framework** | [Next.js 16](https://nextjs.org/) (App Router, Server & Client Components, Turbopack) |
| **Language** | [TypeScript 5.9](https://www.typescriptlang.org/) (Strict typing, zero `any` policy) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + Custom Design System |
| **UI Components** | Base UI (`@base-ui/react`), Lucide React icons, Sonner toast notifications |
| **Database** | [Neon Serverless PostgreSQL](https://neon.tech/) with connection pooling |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) + Drizzle Kit (Type-safe migrations & relations) |
| **Authentication** | [Auth.js v5](https://authjs.dev/) (Credentials, Google OAuth, JWT, RBAC) |
| **Artificial Intelligence** | [Google Gen AI SDK](https://github.com/google/generative-ai-js) (`@google/genai`) |
| **Email Service** | [Resend](https://resend.com/) (HTTPS transactional email) |
| **Hosting & CI/CD** | [Vercel](https://vercel.com/) (Edge routing, serverless compute) |
| **Testing** | Node.js native test runner (`tsx --test`), 40 automated test suites |

---

## 🗄 Database & Schema

The schema is defined in `lib/db/schema.ts` and managed via Drizzle ORM:

```mermaid
erDiagram
    users ||--o{ accounts : "has"
    users ||--o{ reports : "submits"
    users ||--o{ report_assignments : "assigned to"
    users ||--o{ notifications : "receives"
    buildings ||--o{ reports : "located at"
    departments ||--o{ reports : "assigned department"
    facility_categories ||--o{ reports : "categorized as"
    reports ||--o{ report_images : "contains"
    reports ||--o{ ai_analyses : "triaged by"
    reports ||--o{ report_assignments : "assigned via"
    reports ||--o{ report_status_history : "tracks"
```

### Primary Tables
* **`users`**: User identities with roles (`student`, `maintenance_staff`, `admin`), hashed passwords, verification state.
* **`buildings`**: 27 UMY campus buildings with codes, faculty associations, and Indonesian aliases.
* **`departments`**: Maintenance divisions (*Facilities Services, Electrical Services, Plumbing Services, Campus IT, Campus Safety, Housekeeping*).
* **`facility_categories`**: Issue categories with default department mappings.
* **`reports`**: Core tickets with reference numbers (`RPT-1041`), structured floor/room coordinates, status, and priorities.
* **`report_images`**: Uploaded and camera-captured photos linked to reports.
* **`ai_analyses`**: Gemini triage output: detected object, suggested priority/department, confidence, and review status.
* **`report_status_history`**: Audit trail of every lifecycle event, actor, note, and timestamp.
* **`notifications`**: In-app alerts for ticket updates and assignments.

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v20.x or higher
* **pnpm**: v12.x or **npm** v10+
* **PostgreSQL Database**: Neon serverless connection string
* **Google Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/)
* **Resend API Key**: From [Resend](https://resend.com/) (for email delivery)

### Local Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/mansoor9572/campus-fix-project.git
   cd campus-fix-project
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the root directory:
   ```env
   # Database (Neon PostgreSQL)
   DATABASE_URL="postgresql://user:pass@ep-xyz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

   # Auth.js v5
   AUTH_SECRET="your-32-char-random-secret"
   APP_URL="http://localhost:3000"
   AUTH_URL="http://localhost:3000"

   # Google Gemini AI
   GEMINI_API_KEY="AIzaSy..."
   GEMINI_MODEL="gemini-3.5-flash"

   # Resend Email Delivery
   AUTH_EMAIL_PROVIDER="resend"
   AUTH_EMAIL_FROM="CampusFix <onboarding@resend.dev>"
   RESEND_API_KEY="re_..."
   ```

4. **Run database migrations and seed directory**:
   ```bash
   npx tsx scripts/seed-umy-buildings.ts
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Quality Assurance

CampusFix includes comprehensive test suites verifying authentication, reporting business logic, AI failover, and file uploads.

Run all tests:
```bash
npm test
```

### Test Coverage Highlights
* **Authentication Unit Tests**: Password hashing, JWT claims, role authorization, account registration validation.
* **Report Validation Tests**: Floor/room constraints, character boundaries, optimistic locking versioning.
* **AI Triage & Rewrite Tests**: Gemini response parsing, multi-model fallback, 503 error recovery, credential guards.
* **Upload Validation Tests**: 5 MB file size limit, MIME type whitelist (JPEG, PNG, WebP), storage key generation.
* **Building Directory Tests**: UMY bilingual search, fuzzy alias matching, ranking logic.

---

## 🌐 Deployment

CampusFix is configured for continuous zero-downtime deployment on **Vercel**:

1. Fork or push to your GitHub repository.
2. Link the repository on [Vercel](https://vercel.com).
3. Add the production environment variables (from `.env.local`) under **Vercel Settings &rarr; Environment Variables**.
4. Set `AUTH_TRUST_HOST=true` and `APP_URL=https://your-project.vercel.app`.
5. Deployments trigger automatically on every push to `main`.

For detailed production instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 🔑 Demo Credentials

For testing and grading, pre-configured verified accounts are available:

| Role | Email | Password | Access Level |
|---|---|---|---|
| **Administrator** | `t.altameme95@gmail.com` | `CampusFix2026!` | Full Operations Dashboard, Analytics, Staff Assignment, Triage Approval |
| **Student** | `student@example.com` | `Student2026!` | Issue Reporting, AI Rewrite, Camera Capture, Personal Timeline |
| **Maintenance Staff** | `staff@example.com` | `Staff2026!` | Task Board, Work Orders, In-Progress Updates, Resolution |

---

## 📄 Documentation Index

* [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) — Comprehensive Academic Technical Report
* [DEPLOYMENT.md](DEPLOYMENT.md) — Production Deployment & Cloud Setup
* [AUTHENTICATION.md](AUTHENTICATION.md) — Auth.js v5 Security Architecture & RBAC
* [REPORT_BACKEND.md](REPORT_BACKEND.md) — Reporting API & State Transition Specifications
* [docs/UMY-LOCATION-DELIVERY.md](docs/UMY-LOCATION-DELIVERY.md) — Campus Building Directory Specification

---

## 👥 Authors & Academic Context

* **Project**: AI Campus Fix (CampusFix)
* **Institution**: Universitas Muhammadiyah Yogyakarta (UMY)
* **Semester**: Semester 5 University Project (2026)
* **Lead Developer**: Mohammed Mansoor ([@mansoor9572](https://github.com/mansoor9572))

