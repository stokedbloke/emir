import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { userId, transcript, summary, emotions, vocal } = await request.json();

    // Upsert user (create if not exists, update last_active if exists)
    await supabase.from('users').upsert([
      { id: userId, last_active: new Date() }
    ], { onConflict: ['id'] });

    // Insert reflection
    const { error } = await supabase.from('reflections').insert([
      {
        user_id: userId,
        transcript,
        summary,
        emotions,
        vocal,
      },
    ]);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 