import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import { DemoDataProvider } from "@/components/campus-fix/demo-provider"
import "./globals.css"
import { auth } from "@/auth"
import { AuthProvider } from "@/components/campus-fix/auth-provider"
import { AmbientBackground } from "@/components/campus-fix/ambient-background"

export const metadata: Metadata = {
  title: {
    default: "CampusFix — A better campus, one report at a time",
    template: "%s | CampusFix",
  },
  description:
    "Report campus issues, follow maintenance progress, and help your campus team keep every space running smoothly.",
  applicationName: "CampusFix",
  openGraph: {
    title: "CampusFix — A better campus, one report at a time",
    description:
      "A simple, transparent way for students and campus teams to report and resolve facility issues.",
    type: "website",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f2a44",
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth()
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500..800;1,9..144,400..700&family=Outfit:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <AmbientBackground />
        <AuthProvider session={session}><DemoDataProvider>
          {children}
          <Toaster position="top-right" theme="light" richColors closeButton />
        </DemoDataProvider></AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
