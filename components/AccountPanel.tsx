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
  onForgotPassword?: (email: string) => Promise<Result>
  onDone?: (mode: "signup" | "signin") => void
  onDismiss?: () => void
}

export function AccountPanel({ initialMode, onSignUp, onSignIn, onForgotPassword, onDone, onDismiss }: AccountPanelProps) {
  const [mode, setMode] = useState(initialMode)
  // Asking for a reset link replaces the sign-in form until it is sent.
  const [forgot, setForgot] = useState<"no" | "asking" | "sent">("no")
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
    if (forgot === "asking" && onForgotPassword) {
      const sent = await onForgotPassword(email)
      setBusy(false)
      if (sent.ok) setForgot("sent")
      else setError(sent.error)
      return
    }
    const result = isSignUp ? await onSignUp(email, password) : await onSignIn(email, password)
    setBusy(false)
    if (result.ok) {
      setPassword("")
      onDone?.(mode)
    } else {
      setError(result.error)
    }
  }

  if (forgot !== "no") {
    return (
      <form onSubmit={submit} className="rounded-2xl border border-purple-200 bg-white p-6 text-left">
        <h3 className="text-lg font-semibold text-gray-800">Reset your password</h3>
        {forgot === "sent" ? (
          <p className="mt-2 text-sm leading-relaxed text-gray-700" role="status">
            If {email} has an account, a link to choose a new password is on its way. It can take a minute, and may land in spam. Open the link in this browser to keep the reflections you have made here.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              Enter the email you signed up with and we will send a link for choosing a new password.
            </p>
            <label htmlFor="account-email-forgot" className="mt-4 block text-sm font-medium text-gray-700">Email</label>
            <input
              id="account-email-forgot"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 sm:max-w-sm"
            />
          </>
        )}
        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {forgot === "asking" && (
            <Button type="submit" disabled={busy} className="rounded-xl bg-purple-600 text-white hover:bg-purple-700">
              {busy ? "One moment…" : "Email me a reset link"}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => { setForgot("no"); setError(null) }}
            className="rounded-xl text-gray-600"
          >
            Back to sign in
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-purple-200 bg-white p-6 text-left">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            {isSignUp ? "Keep your reflections across devices" : "Sign in to your reflections"}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            {isSignUp
              ? "Optional. Your reflections currently live in this browser only. Add an email and password to open them on another device, or to get them back if this browser's data is cleared."
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
          {!isSignUp && onForgotPassword && (
            <button
              type="button"
              onClick={() => { setForgot("asking"); setError(null) }}
              className="mt-1 text-xs text-purple-700 underline decoration-dotted hover:text-purple-900"
            >
              Forgot your password?
            </button>
          )}
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

interface NewPasswordPanelProps {
  // True when the reset link was already used or is too old.
  problem: boolean
  onSave: (password: string) => Promise<Result>
  onDone?: () => void
  onDismiss: () => void
  onAskAgain: () => void
}

// Shown after opening the link from a password reset email.
export function NewPasswordPanel({ problem, onSave, onDone, onDismiss, onAskAgain }: NewPasswordPanelProps) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await onSave(password)
    setBusy(false)
    if (result.ok) {
      setPassword("")
      onDone?.()
    } else {
      setError(result.error)
    }
  }

  if (problem) {
    return (
      <div className="rounded-2xl border border-purple-200 bg-white p-6 text-left">
        <h3 className="text-lg font-semibold text-gray-800">That reset link no longer works</h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          Reset links work once and only for a short time. Ask for a new one and open it as soon as it arrives.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" onClick={onAskAgain} className="rounded-xl bg-purple-600 text-white hover:bg-purple-700">Ask for a new link</Button>
          <Button type="button" variant="ghost" onClick={onDismiss} className="rounded-xl text-gray-600">Not now</Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-purple-200 bg-white p-6 text-left">
      <h3 className="text-lg font-semibold text-gray-800">Choose a new password</h3>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">You are signed in. Set a new password to use from now on.</p>
      <label htmlFor="account-new-password" className="mt-4 block text-sm font-medium text-gray-700">New password</label>
      <input
        id="account-new-password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-describedby="account-new-password-hint"
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 sm:max-w-sm"
      />
      <p id="account-new-password-hint" className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit" disabled={busy} className="rounded-xl bg-purple-600 text-white hover:bg-purple-700">
          {busy ? "One moment…" : "Save new password"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDismiss} className="rounded-xl text-gray-600">Not now</Button>
      </div>
    </form>
  )
}
