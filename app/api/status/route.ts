// API Route: Returns which AI services are configured (for frontend status display)
// Receives a GET request and returns which services (HuggingFace, Google) are available based on env vars.
// Environment variables used (private, server-side only):
//   HUGGINGFACE_API_KEY, GOOGLE_API_KEY
//
// Returns: { huggingface: boolean, google: boolean }
//
export async function GET() {
  // Return true/false for each service based on presence of env vars
  return Response.json({
    huggingface: !!process.env.HUGGINGFACE_API_KEY,
    google: !!process.env.GOOGLE_API_KEY,
  });
} 