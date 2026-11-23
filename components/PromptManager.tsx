"use client"

// Admin tool: add, edit, hide and delete the journal prompts shown on the
// record screen.
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

type Prompt = { id: string; text: string; active: boolean }

const MAX_LENGTH = 300

export function PromptManager({ adminHeaders }: { adminHeaders: () => Record<string, string> }) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [newText, setNewText] = useState("")
  const [status, setStatus] = useState<"loading" | "ready" | "setup">("loading")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const call = async (method: string, body?: unknown) => {
    const response = await fetch("/api/prompts", {
      method,
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || "Could not update prompts")
    return data
  }

  useEffect(() => {
    call("GET")
      .then((data) => {
        setPrompts(data.prompts || [])
        setStatus(data.setupRequired ? "setup" : "ready")
      })
      .catch((err) => { setError(err.message); setStatus("ready") })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update prompts")
    } finally {
      setBusy(false)
    }
  }

  const add = () => run(async () => {
    const { prompt } = await call("POST", { text: newText })
    setPrompts((list) => [...list, prompt])
    setNewText("")
  })

  const update = (id: string, changes: Partial<Pick<Prompt, "text" | "active">>) => run(async () => {
    const { prompt } = await call("PATCH", { id, ...changes })
    setPrompts((list) => list.map((item) => (item.id === id ? prompt : item)))
    setDrafts(({ [id]: _saved, ...rest }) => rest)
  })

  const remove = (prompt: Prompt) => run(async () => {
    if (!window.confirm(`Delete this prompt?\n\n"${prompt.text}"`)) return
    await call("DELETE", { id: prompt.id })
    setPrompts((list) => list.filter((item) => item.id !== prompt.id))
  })

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-800">Journal Prompts</h3>
        <p className="mt-1 text-sm text-gray-600">
          Suggestions shown on the record screen, one at a time, as examples of what to talk about. People can skip them or ask for another.
        </p>
      </div>

      {status === "setup" && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Prompts are not set up yet. Run <code>supabase/prompts.sql</code> in the Supabase SQL editor, then reload this page.
        </p>
      )}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

      {status === "ready" && (
        <>
          {prompts.length === 0 && <p className="text-sm text-gray-500">No prompts yet. The record screen shows no suggestion until you add one.</p>}
          <ul className="space-y-3">
            {prompts.map((prompt) => {
              const draft = drafts[prompt.id] ?? prompt.text
              const changed = draft.trim() !== prompt.text && draft.trim().length > 0
              return (
                <li key={prompt.id} className={`rounded-xl border p-3 ${prompt.active ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50"}`}>
                  <label className="sr-only" htmlFor={`prompt-${prompt.id}`}>Prompt text</label>
                  <textarea
                    id={`prompt-${prompt.id}`}
                    rows={2}
                    maxLength={MAX_LENGTH}
                    value={draft}
                    onChange={(event) => setDrafts((all) => ({ ...all, [prompt.id]: event.target.value }))}
                    className={`w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm ${prompt.active ? "text-gray-900" : "text-gray-500"}`}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${prompt.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-700"}`}>
                      {prompt.active ? "Shown" : "Hidden"}
                    </span>
                    <div className="ml-auto flex flex-wrap gap-2">
                      {changed && (
                        <Button size="sm" disabled={busy} onClick={() => update(prompt.id, { text: draft })}>Save text</Button>
                      )}
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => update(prompt.id, { active: !prompt.active })}>
                        {prompt.active ? "Hide" : "Show"}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => remove(prompt)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="rounded-xl border border-dashed border-gray-300 p-3">
            <label htmlFor="new-prompt" className="block text-sm font-medium text-gray-700">Add a prompt</label>
            <textarea
              id="new-prompt"
              rows={2}
              maxLength={MAX_LENGTH}
              value={newText}
              onChange={(event) => setNewText(event.target.value)}
              placeholder="Tell me about a recent laugh you shared with a family member."
              className="mt-1 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">{newText.length}/{MAX_LENGTH}</span>
              <Button size="sm" disabled={busy || !newText.trim()} onClick={add}>Add prompt</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
