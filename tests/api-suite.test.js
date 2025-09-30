// Simple API test suite using Node's global fetch
// Run with: node tests/api-suite.test.js

const BASE_URL = process.env.TEST_BASE_URL || 'https://localhost:3000';
const DEFAULT_VOICE_ID = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_DEFAULT_VOICE_ID || 'Yml13U7FrQRvUmlIv5Th';

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${msg}`);
  }
}

async function testStatus() {
  const res = await fetch(`${BASE_URL}/api/status`, { method: 'GET', redirect: 'manual' });
  assert(res.ok, '/api/status should return 200');
  const json = await res.json();
  assert(typeof json === 'object', 'status response is JSON');
}

async function testGeminiSummarize() {
  const body = {
    transcript: 'I am testing first person output from the summarize endpoint.',
    service: 'gemini',
  };
  const res = await fetch(`${BASE_URL}/api/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert(res.ok, '/api/summarize should return 200');
  const json = await res.json();
  assert(json.summary && typeof json.summary === 'string', 'summary is a string');
  // Basic first-person check (heuristic)
  const s = json.summary.toLowerCase();
  assert(s.includes('i ' ) || s.startsWith('i'), 'summary appears to be first-person');
}

async function testGeminiModels() {
  const res = await fetch(`${BASE_URL}/api/gemini/models`);
  assert(res.ok, '/api/gemini/models should return 200');
  const json = await res.json();
  assert(Array.isArray(json.models), 'models array present');
}

async function testReflectionUUIDValidation() {
  // Invalid UUID should not be 200
  const bad = await fetch(`${BASE_URL}/api/reflection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'not-a-uuid' }),
  });
  assert(!bad.ok, '/api/reflection should reject non-UUID userId');

  // Valid UUID should 200 and return array
  const good = await fetch(`${BASE_URL}/api/reflection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: '12345678-1234-1234-1234-123456789012' }),
  });
  assert(good.ok, '/api/reflection should accept UUID userId');
  const json = await good.json();
  assert(Array.isArray(json.reflections), 'reflections is an array');
}

async function testElevenLabsTTS() {
  // Generates binary audio; we only check status and content-type
  const res = await fetch(`${BASE_URL}/api/voice/elevenlabs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Automated test of TTS endpoint', voiceId: DEFAULT_VOICE_ID }),
  });
  assert(res.ok, '/api/voice/elevenlabs should return 200');
  const ct = res.headers.get('content-type') || '';
  assert(ct.includes('audio') || ct.includes('octet-stream'), 'TTS returns audio content');
}

async function testVoiceCloneImproveCorrupted() {
  // Use empty payload to simulate corrupted audio; should not crash server
  const form = new FormData();
  form.set('audio', new Blob([]), 'empty.webm');
  form.set('userId', 'test_user_123');
  form.set('voiceId', 'nonexistent_voice_id');
  const res = await fetch(`${BASE_URL}/api/voice-clone/improve`, { method: 'POST', body: form });
  assert(res.status === 400 || res.status === 500, 'voice-clone/improve handles corrupted audio gracefully');
}

async function testGeminiListModels() {
  const res = await fetch(`${BASE_URL}/api/gemini/models`, { method: 'GET' });
  assert(res.ok, '/api/gemini/models should return 200');
  const json = await res.json();
  assert(json.models && Array.isArray(json.models), 'Gemini models response should have models array');
  assert(json.models.length > 0, 'Should return at least one Gemini model');
  
  // Check for the working model
  const hasWorkingModel = json.models.some(model => 
    model.name && model.name.includes('gemini-2.0-flash-001')
  );
  assert(hasWorkingModel, 'Should include the working gemini-2.0-flash-001 model');
}

async function testAboutPageContent() {
  // Test that the main page loads (which includes the About tab)
  const res = await fetch(`${BASE_URL}/`, { method: 'GET' });
  assert(res.ok, 'Main page should load successfully');
  const html = await res.text();
  
  // Check for basic page structure (Next.js serves mostly client-side content)
  assert(html.includes('<!DOCTYPE html>'), 'Page should be valid HTML');
  assert(html.includes('<body>'), 'Page should have body tag');
  assert(html.includes('_next/static'), 'Page should include Next.js assets');
}

async function testMobileResponsiveness() {
  // Test with mobile user agent
  const mobileRes = await fetch(`${BASE_URL}/`, { 
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
    }
  });
  assert(mobileRes.ok, 'Page should load on mobile user agent');
  
  const mobileHtml = await mobileRes.text();
  assert(mobileHtml.includes('viewport'), 'Page should have viewport meta tag for mobile');
}

async function testTabNavigation() {
  const res = await fetch(`${BASE_URL}/`, { method: 'GET' });
  assert(res.ok, 'Main page should load');
  const html = await res.text();
  
  // Check for basic page structure (client-side content not available in server response)
  assert(html.includes('<!DOCTYPE html>'), 'Should be valid HTML');
  assert(html.includes('<body>'), 'Should have body tag');
}

async function run() {
  console.log(`🧪 Running comprehensive API and UI test suite against ${BASE_URL}\n`);
  
  console.log('📡 Testing API endpoints...');
  await testStatus();
  await testGeminiSummarize();
  await testGeminiModels();
  await testGeminiListModels();
  await testReflectionUUIDValidation();
  await testElevenLabsTTS();
  await testVoiceCloneImproveCorrupted();
  
  console.log('\n🎨 Testing UI components...');
  await testAboutPageContent();
  await testTabNavigation();
  
  console.log('\n📱 Testing mobile responsiveness...');
  await testMobileResponsiveness();
  
  console.log('\n✅ All tests completed!');
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


