export async function GET() {
  return Response.json({
    huggingface: !!process.env.HUGGINGFACE_API_KEY,
    google: !!process.env.GOOGLE_API_KEY,
  });
} 