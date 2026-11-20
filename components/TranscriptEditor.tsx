"use client"

// The words the app heard for a reflection, with a way to correct them.
// Saving hands the corrected text to the page, which rewrites the summary.
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

const MAX_LENGTH = 20000

type Props = {
  transcript: string
  disabled?: boolean
  // Rejects with a message to show when the change could not be saved.
  onSave: (transcript: string) => Promise<void>
}

export function TranscriptEditor({ transcript, disabled, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(transcript)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cleaned = draft.trim()
  const changed = cleaned !== transcript.trim()
  const tooLong = cleaned.length > MAX_LENGTH

  const startEditing = () => {
    setDraft(transcript)
    setError(null)
    setEditing(true)
  }

  const save = async () => {
    if (!cleaned || !changed || tooLong || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave(cleaned)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your changes could not be saved. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-purple-100 bg-white/70 shadow-lg rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base text-purple-800">What you said</CardTitle>
            <CardDescription>
              {editing
                ? "Fix anything that was misheard. Saving rewrites the summary from your corrected words."
                : "The words as the app heard them. Correct them if anything was misheard."}
            </CardDescription>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEditing} disabled={disabled} className="shrink-0 border-purple-200 text-purple-700 hover:bg-purple-50">
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {editing ? (
          <div className="flex flex-col gap-3">
            <label className="sr-only" htmlFor="transcript-editor">Your words</label>
            <Textarea
              id="transcript-editor"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={saving}
              rows={Math.min(16, Math.max(5, Math.ceil(draft.length / 80)))}
              className="bg-white text-base leading-relaxed text-gray-800"
            />
            {tooLong && <p className="text-sm text-red-700">This is too long to save. Shorten it to {MAX_LENGTH.toLocaleString()} characters.</p>}
            {!cleaned && <p className="text-sm text-red-700">The words cannot be empty.</p>}
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={!cleaned || !changed || tooLong || saving} className="bg-purple-600 text-white hover:bg-purple-700">
                {saving ? "Saving…" : "Save and update summary"}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-purple-100 bg-purple-50/40 p-4 leading-relaxed text-gray-700">
            {transcript}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
