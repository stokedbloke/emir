// API Route: List available Gemini models
// Returns a list of available models from Google's Gemini API

import { createGoogleGenerativeAI } from "@ai-sdk/google"

export async function GET() {
  try {
    const googleApiKey = process.env.GOOGLE_API_KEY
    if (!googleApiKey) {
      return Response.json({ error: "Google API key not configured" }, { status: 500 })
    }

    // Create Google AI instance
    const google = createGoogleGenerativeAI({ apiKey: googleApiKey })

    // List available models using the Google AI SDK
    // Note: The AI SDK doesn't have a direct listModels method, so we'll use the REST API
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + googleApiKey, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return Response.json({ 
        error: "Failed to fetch models", 
        details: errorText,
        status: response.status 
      }, { status: response.status })
    }

    const data = await response.json()
    
    // Filter for models that support generateContent
    const supportedModels = data.models?.filter((model: any) => 
      model.supportedGenerationMethods?.includes('generateContent')
    ) || []

    return Response.json({ 
      models: supportedModels,
      allModels: data.models || []
    })

  } catch (error) {
    console.error("Error listing Gemini models:", error)
    return Response.json(
      {
        error: "Failed to list models",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
