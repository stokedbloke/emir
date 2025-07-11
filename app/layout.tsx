// App Layout: Provides global layout, theme provider, and shared UI for all pages
// This file wraps all pages with global styles, theme provider, and layout structure.
//
// - Applies global CSS
// - Wraps children with ThemeProvider for dark/light mode
// - Renders page content via {children}
// - Theme classes/styles are managed by ThemeProvider to avoid hydration mismatches
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* You can also use favicon.png if preferred: <link rel="icon" type="image/png" href="/favicon.png" /> */}
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
