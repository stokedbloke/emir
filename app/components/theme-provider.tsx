// ThemeProvider: Provides theme context (dark/light/system) for the app
// Wraps children with theme context and handles theme switching logic.
//
import * as React from "react"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    // NextThemesProvider enables dark/light/system theme switching
    <NextThemesProvider {...props}>{children}</NextThemesProvider>
  )
} 