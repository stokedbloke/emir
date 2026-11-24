// The key used for Gemini (summaries and emotion analysis).
//
// GOOGLE_API_KEY_2, when set, takes over the Gemini calls. GOOGLE_API_KEY stays
// in use for Google Speech-to-Text and Text-to-Speech, which need those APIs
// enabled on the key's project and so cannot simply move to another key.
// Gemini models to try, in order. Google sometimes turns requests away for a
// while with "high demand" (503); the next model usually still answers.
export const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash'] as const;

/**
 * Runs a Gemini request on the first model and, if that has not answered
 * within hedgeAfterMs (or fails sooner), on the backup model as well. The
 * first answer wins and the other request is cancelled. Gemini's speed swings
 * from one second to twenty for the same request, and it is rarely slow on
 * both models at once.
 */
export async function withGeminiBackup<T>(
  run: (model: string, signal: AbortSignal) => Promise<T>,
  { hedgeAfterMs, timeoutMs }: { hedgeAfterMs: number; timeoutMs: number },
): Promise<T> {
  const stop = new AbortController();
  const signal = AbortSignal.any([stop.signal, AbortSignal.timeout(timeoutMs)]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const first = run(GEMINI_MODELS[0], signal);
    const backup = new Promise<T>((resolve, reject) => {
      let begun = false;
      const begin = () => {
        if (begun || signal.aborted) return;
        begun = true;
        run(GEMINI_MODELS[1], signal).then(resolve, reject);
      };
      timer = setTimeout(begin, hedgeAfterMs);
      first.catch((error) => {
        // Aborted means the backup already answered, or time ran out.
        if (signal.aborted) return reject(error);
        console.warn(`${GEMINI_MODELS[0]} failed, trying ${GEMINI_MODELS[1]}:`, error instanceof Error ? error.message : error);
        begin();
      });
    });
    return await Promise.any([first, backup]);
  } catch (error) {
    throw error instanceof AggregateError ? error.errors[error.errors.length - 1] : error;
  } finally {
    clearTimeout(timer);
    stop.abort();
  }
}

export function geminiApiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY_2 || process.env.GOOGLE_API_KEY || undefined;
}
