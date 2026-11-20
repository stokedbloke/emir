"use client"

// Optional account form: add an email and password to keep a history across
// devices, or sign in to an existing account. Nothing in the app requires it.
import { useState } from "react"
import { Button } from "@/components/ui/button"

type Result = { ok: true } | { ok: false; error: string }

interface AccountPanelProps {
  initialMode: "signup" | "signin"
  onSignUp: (email: string, password: string) => Promise<Result>
  onSignIn: (email: string, password: string) => Promise<Result>
  onDone?: (mode: "signup" | "signin") => void
  onDismiss?: () => void
}

export function AccountPanel({ initialMode, onSignUp, onSignIn, onDone, onDismiss }: AccountPanelProps) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const isSignUp = mode === "signup"

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const result = isSignUp ? await onSignUp(email, password) : await onSignIn(email, password)
    setBusy(false)
    if (result.ok) {
      setPassword("")
      onDone?.(mode)
    } else {
      setError(result.error)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-purple-200 bg-white/80 p-6 text-left">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            {isSignUp ? "Keep your reflections across devices" : "Sign in to your history"}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            {isSignUp
              ? "Optional. Your history currently lives in this browser only. Add an email and password to open it on another device, or to get it back if this browser's data is cleared."
              : "Reflections you have made in this browser will be added to your account."}
          </p>
        </div>
        {isSignUp && <span className="shrink-0 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">Optional</span>}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`account-email-${mode}`} className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id={`account-email-${mode}`}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </div>
        <div>
          <label htmlFor={`account-password-${mode}`} className="block text-sm font-medium text-gray-700">Password</label>
          <input
            id={`account-password-${mode}`}
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={isSignUp ? 8 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={isSignUp ? `account-password-hint-${mode}` : undefined}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
          {isSignUp && <p id={`account-password-hint-${mode}`} className="mt-1 text-xs text-gray-500">At least 8 characters.</p>}
        </div>
      </div>

      {isSignUp && (
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          Your email is used only to sign you in. It links your reflections to you, so only add it if you want that.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy} className="rounded-xl bg-purple-600 text-white hover:bg-purple-700">
          {busy ? "One moment…" : isSignUp ? "Save email and password" : "Sign in"}
        </Button>
        {onDismiss && (
          <Button type="button" variant="ghost" onClick={onDismiss} className="rounded-xl text-gray-600">
            {isSignUp ? "Not now" : "Cancel"}
          </Button>
        )}
        <button
          type="button"
          onClick={() => { setMode(isSignUp ? "signin" : "signup"); setError(null) }}
          className="ml-auto text-sm text-purple-700 underline decoration-dotted hover:text-purple-900"
        >
          {isSignUp ? "Already have an account? Sign in" : "New here? Add an email instead"}
        </button>
      </div>
    </form>
  )
}
