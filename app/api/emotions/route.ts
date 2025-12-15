import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    console.log("Analyzing transcript content:", text);

    const huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;
    if (huggingfaceApiKey) {
      try {
        const { HfInference } = require('@huggingface/inference');
        const hf = new HfInference(huggingfaceApiKey);

        const result = await hf.textClassification({
          model: 'SamLowe/roberta-base-go_emotions',
          inputs: text,
        });

        console.log("HuggingFace API response:", result);

        if (result && Array.isArray(result)) {
          const emotions = result.map((item: any) => ({
            emotion: item.label.charAt(0).toUpperCase() + item.label.slice(1),
            confidence: item.score,
          }));

          console.log("Final emotions analysis:", emotions);
          return NextResponse.json({ emotions });
        } else {
          console.warn("Unexpected HuggingFace response format:", result);
          return NextResponse.json({ emotions: [] });
        }
      } catch (error) {
        console.error("HuggingFace API error:", error);
        return NextResponse.json({ emotions: [] });
      }
    }

    // Fallback if no API key
    return NextResponse.json({ emotions: [] });
  } catch (error) {
    console.error("Emotions API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
