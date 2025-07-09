// App Layout: Provides global layout, theme provider, and shared UI for all pages
// This file wraps all pages with global styles, theme provider, and layout structure.
//
// - Applies global CSS
// - Wraps children with ThemeProvider for dark/light mode
// - Renders page content via {children}
//
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {/* ThemeProvider enables dark/light mode and global theme context */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {/* Render all page content here */}
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
