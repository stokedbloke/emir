// App Layout: Provides global layout, theme provider, and shared UI for all pages
// This file wraps all pages with global styles, theme provider, and layout structure.
//
// - Applies global CSS
// - Wraps children with ThemeProvider for dark/light mode
// - Renders page content via {children}
// - Theme classes/styles are managed by ThemeProvider to avoid hydration mismatches
import "./globals.css"
import type { Metadata } from "next"
import { ThemeProvider } from "@/components/theme-provider"

// The browser tab icon is app/icon.svg, which Next.js links automatically.
export const metadata: Metadata = {
  title: "VocalMirror",
  description: "A private, hands-free voice journal that listens and reflects your words back without judgment.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
