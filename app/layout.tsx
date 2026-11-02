import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import { DemoDataProvider } from "@/components/campus-fix/demo-provider"
import "./globals.css"
import { auth } from "@/auth"
import { AuthProvider } from "@/components/campus-fix/auth-provider"

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
  themeColor: "#142b4a",
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth()
  return (
    <html lang="en">
      <body>
        <AuthProvider session={session}><DemoDataProvider>
          {children}
          <Toaster position="top-right" theme="light" richColors closeButton />
        </DemoDataProvider></AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
