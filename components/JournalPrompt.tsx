"use client"

// A suggestion for what to talk about, shown on the record screen. Prompts are
// set by the admin; this shows one at random and lets the person see another.
// It is an example to speak to, never a requirement. Renders nothing when no
// prompts exist.
import { useEffect, useState } from "react"

type Prompt = { id: string; text: string }

export function JournalPrompt({ compact = false }: { compact?: boolean }) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch("/api/prompts")
      .then((response) => (response.ok ? response.json() : { prompts: [] }))
      .then((data) => {
        if (cancelled) return
        const list: Prompt[] = Array.isArray(data.prompts) ? data.prompts : []
        setPrompts(list)
        setIndex(list.length > 0 ? Math.floor(Math.random() * list.length) : 0)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  if (prompts.length === 0) return null
  const prompt = prompts[index % prompts.length]

  return (
    <div className={`w-full max-w-2xl rounded-2xl border border-indigo-100 bg-white/70 text-left ${compact ? "p-5" : "p-8"}`}>
      <p className="text-sm font-medium text-indigo-700">Not sure where to start? Here is a suggestion</p>
      <p className={`mt-2 leading-relaxed text-gray-800 ${compact ? "text-base" : "text-lg"}`} aria-live="polite">
        “{prompt.text}”
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Only an idea. Talk about anything you like.</p>
        {prompts.length > 1 && (
          <button
            type="button"
            onClick={() => setIndex((current) => (current + 1) % prompts.length)}
            className="text-sm text-indigo-700 underline decoration-dotted hover:text-indigo-900"
          >
            Another suggestion
          </button>
        )}
      </div>
    </div>
  )
}
