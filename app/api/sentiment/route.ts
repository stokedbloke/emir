export async function POST(request: Request) {
  try {
    const { text, apiKey } = await request.json()

    if (!text) {
      return Response.json({ error: "Text is required" }, { status: 400 })
    }

    // Try Hugging Face sentiment analysis
    if (apiKey) {
      try {
        const response = await fetch(
          "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest",
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({ inputs: text }),
          },
        )

        if (response.ok) {
          const sentiment = await response.json()
          return Response.json({ sentiment: sentiment[0] })
        }
      } catch (error) {
        console.error("Hugging Face sentiment error:", error)
      }
    }

    // Fallback sentiment analysis
    const text_lower = text.toLowerCase()
    let sentiment = "NEUTRAL"
    let confidence = 0.5

    const positiveWords = ["love", "like", "enjoy", "happy", "great", "amazing", "wonderful", "dancing", "fun"]
    const negativeWords = ["hate", "dislike", "sad", "angry", "terrible", "awful", "bad", "upset"]

    const positiveCount = positiveWords.filter((word) => text_lower.includes(word)).length
    const negativeCount = negativeWords.filter((word) => text_lower.includes(word)).length

    if (positiveCount > negativeCount) {
      sentiment = "POSITIVE"
      confidence = Math.min(0.9, 0.6 + positiveCount * 0.1)
    } else if (negativeCount > positiveCount) {
      sentiment = "NEGATIVE"
      confidence = Math.min(0.9, 0.6 + negativeCount * 0.1)
    }

    return Response.json({
      sentiment: [
        {
          label: sentiment,
          score: confidence,
        },
      ],
    })
  } catch (error) {
    console.error("Sentiment analysis error:", error)
    return Response.json({ error: "Failed to analyze sentiment" }, { status: 500 })
  }
}
